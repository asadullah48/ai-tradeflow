"""Sales velocity and reorder recommendations - the logic behind Munshi
AI's "what should I order this week?" answer. Pure, deterministic
arithmetic; the LLM only narrates these numbers, never computes them.
"""

from dataclasses import dataclass
from datetime import date as date_type, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.sale_order import SaleOrder, SaleOrderItem

DEFAULT_LEAD_TIME_DAYS = 7
DEFAULT_SAFETY_STOCK_DAYS = 3


@dataclass
class VelocityResult:
    product_id: str
    product_name: str
    unit: str
    days: int
    qty_sold: float
    velocity_per_day: float
    current_stock: float
    recommended_reorder_qty: float


def get_sales_velocity(
    db: Session,
    *,
    product_id: str | None = None,
    days: int = 30,
    as_of: date_type | None = None,
) -> list[VelocityResult]:
    as_of = as_of or date_type.today()
    since = as_of - timedelta(days=days)

    products_stmt = select(Product)
    if product_id:
        products_stmt = products_stmt.where(Product.id == product_id)
    products = db.execute(products_stmt).scalars().all()

    results = []
    for product in products:
        qty_stmt = (
            select(SaleOrderItem.qty, SaleOrder.date)
            .join(SaleOrder, SaleOrder.id == SaleOrderItem.order_id)
            .where(SaleOrderItem.product_id == product.id, SaleOrder.date >= since, SaleOrder.date <= as_of)
        )
        rows = db.execute(qty_stmt).all()
        qty_sold = sum(row.qty for row in rows)
        velocity = qty_sold / days if days > 0 else 0.0

        demand_during_lead_time = velocity * DEFAULT_LEAD_TIME_DAYS
        safety_stock = velocity * DEFAULT_SAFETY_STOCK_DAYS
        reorder_point = demand_during_lead_time + safety_stock
        recommended = max(0.0, reorder_point - product.current_stock)

        results.append(
            VelocityResult(
                product_id=product.id,
                product_name=product.name,
                unit=product.unit,
                days=days,
                qty_sold=qty_sold,
                velocity_per_day=round(velocity, 3),
                current_stock=product.current_stock,
                recommended_reorder_qty=round(recommended, 2),
            )
        )
    return results


def get_fast_movers_and_dead_stock(
    db: Session, days: int = 30, dead_stock_threshold: float = 0.0
) -> tuple[list[VelocityResult], list[VelocityResult]]:
    velocities = get_sales_velocity(db, days=days)
    fast_movers = sorted([v for v in velocities if v.velocity_per_day > 0], key=lambda v: -v.velocity_per_day)
    dead_stock = [v for v in velocities if v.qty_sold <= dead_stock_threshold and v.current_stock > 0]
    return fast_movers, dead_stock
