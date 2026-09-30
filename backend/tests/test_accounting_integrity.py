"""Accounting guarantees added for v1.2: cost snapshots, exact money,
idempotent posting, void-by-reversal, credit limits, party deletion,
team roles, the collections desk and production start-up guards."""

from datetime import date, timedelta

import pytest

from app.config import Settings
from app.main import check_production_settings
from app.services import collections_service
from tests.test_business_isolation import signup


def make(client, headers, *, credit_limit=0):
    supplier = client.post("/parties", headers=headers, json={"name": "Supplier", "type": "supplier"}).json()
    customer = client.post("/parties", headers=headers, json={"name": "Rehman Store", "type": "customer",
                                                               "phone": "0300-1234567", "credit_limit": credit_limit}).json()
    product = client.post("/products", headers=headers, json={"sku": "RICE", "name": "Rice Bag", "cost_price": 0,
                                                               "sale_price": 150}).json()
    return supplier, customer, product


def order(client, headers, kind, party, product, qty, price, method="udhaar", day=None, key=None, **extra):
    h = dict(headers)
    if key:
        h["Idempotency-Key"] = key
    return client.post(f"/{kind}-orders", headers=h, json={
        "party_id": party["id"], "date": str(day or date.today()), "ledger_method": method,
        "items": [{"product_id": product["id"], "qty": qty, "unit_price": price}], **extra,
    })


def balance(client, headers, party):
    return client.get(f"/ledger/parties/{party['id']}/balance", headers=headers).json()["balance"]


def stock(client, headers, product):
    return client.get(f"/products/{product['id']}", headers=headers).json()["current_stock"]


# --- weighted-average cost & historical profit -------------------------------------------

def test_purchases_reaverage_cost_and_sales_snapshot_it(client, auth_headers):
    supplier, customer, product = make(client, auth_headers)
    order(client, auth_headers, "purchase", supplier, product, 10, 100)
    order(client, auth_headers, "purchase", supplier, product, 10, 200)
    assert client.get(f"/products/{product['id']}", headers=auth_headers).json()["cost_price"] == 150

    sale = order(client, auth_headers, "sale", customer, product, 4, 250, "cash").json()
    assert sale["items"][0]["unit_cost"] == 150


def test_changing_cost_today_does_not_rewrite_yesterdays_profit(client, auth_headers):
    from app.agent.tools import get_profit_summary
    supplier, customer, product = make(client, auth_headers)
    yesterday = date.today() - timedelta(days=1)
    order(client, auth_headers, "purchase", supplier, product, 10, 100, day=yesterday)
    order(client, auth_headers, "sale", customer, product, 2, 150, "cash", day=yesterday)
    before = get_profit_summary(start=str(yesterday), end=str(yesterday))
    assert before["profit"] == 100

    client.patch(f"/products/{product['id']}", headers=auth_headers, json={"cost_price": 999})
    after = get_profit_summary(start=str(yesterday), end=str(yesterday))
    assert after["profit"] == before["profit"] == 100


def test_money_is_exact_to_the_paisa(client, auth_headers):
    supplier, customer, product = make(client, auth_headers)
    resp = client.post("/purchase-orders", headers=auth_headers, json={
        "party_id": supplier["id"], "date": str(date.today()), "ledger_method": "udhaar",
        "items": [{"product_id": product["id"], "qty": 3, "unit_price": 33.33},
                  {"product_id": product["id"], "qty": 1, "unit_price": 0.1},
                  {"product_id": product["id"], "qty": 1, "unit_price": 0.2}]}).json()
    assert resp["total"] == 100.29
    assert balance(client, auth_headers, supplier) == -100.29


# --- idempotency ---------------------------------------------------------------------------

def test_retried_sale_with_same_key_posts_once(client, auth_headers):
    supplier, customer, product = make(client, auth_headers)
    order(client, auth_headers, "purchase", supplier, product, 10, 100)
    first = order(client, auth_headers, "sale", customer, product, 2, 150, key="tap-123")
    second = order(client, auth_headers, "sale", customer, product, 2, 150, key="tap-123")
    assert first.status_code == 201
    assert second.status_code == 200
    assert second.headers["Idempotent-Replay"] == "true"
    assert second.json()["id"] == first.json()["id"]
    assert stock(client, auth_headers, product) == 8
    assert balance(client, auth_headers, customer) == 300
    assert len(client.get("/sale-orders", headers=auth_headers).json()) == 1


def test_idempotency_keys_are_per_business(client, auth_headers):
    supplier, customer, product = make(client, auth_headers)
    order(client, auth_headers, "purchase", supplier, product, 5, 100, key="shared-key")
    other = signup(client, "03120000000", "Other", "Other Co")
    s2, _, p2 = make(client, other)
    resp = order(client, other, "purchase", s2, p2, 5, 100, key="shared-key")
    assert resp.status_code == 201
    assert stock(client, other, p2) == 5


