"""Concurrency guarantees, proven against a real PostgreSQL server.

SQLite serialises writers, so it cannot show whether row locks work. These
tests run only when TEST_POSTGRES_URL points at a disposable PostgreSQL
database (CI provides one); locally they are skipped.

    TEST_POSTGRES_URL=postgresql+psycopg2://postgres@localhost/tf_test pytest tests/test_postgres_concurrency.py
"""

import os
import threading
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.database import Base
from app.models.party import Party
from app.models.product import Product
from app.models.sale_order import SaleOrder
from app.services import order_service, stock_service
from app.tenancy import scope_session

PG_URL = os.environ.get("TEST_POSTGRES_URL")
pytestmark = pytest.mark.skipif(not PG_URL, reason="TEST_POSTGRES_URL not set")


@pytest.fixture()
def pg():
    engine = create_engine(PG_URL, pool_size=20, max_overflow=5)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False)
    with Session() as s:
        scope_session(s, "biz-1")
        customer = Party(name="Walk-in", type="customer")
        supplier = Party(name="Mill", type="supplier")
        product = Product(sku="RICE", name="Rice", cost_price=100, sale_price=150)
        s.add_all([customer, supplier, product])
        s.flush()
        order_service.create_purchase_order(s, party_id=supplier.id, order_date=date.today(),
            items=[{"product_id": product.id, "qty": 5, "unit_price": 100}], ledger_method="cash")
        s.commit()
        ids = {"customer": customer.id, "product": product.id}
    yield Session, ids
    Base.metadata.drop_all(engine)
    engine.dispose()


def _run_parallel(n, fn):
    barrier = threading.Barrier(n)
    results = []
    lock = threading.Lock()

    def worker(i):
        barrier.wait()
        outcome = fn(i)
        with lock:
            results.append(outcome)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return results


def test_concurrent_sales_cannot_oversell(pg):
    Session, ids = pg

    def sell(_):
        with Session() as s:
            scope_session(s, "biz-1")
            try:
                order_service.create_sale_order(s, party_id=ids["customer"], order_date=date.today(),
                    items=[{"product_id": ids["product"], "qty": 1, "unit_price": 150}], ledger_method="cash")
                s.commit()
                return "sold"
            except ValueError:
                s.rollback()
                return "refused"

    results = _run_parallel(12, sell)
    assert results.count("sold") == 5
    assert results.count("refused") == 7
    with Session() as s:
        scope_session(s, "biz-1")
        product = s.get(Product, ids["product"])
        assert product.current_stock == 0
        assert stock_service.recompute_current_stock(s, ids["product"]) == 0


def test_concurrent_retries_with_one_idempotency_key_post_once(pg):
    Session, ids = pg

    def sell(_):
        with Session() as s:
            scope_session(s, "biz-1")
            try:
                order_service.create_sale_order(s, party_id=ids["customer"], order_date=date.today(),
                    items=[{"product_id": ids["product"], "qty": 1, "unit_price": 150}],
                    ledger_method="udhaar", idempotency_key="double-tap")
                s.commit()
                return "posted"
            except IntegrityError:
                s.rollback()
                return "duplicate"

    results = _run_parallel(6, sell)
    assert results.count("posted") == 1
    with Session() as s:
        scope_session(s, "biz-1")
        assert s.query(SaleOrder).count() == 1
        assert s.get(Product, ids["product"]).current_stock == 4


def test_business_filter_holds_on_postgres(pg):
    Session, ids = pg
    with Session() as s:
        scope_session(s, "biz-2")
        assert s.get(Product, ids["product"]) is None
        assert s.query(Party).count() == 0
