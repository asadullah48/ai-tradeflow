"""Purchase & Sale order creation - ties order items to stock movements.

A purchase order INCREASES stock (goods coming in); a sale order
DECREASES stock (goods going out). Each order's `total` is derived from
its line items, never taken from client input.
"""

from datetime import date as date_type
from decimal import Decimal, ROUND_HALF_UP
import math
from collections import defaultdict

from sqlalchemy.orm import Session

from app.models.party import Party
from app.models.product import Product
from app.services import ledger_service
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.sale_order import SaleOrder, SaleOrderItem
from app.services import stock_service


def create_purchase_order(db: Session, *, party_id: str, order_date: date_type, items: list[dict], ledger_method: str | None = None, created_by: str | None = None) -> PurchaseOrder:
    _validate_order(db, party_id, items, sale=False)
    order = PurchaseOrder(party_id=party_id, date=order_date, status="draft", total=0.0)
    db.add(order)
    db.flush()

    total = 0.0
    for item in items:
        line_total = float((Decimal(str(item["qty"])) * Decimal(str(item["unit_price"]))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
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

    order.total = round(total, 2)
    order.status = "received"
    _post_ledger(db, order, sale=False, method=ledger_method, created_by=created_by)
    db.flush()
    return order


def create_sale_order(db: Session, *, party_id: str, order_date: date_type, items: list[dict], ledger_method: str | None = None, created_by: str | None = None) -> SaleOrder:
    _validate_order(db, party_id, items, sale=True)
    order = SaleOrder(party_id=party_id, date=order_date, status="draft", total=0.0)
    db.add(order)
    db.flush()

    total = 0.0
    for item in items:
        line_total = float((Decimal(str(item["qty"])) * Decimal(str(item["unit_price"]))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
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

    order.total = round(total, 2)
    order.status = "delivered"
    _post_ledger(db, order, sale=True, method=ledger_method, created_by=created_by)
    db.flush()
    return order


def _validate_order(db: Session, party_id: str, items: list[dict], *, sale: bool) -> None:
    party = db.get(Party, party_id)
    if party is None:
        raise ValueError("Party not found")
    allowed = {"customer", "both"} if sale else {"supplier", "both"}
    if party.type not in allowed:
        raise ValueError("Choose a customer for sales or a supplier for purchases")
    if not items:
        raise ValueError("An order needs at least one item")
    requested = defaultdict(float)
    for item in items:
        qty, price = item["qty"], item["unit_price"]
        if not math.isfinite(qty) or not math.isfinite(price) or qty <= 0 or price < 0:
            raise ValueError("Quantity must be positive and price must not be negative")
        requested[item["product_id"]] += qty
    # Stable lock order avoids deadlocks for orders with the same SKUs.
    for product_id in sorted(requested):
        product = db.query(Product).filter(Product.id == product_id).with_for_update().first()
        if product is None:
            raise ValueError("Product not found")
        if sale and requested[product_id] > product.current_stock:
            raise ValueError(f"Insufficient stock for {product.name}")


def _post_ledger(db: Session, order, *, sale: bool, method: str | None, created_by: str | None) -> None:
    # Omitted method preserves legacy API callers that post their own ledger.
    if method is None or order.total == 0:
        return
    direction = "debit" if sale else "credit"
    ledger_service.record_entry(db, party_id=order.party_id, entry_date=order.date,
        entry_type=direction, amount=order.total, method="udhaar", ref_order_id=order.id,
        created_by=created_by, note="Sale invoice" if sale else "Purchase invoice")
    if method != "udhaar":
        ledger_service.record_entry(db, party_id=order.party_id, entry_date=order.date,
            entry_type="credit" if sale else "debit", amount=order.total, method=method,
            ref_order_id=order.id, created_by=created_by, note="Invoice settled on posting")
        order.status = "paid"