def test_retried_payment_with_same_key_records_once(client, auth_headers):
    supplier, customer, product = make(client, auth_headers)
    order(client, auth_headers, "purchase", supplier, product, 10, 100)
    order(client, auth_headers, "sale", customer, product, 2, 150)
    h = {**auth_headers, "Idempotency-Key": "pay-1"}
    body = {"party_id": customer["id"], "date": str(date.today()), "type": "credit", "amount": 100, "method": "cash"}
    assert client.post("/ledger/entries", headers=h, json=body).status_code == 201
    assert client.post("/ledger/entries", headers=h, json=body).status_code == 200
    assert balance(client, auth_headers, customer) == 200


# --- void by reversal ----------------------------------------------------------------------

def test_void_sale_reverses_stock_khata_and_profit(client, auth_headers):
    from app.agent.tools import get_profit_summary
    supplier, customer, product = make(client, auth_headers)
    order(client, auth_headers, "purchase", supplier, product, 10, 100)
    sale = order(client, auth_headers, "sale", customer, product, 3, 150).json()
    assert balance(client, auth_headers, customer) == 450

    resp = client.post(f"/sale-orders/{sale['id']}/void", headers=auth_headers, json={"reason": "Wrong customer"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "void" and resp.json()["void_reason"] == "Wrong customer"
    assert stock(client, auth_headers, product) == 10
    assert balance(client, auth_headers, customer) == 0
    aging = client.get(f"/ledger/parties/{customer['id']}/balance", headers=auth_headers).json()["aging"]
    assert all(b["amount"] == 0 for b in aging)
    # History is preserved: invoice + reversal both visible.
    assert len(client.get(f"/ledger/parties/{customer['id']}", headers=auth_headers).json()) == 2
    assert get_profit_summary()["revenue"] == 0

    again = client.post(f"/sale-orders/{sale['id']}/void", headers=auth_headers, json={"reason": "twice"})
    assert again.status_code == 409


def test_void_cash_sale_reverses_both_invoice_and_settlement(client, auth_headers):
    supplier, customer, product = make(client, auth_headers)
    order(client, auth_headers, "purchase", supplier, product, 10, 100, "bank")
    sale = order(client, auth_headers, "sale", customer, product, 2, 150, "cash").json()
    client.post(f"/sale-orders/{sale['id']}/void", headers=auth_headers, json={"reason": "Returned"})
    assert balance(client, auth_headers, customer) == 0
    assert len(client.get(f"/ledger/parties/{customer['id']}", headers=auth_headers).json()) == 4


def test_cannot_void_a_purchase_whose_goods_were_sold(client, auth_headers):
    supplier, customer, product = make(client, auth_headers)
    purchase = order(client, auth_headers, "purchase", supplier, product, 5, 100).json()
    order(client, auth_headers, "sale", customer, product, 3, 150)
    resp = client.post(f"/purchase-orders/{purchase['id']}/void", headers=auth_headers, json={"reason": "oops"})
    assert resp.status_code == 409
    assert stock(client, auth_headers, product) == 2


def test_void_unsold_purchase_restores_stock_cost_and_payable(client, auth_headers):
    supplier, customer, product = make(client, auth_headers)
    order(client, auth_headers, "purchase", supplier, product, 10, 100)
    wrong = order(client, auth_headers, "purchase", supplier, product, 10, 200).json()
    resp = client.post(f"/purchase-orders/{wrong['id']}/void", headers=auth_headers, json={"reason": "Wrong price"})
    assert resp.status_code == 200
    assert stock(client, auth_headers, product) == 10
    assert client.get(f"/products/{product['id']}", headers=auth_headers).json()["cost_price"] == 100
    assert balance(client, auth_headers, supplier) == -1000


# --- credit limit ------------------------------------------------------------------------

def test_udhaar_sale_over_credit_limit_is_refused_with_details(client, auth_headers):
    supplier, customer, product = make(client, auth_headers, credit_limit=500)
    order(client, auth_headers, "purchase", supplier, product, 10, 100)
    assert order(client, auth_headers, "sale", customer, product, 3, 150).status_code == 201  # 450 <= 500
    resp = order(client, auth_headers, "sale", customer, product, 1, 150)                      # 600 > 500
    assert resp.status_code == 409
    detail = resp.json()["detail"]
    assert detail["code"] == "credit_limit_exceeded"
    assert detail["available"] == 50
    assert stock(client, auth_headers, product) == 7

    # Paying cash is always allowed; an owner may approve an override, and it is recorded.
    assert order(client, auth_headers, "sale", customer, product, 1, 150, "cash").status_code == 201
    over = order(client, auth_headers, "sale", customer, product, 1, 150, override_credit_limit=True)
    assert over.status_code == 201
    notes = [e["note"] for e in client.get(f"/ledger/parties/{customer['id']}", headers=auth_headers).json()]
    assert any(n and "override approved" in n for n in notes)


# --- roles -------------------------------------------------------------------------------

def test_staff_can_trade_but_owner_keeps_control(client, auth_headers):
    supplier, customer, product = make(client, auth_headers, credit_limit=100)
    resp = client.post("/team", headers=auth_headers, json={"name": "Kashif", "phone": "03005550000",
                                                             "password": "munshi12345"})
    assert resp.status_code == 201 and resp.json()["role"] == "munshi"
    token = client.post("/auth/login", json={"phone": "03005550000", "password": "munshi12345"}).json()["access_token"]
    staff = {"Authorization": f"Bearer {token}"}

    # Same business, same books.
    assert len(client.get("/parties", headers=staff).json()) == 2
    purchase = order(client, staff, "purchase", supplier, product, 5, 100)
    assert purchase.status_code == 201

    assert client.post(f"/purchase-orders/{purchase.json()['id']}/void", headers=staff,
                       json={"reason": "staff try"}).status_code == 403
    assert order(client, staff, "sale", customer, product, 1, 150, override_credit_limit=True).status_code == 403
    assert client.delete(f"/parties/{customer['id']}", headers=staff).status_code == 403
    assert client.post("/team", headers=staff, json={"name": "X", "phone": "03005550001",
                                                      "password": "password123"}).status_code == 403
    assert len(client.get("/team", headers=staff).json()) == 2


def test_team_phone_clash_with_another_business_is_rejected(client, auth_headers):
    signup(client, "03130000000", "Elsewhere", "Elsewhere Co")
    resp = client.post("/team", headers=auth_headers, json={"name": "Dup", "phone": "03130000000",
                                                             "password": "password123"})
    assert resp.status_code == 400


def test_party_with_history_cannot_be_deleted(client, auth_headers):
    supplier, customer, product = make(client, auth_headers)
    order(client, auth_headers, "purchase", supplier, product, 5, 100)
    assert client.delete(f"/parties/{supplier['id']}", headers=auth_headers).status_code == 409
    assert client.get(f"/ledger/parties/{supplier['id']}", headers=auth_headers).json()


# --- collections desk --------------------------------------------------------------------

def test_collections_rank_old_debt_first_with_reasons_and_whatsapp(client, auth_headers):
    supplier, fresh, product = make(client, auth_headers)
    old = client.post("/parties", headers=auth_headers, json={"name": "Old Debtor", "type": "customer",
                                                              "phone": "03211234567"}).json()
    order(client, auth_headers, "purchase", supplier, product, 20, 100)
    order(client, auth_headers, "sale", fresh, product, 5, 150)                                    # 750, today
    order(client, auth_headers, "sale", old, product, 2, 150, day=date.today() - timedelta(days=95))  # 300, 95 days

    desk = client.get("/collections", headers=auth_headers).json()
    names = [c["party_name"] for c in desk["customers"]]
    assert names == ["Old Debtor", "Rehman Store"]
    top = desk["customers"][0]
    assert top["rank"] == 1 and top["overdue"] == 300
    assert any("90+" in r for r in top["reasons"])
    assert top["whatsapp_url"].startswith("https://wa.me/923211234567?text=")
    assert "Rs 300" in top["message"]["roman_ur"]
    assert desk["total_receivable"] == 1050


@pytest.mark.parametrize("raw,expected", [
    ("0300-1234567", "923001234567"), ("+92 300 1234567", "923001234567"),
    ("00923001234567", "923001234567"), ("12345", None), (None, None),
])
def test_whatsapp_number_normalisation(raw, expected):
    assert collections_service.whatsapp_number(raw) == expected


# --- reports & operations -----------------------------------------------------------------

def test_statement_pdf_is_a_real_pdf(client, auth_headers):
    supplier, customer, product = make(client, auth_headers)
    order(client, auth_headers, "purchase", supplier, product, 5, 100)
    resp = client.get(f"/reports/party-statement/{supplier['id']}/pdf", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.content.startswith(b"%PDF")


def test_readiness_checks_the_database(client):
    resp = client.get("/health/ready")
    assert resp.status_code == 200
    assert resp.json()["database"] == "ok"


def test_production_refuses_default_secret_and_sqlite():
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        check_production_settings(Settings(environment="production", database_url="postgresql://x/y"))
    with pytest.raises(RuntimeError, match="PostgreSQL"):
        check_production_settings(Settings(environment="production", jwt_secret="x" * 40,
                                           database_url="sqlite:///./prod.db"))
    check_production_settings(Settings(environment="production", jwt_secret="x" * 40,
                                       database_url="postgresql://x/y"))
    check_production_settings(Settings())  # development is permissive
