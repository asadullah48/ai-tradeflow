"""Additional coverage: edge cases not exercised elsewhere - payable
balances, order status updates, listing endpoints, and repair flows."""

from datetime import date

from app.models.party import Party
from app.services import ledger_service


def test_negative_balance_means_payable(db_session):
    party = Party(name="Owed Supplier", type="supplier", opening_balance=-2000)
    db_session.add(party)
    db_session.flush()
    assert ledger_service.get_party_balance(db_session, party.id) == -2000


def test_list_sale_orders_endpoint(client, auth_headers):
    customer = client.post("/parties", json={"name": "List Customer", "type": "customer"}, headers=auth_headers).json()
    product = client.post("/products", json={"sku": "LIST-1", "name": "List Widget"}, headers=auth_headers).json()
    client.post(
        "/sale-orders",
        json={"party_id": customer["id"], "date": str(date.today()), "items": [{"product_id": product["id"], "qty": 1, "unit_price": 10}]},
        headers=auth_headers,
    )
    resp = client.get("/sale-orders", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_list_purchase_orders_endpoint(client, auth_headers):
    supplier = client.post("/parties", json={"name": "List Supplier", "type": "supplier"}, headers=auth_headers).json()
    product = client.post("/products", json={"sku": "LIST-2", "name": "List Widget 2"}, headers=auth_headers).json()
    client.post(
        "/purchase-orders",
        json={"party_id": supplier["id"], "date": str(date.today()), "items": [{"product_id": product["id"], "qty": 1, "unit_price": 10}]},
        headers=auth_headers,
    )
    resp = client.get("/purchase-orders", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_update_sale_order_status(client, auth_headers):
    customer = client.post("/parties", json={"name": "Status Customer", "type": "customer"}, headers=auth_headers).json()
    product = client.post("/products", json={"sku": "STATUS-1", "name": "Status Widget"}, headers=auth_headers).json()
    order = client.post(
        "/sale-orders",
        json={"party_id": customer["id"], "date": str(date.today()), "items": [{"product_id": product["id"], "qty": 1, "unit_price": 10}]},
        headers=auth_headers,
    ).json()

    resp = client.patch(f"/sale-orders/{order['id']}/status", json={"status": "paid"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"


def test_get_purchase_order_not_found(client, auth_headers):
    resp = client.get("/purchase-orders/does-not-exist", headers=auth_headers)
    assert resp.status_code == 404


def test_get_sale_order_not_found(client, auth_headers):
    resp = client.get("/sale-orders/does-not-exist", headers=auth_headers)
    assert resp.status_code == 404


def test_product_update_endpoint(client, auth_headers):
    product = client.post("/products", json={"sku": "UPD-1", "name": "Old Name", "sale_price": 100}, headers=auth_headers).json()
    resp = client.patch(f"/products/{product['id']}", json={"name": "New Name", "sale_price": 150}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "New Name"
    assert body["sale_price"] == 150


def test_product_search_by_sku(client, auth_headers):
    client.post("/products", json={"sku": "FINDME-123", "name": "Findable Widget"}, headers=auth_headers)
    resp = client.get("/products?q=FINDME", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_stock_recompute_repairs_drifted_cache(client, auth_headers):
    supplier = client.post("/parties", json={"name": "Repair Supplier", "type": "supplier"}, headers=auth_headers).json()
    product = client.post("/products", json={"sku": "REPAIR-1", "name": "Repair Widget"}, headers=auth_headers).json()
    client.post(
        "/purchase-orders",
        json={"party_id": supplier["id"], "date": str(date.today()), "items": [{"product_id": product["id"], "qty": 40, "unit_price": 10}]},
        headers=auth_headers,
    )
    resp = client.post(f"/products/{product['id']}/recompute-stock", headers=auth_headers)
    assert resp.json()["current_stock"] == 40


def test_ledger_party_history_ordered_by_date(client, auth_headers):
    customer = client.post("/parties", json={"name": "History Customer", "type": "customer"}, headers=auth_headers).json()
    client.post("/ledger/entries", json={"party_id": customer["id"], "date": "2026-06-01", "type": "debit", "amount": 100, "method": "cash"}, headers=auth_headers)
    client.post("/ledger/entries", json={"party_id": customer["id"], "date": "2026-01-01", "type": "debit", "amount": 50, "method": "cash"}, headers=auth_headers)

    resp = client.get(f"/ledger/parties/{customer['id']}", headers=auth_headers)
    entries = resp.json()
    assert entries[0]["date"] == "2026-01-01"
    assert entries[1]["date"] == "2026-06-01"


def test_balance_endpoint_for_missing_party_404s(client, auth_headers):
    resp = client.get("/ledger/parties/does-not-exist/balance", headers=auth_headers)
    assert resp.status_code == 404
