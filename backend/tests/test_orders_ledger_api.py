"""Integration tests: the full trade cycle, end to end through the HTTP API
- purchase -> stock up -> sale -> partial payment -> khata reflects it
correctly. This is the Session 2 checkpoint from SPEC-TRADEFLOW.md §8."""

from datetime import date


def setup_trade(client, auth_headers):
    supplier = client.post("/parties", json={"name": "Supplier", "type": "supplier"}, headers=auth_headers).json()
    customer = client.post("/parties", json={"name": "Customer", "type": "customer"}, headers=auth_headers).json()
    product = client.post(
        "/products", json={"sku": "TRADE-1", "name": "Trade Widget", "cost_price": 100, "sale_price": 150, "min_stock_level": 10},
        headers=auth_headers,
    ).json()
    return supplier, customer, product


def test_purchase_order_creates_stock_movement(client, auth_headers):
    supplier, _, product = setup_trade(client, auth_headers)
    resp = client.post(
        "/purchase-orders",
        json={"party_id": supplier["id"], "date": str(date.today()), "items": [{"product_id": product["id"], "qty": 100, "unit_price": 100}]},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["total"] == 10000

    product_after = client.get(f"/products/{product['id']}", headers=auth_headers).json()
    assert product_after["current_stock"] == 100


def test_full_trade_cycle_reflects_correctly_in_khata(client, auth_headers):
    supplier, customer, product = setup_trade(client, auth_headers)

    # 1. Purchase stock in.
    client.post(
        "/purchase-orders",
        json={"party_id": supplier["id"], "date": str(date.today()), "items": [{"product_id": product["id"], "qty": 100, "unit_price": 100}]},
        headers=auth_headers,
    )

    # 2. Sale on credit (udhaar).
    sale = client.post(
        "/sale-orders",
        json={"party_id": customer["id"], "date": str(date.today()), "items": [{"product_id": product["id"], "qty": 20, "unit_price": 150}]},
        headers=auth_headers,
    ).json()
    assert sale["total"] == 3000

    client.post(
        "/ledger/entries",
        json={"party_id": customer["id"], "date": str(date.today()), "type": "debit", "amount": 3000, "method": "udhaar", "ref_order_id": sale["id"]},
        headers=auth_headers,
    )

    # 3. Partial payment.
    client.post(
        "/ledger/entries",
        json={"party_id": customer["id"], "date": str(date.today()), "type": "credit", "amount": 1000, "method": "cash"},
        headers=auth_headers,
    )

    # 4. Khata should reflect: 3000 owed - 1000 paid = 2000 remaining.
    balance = client.get(f"/ledger/parties/{customer['id']}/balance", headers=auth_headers).json()
    assert balance["balance"] == 2000

    # 5. Stock: 100 in, 20 out = 80 remaining.
    product_after = client.get(f"/products/{product['id']}", headers=auth_headers).json()
    assert product_after["current_stock"] == 80


def test_udhaar_entry_without_order_rejected(client, auth_headers):
    _, customer, _ = setup_trade(client, auth_headers)
    resp = client.post(
        "/ledger/entries",
        json={"party_id": customer["id"], "date": str(date.today()), "type": "debit", "amount": 500, "method": "udhaar"},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_order_needs_at_least_one_item(client, auth_headers):
    supplier, _, _ = setup_trade(client, auth_headers)
    resp = client.post("/purchase-orders", json={"party_id": supplier["id"], "date": str(date.today()), "items": []}, headers=auth_headers)
    assert resp.status_code == 400


def test_dashboard_reflects_udhaar_exposure(client, auth_headers):
    supplier, customer, product = setup_trade(client, auth_headers)
    client.post(
        "/purchase-orders",
        json={"party_id": supplier["id"], "date": str(date.today()), "items": [{"product_id": product["id"], "qty": 5, "unit_price": 100}]},
        headers=auth_headers,
    )
    sale = client.post(
        "/sale-orders",
        json={"party_id": customer["id"], "date": str(date.today()), "items": [{"product_id": product["id"], "qty": 1, "unit_price": 150}]},
        headers=auth_headers,
    ).json()
    client.post(
        "/ledger/entries",
        json={"party_id": customer["id"], "date": str(date.today()), "type": "debit", "amount": 150, "method": "udhaar", "ref_order_id": sale["id"]},
        headers=auth_headers,
    )

    dashboard = client.get("/dashboard", headers=auth_headers).json()
    assert dashboard["total_receivables"] == 150
    assert dashboard["todays_sales_total"] == 150
    assert any(alert["product_id"] == product["id"] for alert in dashboard["stock_alerts"])  # 4 left < min 10
