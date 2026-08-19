from datetime import date

from app.models.party import Party
from app.models.product import Product
from app.services import order_service


def setup_party_and_product(db, current_stock=0):
    party = Party(name="Trader", type="both")
    db.add(party)
    product = Product(sku="ORD-1", name="Order Widget", unit="piece", cost_price=100, sale_price=150, current_stock=current_stock)
    db.add(product)
    db.flush()
    return party, product


def test_purchase_order_increases_stock(db_session):
    party, product = setup_party_and_product(db_session, current_stock=0)
    order = order_service.create_purchase_order(
        db_session, party_id=party.id, order_date=date.today(),
        items=[{"product_id": product.id, "qty": 50, "unit_price": 100}],
    )
    assert product.current_stock == 50
    assert order.total == 5000
    assert order.status == "received"


def test_sale_order_decreases_stock(db_session):
    party, product = setup_party_and_product(db_session, current_stock=100)
    order = order_service.create_sale_order(
        db_session, party_id=party.id, order_date=date.today(),
        items=[{"product_id": product.id, "qty": 20, "unit_price": 150}],
    )
    assert product.current_stock == 80
    assert order.total == 3000
    assert order.status == "delivered"


def test_order_total_sums_multiple_items(db_session):
    party, product_a = setup_party_and_product(db_session)
    product_b = Product(sku="ORD-2", name="Second Widget", unit="piece", cost_price=50, sale_price=80, current_stock=0)
    db_session.add(product_b)
    db_session.flush()

    order = order_service.create_purchase_order(
        db_session, party_id=party.id, order_date=date.today(),
        items=[
            {"product_id": product_a.id, "qty": 10, "unit_price": 100},
            {"product_id": product_b.id, "qty": 5, "unit_price": 50},
        ],
    )
    assert order.total == 1000 + 250
    assert len(order.items) == 2


def test_full_trade_cycle_stock_ends_at_expected_value(db_session):
    """Purchase 200, sell 30 twice -> 140 remaining."""
    party, product = setup_party_and_product(db_session, current_stock=0)

    order_service.create_purchase_order(db_session, party_id=party.id, order_date=date.today(), items=[{"product_id": product.id, "qty": 200, "unit_price": 100}])
    order_service.create_sale_order(db_session, party_id=party.id, order_date=date.today(), items=[{"product_id": product.id, "qty": 30, "unit_price": 150}])
    order_service.create_sale_order(db_session, party_id=party.id, order_date=date.today(), items=[{"product_id": product.id, "qty": 30, "unit_price": 150}])

    assert product.current_stock == 140
