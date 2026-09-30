from datetime import date
import pytest
from app.models.ledger_entry import LedgerEntry
from app.models.stock_movement import StockMovement
from app.models.sale_order import SaleOrder
from tests.test_orders_ledger_api import setup_trade


def post(client, headers, kind, party, product, qty, price=100, method="udhaar"):
    return client.post(f"/{kind}-orders", headers=headers, json={
        "party_id": party["id"], "date": str(date.today()), "ledger_method": method,
        "items": [{"product_id": product["id"], "qty": qty, "unit_price": price}],
    })


def test_purchase_posts_supplier_payable_atomically(client, auth_headers):
    supplier, _, product = setup_trade(client, auth_headers)
    assert post(client, auth_headers, "purchase", supplier, product, 10).status_code == 201
    balance = client.get(f"/ledger/parties/{supplier['id']}/balance", headers=auth_headers).json()
    assert balance["balance"] == -1000
    assert client.get(f"/products/{product['id']}", headers=auth_headers).json()["current_stock"] == 10


@pytest.mark.parametrize("method", ["cash", "bank", "jazzcash", "easypaisa"])
def test_paid_purchase_has_no_outstanding_balance(client, auth_headers, method):
    supplier, _, product = setup_trade(client, auth_headers)
    response = post(client, auth_headers, "purchase", supplier, product, 10, method=method)
    assert response.json()["status"] == "paid"
    assert client.get(f"/ledger/parties/{supplier['id']}/balance", headers=auth_headers).json()["balance"] == 0
    assert len(client.get(f"/ledger/parties/{supplier['id']}", headers=auth_headers).json()) == 2


def test_sale_posts_customer_receivable_atomically(client, auth_headers):
    supplier, customer, product = setup_trade(client, auth_headers)
    post(client, auth_headers, "purchase", supplier, product, 10)
    assert post(client, auth_headers, "sale", customer, product, 2, 150).status_code == 201
    assert client.get(f"/ledger/parties/{customer['id']}/balance", headers=auth_headers).json()["balance"] == 300


def test_paid_sale_has_no_receivable(client, auth_headers):
    supplier, customer, product = setup_trade(client, auth_headers)
    post(client, auth_headers, "purchase", supplier, product, 10)
    response = post(client, auth_headers, "sale", customer, product, 2, 150, "cash")
    assert response.json()["status"] == "paid"
    assert client.get(f"/ledger/parties/{customer['id']}/balance", headers=auth_headers).json()["balance"] == 0


def test_oversell_leaves_no_order_stock_or_ledger_changes(client, auth_headers, db_session):
    supplier, customer, product = setup_trade(client, auth_headers)
    post(client, auth_headers, "purchase", supplier, product, 2)
    movements = db_session.query(StockMovement).count()
    ledgers = db_session.query(LedgerEntry).count()
    response = post(client, auth_headers, "sale", customer, product, 3)
    assert response.status_code == 400
    assert db_session.query(SaleOrder).count() == 0
    assert db_session.query(StockMovement).count() == movements
    assert db_session.query(LedgerEntry).count() == ledgers


@pytest.mark.parametrize("qty,price", [(0, 100), (-1, 100), (1, -1)])
def test_invalid_line_rejected(client, auth_headers, qty, price):
    supplier, _, product = setup_trade(client, auth_headers)
    assert post(client, auth_headers, "purchase", supplier, product, qty, price).status_code == 422


def test_missing_product_rejected_before_posting(client, auth_headers):
    supplier, _, product = setup_trade(client, auth_headers)
    product["id"] = "missing"
    assert post(client, auth_headers, "purchase", supplier, product, 1).status_code == 400
    assert client.get("/purchase-orders", headers=auth_headers).json() == []


def test_me_returns_real_identity(client, auth_headers):
    response = client.get("/auth/me", headers=auth_headers)
    assert response.json()["name"] == "Test Owner"
    assert response.json()["role"] == "owner"
    assert "password_hash" not in response.json()


def test_balances_overview_matches_individual_statements(client, auth_headers):
    supplier, customer, product = setup_trade(client, auth_headers)
    post(client, auth_headers, "purchase", supplier, product, 10)
    post(client, auth_headers, "sale", customer, product, 2, 150)
    rows = client.get("/ledger/balances", headers=auth_headers).json()
    assert len(rows) == 2
    for row in rows:
        detail = client.get(f"/ledger/parties/{row['party_id']}/balance", headers=auth_headers).json()
        assert row == detail


def test_cash_sale_does_not_rejuvenate_old_credit_debt(client, auth_headers):
    from datetime import timedelta
    supplier, customer, product = setup_trade(client, auth_headers)
    post(client, auth_headers, "purchase", supplier, product, 10)
    response = client.post("/sale-orders", headers=auth_headers, json={
        "party_id": customer["id"], "date": str(date.today() - timedelta(days=100)),
        "ledger_method": "udhaar", "items": [{"product_id": product["id"], "qty": 1, "unit_price": 150}],
    })
    assert response.status_code == 201
    assert post(client, auth_headers, "sale", customer, product, 1, 150, "cash").status_code == 201
    balance = client.get(f"/ledger/parties/{customer['id']}/balance", headers=auth_headers).json()
    assert balance["balance"] == 150
    aging = {b["label"]: b["amount"] for b in balance["aging"]}
    assert aging["90+"] == 150
    assert aging["current"] == 0
