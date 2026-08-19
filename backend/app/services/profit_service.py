"""Profit & loss summary - deterministic, derived from actual sale prices
vs. each product's recorded cost_price. Used by the dashboard and by
Munshi AI's "profit summary" question."""

from datetime import date as date_type

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.sale_order import SaleOrder, SaleOrderItem


def get_profit_summary(db: Session, *, start: date_type, end: date_type) -> dict:
    stmt = (
        select(SaleOrderItem, SaleOrder.date, Product.cost_price, Product.name)
        .join(SaleOrder, SaleOrder.id == SaleOrderItem.order_id)
        .join(Product, Product.id == SaleOrderItem.product_id)
        .where(SaleOrder.date >= start, SaleOrder.date <= end)
    )
    rows = db.execute(stmt).all()

    revenue = 0.0
    cost = 0.0
    by_product: dict[str, dict] = {}

    for item, _order_date, cost_price, product_name in rows:
        line_revenue = item.line_total
        line_cost = item.qty * cost_price
        revenue += line_revenue
        cost += line_cost

        bucket = by_product.setdefault(product_name, {"revenue": 0.0, "cost": 0.0, "qty": 0.0})
        bucket["revenue"] += line_revenue
        bucket["cost"] += line_cost
        bucket["qty"] += item.qty

    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "revenue": round(revenue, 2),
        "cost": round(cost, 2),
        "profit": round(revenue - cost, 2),
        "by_product": {
            name: {**vals, "profit": round(vals["revenue"] - vals["cost"], 2)}
            for name, vals in by_product.items()
        },
    }
