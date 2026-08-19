"""Stock movement recording and the current_stock invariant.

Invariant (SPEC §5): current_stock = opening + sum(StockMovement.qty_delta).
current_stock is a cached projection - never trust it from the client,
always derive it from movements, and keep the cache in sync on every write.
"""

from datetime import date as date_type

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.stock_movement import StockMovement


def record_movement(
    db: Session,
    *,
    product_id: str,
    qty_delta: float,
    reason: str,
    ref_order_id: str | None = None,
    movement_date: date_type | None = None,
) -> StockMovement:
    movement = StockMovement(
        product_id=product_id,
        date=movement_date or date_type.today(),
        qty_delta=qty_delta,
        reason=reason,
        ref_order_id=ref_order_id,
    )
    db.add(movement)

    product = db.get(Product, product_id)
    if product is not None:
        product.current_stock = product.current_stock + qty_delta

    db.flush()
    return movement


def recompute_current_stock(db: Session, product_id: str) -> float:
    """Recompute current_stock from scratch by summing every movement -
    the source of truth check used by tests and by a "repair" endpoint."""
    total = db.execute(
        select(StockMovement.qty_delta).where(StockMovement.product_id == product_id)
    ).scalars().all()
    stock = sum(total)

    product = db.get(Product, product_id)
    if product is not None:
        product.current_stock = stock
        db.flush()
    return stock


def get_stock_alerts(db: Session, below_min_only: bool = True) -> list[Product]:
    stmt = select(Product)
    products = db.execute(stmt).scalars().all()
    if below_min_only:
        return [p for p in products if p.current_stock < p.min_stock_level]
    return list(products)
