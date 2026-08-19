from datetime import date, timedelta

from app.models.party import Party
from app.models.product import Product
from app.services import order_service, velocity_service


def setup_customer_and_product(db, min_stock_level=10, current_stock=0):
    customer = Party(name="Customer", type="customer")
    db.add(customer)
    product = Product(sku="V-1", name="Velocity Widget", unit="piece", cost_price=10, sale_price=20,
                       min_stock_level=min_stock_level, current_stock=current_stock)
    db.add(product)
    db.flush()
    return customer, product


def test_velocity_zero_with_no_sales(db_session):
    _, product = setup_customer_and_product(db_session)
    results = velocity_service.get_sales_velocity(db_session, product_id=product.id, days=30)
    assert results[0].velocity_per_day == 0
    assert results[0].qty_sold == 0


def test_velocity_computed_from_recent_sales(db_session):
    customer, product = setup_customer_and_product(db_session, current_stock=1000)
    order_service.create_sale_order(db_session, party_id=customer.id, order_date=date.today(), items=[{"product_id": product.id, "qty": 30, "unit_price": 20}])

    results = velocity_service.get_sales_velocity(db_session, product_id=product.id, days=30)
    assert results[0].qty_sold == 30
    assert results[0].velocity_per_day == 1.0


def test_velocity_ignores_sales_outside_window(db_session):
    customer, product = setup_customer_and_product(db_session, current_stock=1000)
    old_date = date.today() - timedelta(days=100)
    order_service.create_sale_order(db_session, party_id=customer.id, order_date=old_date, items=[{"product_id": product.id, "qty": 50, "unit_price": 20}])

    results = velocity_service.get_sales_velocity(db_session, product_id=product.id, days=30)
    assert results[0].qty_sold == 0


def test_reorder_recommendation_zero_when_stock_is_high(db_session):
    customer, product = setup_customer_and_product(db_session, current_stock=10000)
    order_service.create_sale_order(db_session, party_id=customer.id, order_date=date.today(), items=[{"product_id": product.id, "qty": 5, "unit_price": 20}])

    results = velocity_service.get_sales_velocity(db_session, product_id=product.id, days=30)
    assert results[0].recommended_reorder_qty == 0


def test_reorder_recommendation_positive_when_stock_is_low(db_session):
    customer, product = setup_customer_and_product(db_session, current_stock=0)
    order_service.create_sale_order(db_session, party_id=customer.id, order_date=date.today(), items=[{"product_id": product.id, "qty": 30, "unit_price": 20}])

    results = velocity_service.get_sales_velocity(db_session, product_id=product.id, days=30)
    assert results[0].recommended_reorder_qty > 0


def test_fast_movers_and_dead_stock_split(db_session):
    customer = Party(name="Customer", type="customer")
    db_session.add(customer)
    fast = Product(sku="FAST", name="Fast Mover", unit="piece", cost_price=10, sale_price=20, current_stock=1000)
    dead = Product(sku="DEAD", name="Dead Stock", unit="piece", cost_price=10, sale_price=20, current_stock=1000)
    db_session.add_all([fast, dead])
    db_session.flush()

    order_service.create_sale_order(db_session, party_id=customer.id, order_date=date.today(), items=[{"product_id": fast.id, "qty": 100, "unit_price": 20}])

    fast_movers, dead_stock = velocity_service.get_fast_movers_and_dead_stock(db_session, days=30)

    assert any(v.product_id == fast.id for v in fast_movers)
    assert any(v.product_id == dead.id for v in dead_stock)
