"""Purchase & Sale order creation - ties order items to stock movements.

A purchase order INCREASES stock (goods coming in); a sale order
DECREASES stock (goods going out). Each order's `total` is derived from
its line items, never taken from client input.
"""

from datetime import date as date_type

from sqlalchemy.orm import Session

from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.sale_order import SaleOrder, SaleOrderItem
from app.services import stock_service


def create_purchase_order(db: Session, *, party_id: str, order_date: date_type, items: list[dict]) -> PurchaseOrder:
    order = PurchaseOrder(party_id=party_id, date=order_date, status="draft", total=0.0)
    db.add(order)
    db.flush()

    total = 0.0
    for item in items:
        line_total = item["qty"] * item["unit_price"]
        total += line_total
        db.add(
            PurchaseOrderItem(
                order_id=order.id,
                product_id=item["product_id"],
                qty=item["qty"],
                unit_price=item["unit_price"],
                line_total=line_total,
            )
        )
        stock_service.record_movement(
            db,
            product_id=item["product_id"],
            qty_delta=item["qty"],          # purchase INCREASES stock
            reason="purchase",
            ref_order_id=order.id,
            movement_date=order_date,
        )

    order.total = total
    order.status = "received"
    db.flush()
    return order


def create_sale_order(db: Session, *, party_id: str, order_date: date_type, items: list[dict]) -> SaleOrder:
    order = SaleOrder(party_id=party_id, date=order_date, status="draft", total=0.0)
    db.add(order)
    db.flush()

    total = 0.0
    for item in items:
        line_total = item["qty"] * item["unit_price"]
        total += line_total
        db.add(
            SaleOrderItem(
                order_id=order.id,
                product_id=item["product_id"],
                qty=item["qty"],
                unit_price=item["unit_price"],
                line_total=line_total,
            )
        )
        stock_service.record_movement(
            db,
            product_id=item["product_id"],
            qty_delta=-item["qty"],         # sale DECREASES stock
            reason="sale",
            ref_order_id=order.id,
            movement_date=order_date,
        )

    order.total = total
    order.status = "delivered"
    db.flush()
    return order
