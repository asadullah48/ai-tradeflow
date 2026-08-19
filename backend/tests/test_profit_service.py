from datetime import date

from app.models.party import Party
from app.models.product import Product
from app.services import order_service, profit_service


def test_profit_summary_computes_revenue_cost_and_profit(db_session):
    party = Party(name="Customer", type="customer")
    db_session.add(party)
    product = Product(sku="P-1", name="Profit Widget", unit="piece", cost_price=100, sale_price=150, current_stock=1000)
    db_session.add(product)
    db_session.flush()

    order_service.create_sale_order(db_session, party_id=party.id, order_date=date.today(), items=[{"product_id": product.id, "qty": 10, "unit_price": 150}])

    summary = profit_service.get_profit_summary(db_session, start=date.today(), end=date.today())
    assert summary["revenue"] == 1500
    assert summary["cost"] == 1000
    assert summary["profit"] == 500


def test_profit_summary_excludes_orders_outside_range(db_session):
    party = Party(name="Customer", type="customer")
    db_session.add(party)
    product = Product(sku="P-2", name="Out of range Widget", unit="piece", cost_price=100, sale_price=150, current_stock=1000)
    db_session.add(product)
    db_session.flush()

    from datetime import timedelta
    old_date = date.today() - timedelta(days=60)
    order_service.create_sale_order(db_session, party_id=party.id, order_date=old_date, items=[{"product_id": product.id, "qty": 10, "unit_price": 150}])

    summary = profit_service.get_profit_summary(db_session, start=date.today(), end=date.today())
    assert summary["revenue"] == 0


def test_profit_summary_by_product_breakdown(db_session):
    party = Party(name="Customer", type="customer")
    db_session.add(party)
    a = Product(sku="A", name="Widget A", unit="piece", cost_price=10, sale_price=20, current_stock=1000)
    b = Product(sku="B", name="Widget B", unit="piece", cost_price=5, sale_price=15, current_stock=1000)
    db_session.add_all([a, b])
    db_session.flush()

    order_service.create_sale_order(
        db_session, party_id=party.id, order_date=date.today(),
        items=[{"product_id": a.id, "qty": 10, "unit_price": 20}, {"product_id": b.id, "qty": 5, "unit_price": 15}],
    )

    summary = profit_service.get_profit_summary(db_session, start=date.today(), end=date.today())
    assert summary["by_product"]["Widget A"]["profit"] == 100
    assert summary["by_product"]["Widget B"]["profit"] == 50
