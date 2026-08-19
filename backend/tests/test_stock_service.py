from datetime import date

from app.models.product import Product
from app.services import stock_service


def make_product(db, **overrides):
    defaults = dict(sku="SKU-1", name="Widget", unit="piece", cost_price=10, sale_price=15, min_stock_level=5, current_stock=0)
    defaults.update(overrides)
    product = Product(**defaults)
    db.add(product)
    db.flush()
    return product


def test_record_movement_increases_stock(db_session):
    product = make_product(db_session)
    stock_service.record_movement(db_session, product_id=product.id, qty_delta=10, reason="purchase")
    assert product.current_stock == 10


def test_record_movement_decreases_stock(db_session):
    product = make_product(db_session, current_stock=20)
    stock_service.record_movement(db_session, product_id=product.id, qty_delta=-5, reason="sale")
    assert product.current_stock == 15


def test_recompute_current_stock_matches_movement_sum(db_session):
    product = make_product(db_session)
    stock_service.record_movement(db_session, product_id=product.id, qty_delta=100, reason="purchase")
    stock_service.record_movement(db_session, product_id=product.id, qty_delta=-30, reason="sale")
    stock_service.record_movement(db_session, product_id=product.id, qty_delta=-5, reason="adjustment")

    # Simulate drift, then repair it.
    product.current_stock = 999
    recomputed = stock_service.recompute_current_stock(db_session, product.id)

    assert recomputed == 65
    assert product.current_stock == 65


def test_get_stock_alerts_below_min_only(db_session):
    low = make_product(db_session, sku="LOW", current_stock=1, min_stock_level=10)
    ok = make_product(db_session, sku="OK", current_stock=50, min_stock_level=10)

    alerts = stock_service.get_stock_alerts(db_session, below_min_only=True)
    alert_ids = {p.id for p in alerts}

    assert low.id in alert_ids
    assert ok.id not in alert_ids


def test_get_stock_alerts_all_products(db_session):
    make_product(db_session, sku="A", current_stock=1, min_stock_level=10)
    make_product(db_session, sku="B", current_stock=50, min_stock_level=10)

    all_products = stock_service.get_stock_alerts(db_session, below_min_only=False)
    assert len(all_products) == 2
