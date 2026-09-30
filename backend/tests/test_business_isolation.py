"""Two businesses on one database must never see or touch each other's books.

Every test here signs up two independent businesses, gives business A real
trade and khata, then attacks it from business B through every surface:
list endpoints, direct ids, writes that reference A's rows, reports,
the collections desk and Munshi AI.
"""

from datetime import date

import pytest

from app.models.party import Party
from app.tenancy import TenantViolation, scope_session


def signup(client, phone, name, business):
    resp = client.post("/auth/register", json={"name": name, "phone": phone, "password": "password123",
                                               "business_name": business})
    assert resp.status_code == 201, resp.text
    token = client.post("/auth/login", json={"phone": phone, "password": "password123"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def two_businesses(client):
    a = signup(client, "03110000001", "Aslam", "Aslam Traders")
    b = signup(client, "03110000002", "Bashir", "Bashir Wholesale")
    supplier = client.post("/parties", headers=a, json={"name": "A Supplier", "type": "supplier"}).json()
    customer = client.post("/parties", headers=a, json={"name": "A Secret Customer", "type": "customer",
                                                         "phone": "03001234567"}).json()
    product = client.post("/products", headers=a, json={"sku": "SKU-1", "name": "A Rice Bag", "cost_price": 100,
                                                         "sale_price": 150, "min_stock_level": 50}).json()
    purchase = client.post("/purchase-orders", headers=a, json={
        "party_id": supplier["id"], "date": str(date.today()), "ledger_method": "udhaar",
        "items": [{"product_id": product["id"], "qty": 10, "unit_price": 100}]}).json()
    sale = client.post("/sale-orders", headers=a, json={
        "party_id": customer["id"], "date": str(date.today()), "ledger_method": "udhaar",
        "items": [{"product_id": product["id"], "qty": 4, "unit_price": 150}]}).json()
    return {"a": a, "b": b, "supplier": supplier, "customer": customer, "product": product,
            "purchase": purchase, "sale": sale}


def test_lists_are_empty_for_the_other_business(client, two_businesses):
    b = two_businesses["b"]
    for path in ["/parties", "/products", "/sale-orders", "/purchase-orders", "/ledger/balances"]:
        resp = client.get(path, headers=b)
        assert resp.status_code == 200
        assert resp.json() == [], path
    assert client.get("/parties?q=Secret", headers=b).json() == []


def test_direct_ids_are_not_found_across_businesses(client, two_businesses):
    t, b = two_businesses, two_businesses["b"]
    for path in [
        f"/parties/{t['customer']['id']}",
        f"/products/{t['product']['id']}",
        f"/sale-orders/{t['sale']['id']}",
        f"/purchase-orders/{t['purchase']['id']}",
        f"/ledger/parties/{t['customer']['id']}/balance",
        f"/reports/party-statement/{t['customer']['id']}",
        f"/reports/party-statement/{t['customer']['id']}/pdf",
    ]:
        assert client.get(path, headers=b).status_code == 404, path
    assert client.get(f"/ledger/parties/{t['customer']['id']}", headers=b).json() == []


def test_writes_cannot_touch_another_business(client, two_businesses):
    t, b = two_businesses, two_businesses["b"]
    assert client.patch(f"/parties/{t['customer']['id']}", headers=b, json={"name": "Hacked"}).status_code == 404
    assert client.delete(f"/parties/{t['customer']['id']}", headers=b).status_code == 404
    assert client.patch(f"/products/{t['product']['id']}", headers=b, json={"cost_price": 1}).status_code == 404
    assert client.post(f"/sale-orders/{t['sale']['id']}/void", headers=b, json={"reason": "not mine"}).status_code == 404
    # Paying off A's customer from B's books: A's party does not exist for B.
    resp = client.post("/ledger/entries", headers=b, json={"party_id": t["customer"]["id"], "date": str(date.today()),
                                                           "type": "credit", "amount": 600, "method": "cash"})
    assert resp.status_code == 400
    # Selling A's stock to B's own customer: A's product does not exist for B.
    own = client.post("/parties", headers=b, json={"name": "B Customer", "type": "customer"}).json()
    resp = client.post("/sale-orders", headers=b, json={"party_id": own["id"], "date": str(date.today()),
        "ledger_method": "cash", "items": [{"product_id": t["product"]["id"], "qty": 1, "unit_price": 1}]})
    assert resp.status_code == 400

    a = t["a"]
    assert client.get(f"/parties/{t['customer']['id']}", headers=a).json()["name"] == "A Secret Customer"
    assert client.get(f"/products/{t['product']['id']}", headers=a).json()["current_stock"] == 6
    assert client.get(f"/ledger/parties/{t['customer']['id']}/balance", headers=a).json()["balance"] == 600


def test_same_sku_is_allowed_in_different_businesses(client, two_businesses):
    b = two_businesses["b"]
    resp = client.post("/products", headers=b, json={"sku": "SKU-1", "name": "B Rice Bag"})
    assert resp.status_code == 201
    dup = client.post("/products", headers=b, json={"sku": "SKU-1", "name": "Duplicate"})
    assert dup.status_code == 400


def test_dashboard_collections_and_reports_are_scoped(client, two_businesses):
    b = two_businesses["b"]
    dash = client.get("/dashboard", headers=b).json()
    assert dash["total_receivables"] == 0 and dash["total_payables"] == 0
    assert dash["stock_alerts"] == [] and dash["top_udhaar_exposure"] == []
    assert client.get("/collections", headers=b).json()["customers"] == []
    assert "A Rice Bag" not in client.get("/reports/daily-summary", headers=b).json()["text"]

    a_dash = client.get("/dashboard", headers=two_businesses["a"]).json()
    assert a_dash["total_receivables"] == 600
    assert a_dash["top_udhaar_exposure"][0]["party_name"] == "A Secret Customer"


def test_munshi_only_reads_the_callers_business(client, two_businesses):
    b = two_businesses["b"]
    answer = client.post("/agent/ask", headers=b, json={"question": "Who owes me money and what should I reorder?"}).json()
    assert answer["tools_called"]
    assert "A Secret Customer" not in answer["answer"]
    assert "A Rice Bag" not in answer["answer"]

    a_answer = client.post("/agent/ask", headers=two_businesses["a"], json={"question": "What should I reorder?"}).json()
    assert "A Rice Bag" in a_answer["answer"]


def test_me_reports_the_business(client, two_businesses):
    me = client.get("/auth/me", headers=two_businesses["b"]).json()
    assert me["business_name"] == "Bashir Wholesale"
    assert me["role"] == "owner"


def test_signup_cannot_choose_a_role_or_join_another_business(client):
    resp = client.post("/auth/register", json={"name": "X", "phone": "03119999999", "password": "password123",
                                               "role": "munshi", "tenant_id": "someone-else"})
    assert resp.status_code == 201
    assert resp.json()["role"] == "owner"
    token = client.post("/auth/login", json={"phone": "03119999999", "password": "password123"}).json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert me["business_id"] != "someone-else"


def test_scoped_session_refuses_rows_for_another_business(db_session):
    scope_session(db_session, "business-b")
    db_session.add(Party(name="Smuggled", type="customer", tenant_id="business-a"))
    with pytest.raises(TenantViolation):
        db_session.flush()
    db_session.rollback()


def test_scoped_session_get_cannot_load_another_business_row(db_session):
    party = Party(name="Owned by A", type="customer", tenant_id="business-a")
    db_session.add(party)
    db_session.commit()
    party_id = party.id
    db_session.expunge_all()

    scope_session(db_session, "business-b")
    assert db_session.get(Party, party_id) is None
    assert db_session.query(Party).count() == 0


def test_a_session_cannot_be_rescoped_to_a_different_business(db_session):
    scope_session(db_session, "business-a")
    with pytest.raises(TenantViolation):
        scope_session(db_session, "business-b")
