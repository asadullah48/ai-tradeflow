"""Purchase & sale posting - one transaction for stock, cost and khata.

A purchase INCREASES stock and re-averages the product's cost; a sale
DECREASES stock and snapshots that cost on each line. Totals are derived
from line items with Decimal arithmetic, never taken from client input.

Posted orders are immutable. A mistake is corrected with `void_order`,
which appends reversing stock movements and reversing khata entries -
history is never edited or deleted.
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date as date_type, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
import math

from sqlalchemy.orm import Session

from app.models.ledger_entry import LedgerEntry
from app.models.party import Party
from app.models.product import Product
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.sale_order import SaleOrder, SaleOrderItem
from app.services import ledger_service, stock_service

PAISA = Decimal("0.01")


def to_money(value: float | Decimal) -> Decimal:
    return Decimal(str(value)).quantize(PAISA, rounding=ROUND_HALF_UP)


@dataclass
class CreditLimitExceeded(ValueError):
    """A udhaar sale would push the customer past their credit limit."""

    party_name: str
    balance: float
    order_total: float
    credit_limit: float

    def __str__(self) -> str:
        return (
            f"Credit limit exceeded for {self.party_name}: balance Rs {self.balance:,.0f} "
            f"+ this sale Rs {self.order_total:,.0f} is over the limit of Rs {self.credit_limit:,.0f}. "
            "Take payment now, or ask the owner to approve an override."
        )

    def detail(self) -> dict:
        return {
            "code": "credit_limit_exceeded",
            "message": str(self),
            "party_name": self.party_name,
            "balance": round(self.balance, 2),
            "order_total": round(self.order_total, 2),
            "credit_limit": round(self.credit_limit, 2),
            "available": round(max(0.0, self.credit_limit - self.balance), 2),
        }


def _line_total(item: dict) -> Decimal:
    return (Decimal(str(item["qty"])) * Decimal(str(item["unit_price"]))).quantize(PAISA, rounding=ROUND_HALF_UP)


def _order_total(items: list[dict]) -> float:
    return float(sum((_line_total(i) for i in items), Decimal("0")))


def create_purchase_order(
    db: Session, *, party_id: str, order_date: date_type, items: list[dict],
    ledger_method: str | None = None, created_by: str | None = None, idempotency_key: str | None = None,
) -> PurchaseOrder:
    products = _validate_order(db, party_id, items, sale=False)
    order = PurchaseOrder(party_id=party_id, date=order_date, status="draft", total=0.0,
                          created_by=created_by, idempotency_key=idempotency_key)
    db.add(order)
    db.flush()

    for item in items:
        product = products[item["product_id"]]
        _reaverage_cost(product, qty=item["qty"], unit_price=item["unit_price"])
        db.add(PurchaseOrderItem(order_id=order.id, product_id=product.id, qty=item["qty"],
                                 unit_price=item["unit_price"], line_total=float(_line_total(item))))
        stock_service.record_movement(db, product_id=product.id, qty_delta=item["qty"], reason="purchase",
                                      ref_order_id=order.id, movement_date=order_date)

    order.total = _order_total(items)
    order.status = "received"
    _post_ledger(db, order, sale=False, method=ledger_method, created_by=created_by)
    db.flush()
    return order


def create_sale_order(
    db: Session, *, party_id: str, order_date: date_type, items: list[dict],
    ledger_method: str | None = None, created_by: str | None = None, idempotency_key: str | None = None,
    override_credit_limit: bool = False,
) -> SaleOrder:
    products = _validate_order(db, party_id, items, sale=True)
    total = _order_total(items)
    party = db.get(Party, party_id)

    override_note = None
    if ledger_method == "udhaar" and party.credit_limit and party.credit_limit > 0:
        balance = ledger_service.get_party_balance(db, party_id)
        if balance + total > party.credit_limit + 0.005:
            if not override_credit_limit:
                raise CreditLimitExceeded(party.name, balance, total, party.credit_limit)
            override_note = f"Credit limit override approved (limit Rs {party.credit_limit:,.0f}, balance before Rs {balance:,.0f})"

    order = SaleOrder(party_id=party_id, date=order_date, status="draft", total=0.0,
                      created_by=created_by, idempotency_key=idempotency_key)
    db.add(order)
    db.flush()

    for item in items:
        product = products[item["product_id"]]
        db.add(SaleOrderItem(order_id=order.id, product_id=product.id, qty=item["qty"],
                             unit_price=item["unit_price"], line_total=float(_line_total(item)),
                             unit_cost=product.cost_price))
        stock_service.record_movement(db, product_id=product.id, qty_delta=-item["qty"], reason="sale",
                                      ref_order_id=order.id, movement_date=order_date)

    order.total = total
    order.status = "delivered"
    _post_ledger(db, order, sale=True, method=ledger_method, created_by=created_by, invoice_note=override_note)
    db.flush()
    return order


def void_order(db: Session, order: SaleOrder | PurchaseOrder, *, reason: str, voided_by: str | None = None,
               on_date: date_type | None = None) -> SaleOrder | PurchaseOrder:
    """Cancel a posted order by appending exact reversals, in one transaction.

    Stock movements and khata entries tied to the order are mirrored with
    opposite signs, so balances, aging and stock return to where they were
    while the original lines stay visible in history.
    """
    sale = isinstance(order, SaleOrder)
    if order.status == "void":
        raise ValueError("This order is already void")
    on_date = on_date or date_type.today()

    locked = {}
    for item in sorted(order.items, key=lambda i: i.product_id):
        if item.product_id not in locked:
            locked[item.product_id] = (
                db.query(Product).filter(Product.id == item.product_id).with_for_update().populate_existing().first()
            )
    if not sale:
        needed = defaultdict(float)
        for item in order.items:
            needed[item.product_id] += item.qty
        for product_id, qty in needed.items():
            product = locked[product_id]
            if product.current_stock + 1e-9 < qty:
                raise ValueError(
                    f"Cannot void: {product.name} from this purchase has already been sold "
                    f"(in stock {product.current_stock:g}, purchase {qty:g})"
                )

    for item in order.items:
        product = locked[item.product_id]
        if not sale:
            _unwind_cost(product, qty=item.qty, unit_price=item.unit_price)
        stock_service.record_movement(db, product_id=item.product_id,
                                      qty_delta=item.qty if sale else -item.qty, reason="void",
                                      ref_order_id=order.id, movement_date=on_date)

    entries = db.query(LedgerEntry).filter(LedgerEntry.ref_order_id == order.id).all()
    for entry in entries:
        ledger_service.record_entry(
            db, party_id=entry.party_id, entry_date=on_date,
            entry_type="credit" if entry.type == "debit" else "debit",
            amount=entry.amount, method=entry.method, ref_order_id=order.id,
            note=f"Reversal (void): {reason}", created_by=voided_by,
        )

    order.status = "void"
    order.voided_at = datetime.now(timezone.utc)
    order.void_reason = reason
    db.flush()
    return order


def _reaverage_cost(product: Product, *, qty: float, unit_price: float) -> None:
    """Moving weighted-average cost. Negative or zero stock contributes no
    cost layer, so a purchase into an empty shelf takes its own price."""
    on_hand = max(product.current_stock, 0.0)
    if on_hand + qty <= 0:
        return
    value = Decimal(str(on_hand)) * Decimal(str(product.cost_price)) + Decimal(str(qty)) * Decimal(str(unit_price))
    product.cost_price = float((value / Decimal(str(on_hand + qty))).quantize(PAISA, rounding=ROUND_HALF_UP))


def _unwind_cost(product: Product, *, qty: float, unit_price: float) -> None:
    """Remove a voided purchase's cost layer from the average when that is
    arithmetically meaningful; otherwise keep the current average."""
    remaining = product.current_stock - qty
    if remaining <= 0:
        return
    value = Decimal(str(product.current_stock)) * Decimal(str(product.cost_price)) - Decimal(str(qty)) * Decimal(str(unit_price))
    if value >= 0:
        product.cost_price = float((value / Decimal(str(remaining))).quantize(PAISA, rounding=ROUND_HALF_UP))


def _validate_order(db: Session, party_id: str, items: list[dict], *, sale: bool) -> dict[str, Product]:
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
    products: dict[str, Product] = {}
    # Stable lock order avoids deadlocks for orders with the same SKUs.
    for product_id in sorted(requested):
        product = db.query(Product).filter(Product.id == product_id).with_for_update().populate_existing().first()
        if product is None:
            raise ValueError("Product not found")
        if sale and requested[product_id] > product.current_stock + 1e-9:
            raise ValueError(f"Insufficient stock for {product.name}")
        products[product_id] = product
    return products


def _post_ledger(db: Session, order, *, sale: bool, method: str | None, created_by: str | None,
                 invoice_note: str | None = None) -> None:
    # Omitted method preserves legacy API callers that post their own ledger.
    if method is None or order.total == 0:
        return
    direction = "debit" if sale else "credit"
    ledger_service.record_entry(db, party_id=order.party_id, entry_date=order.date,
        entry_type=direction, amount=order.total, method="udhaar", ref_order_id=order.id,
        created_by=created_by, note=invoice_note or ("Sale invoice" if sale else "Purchase invoice"))
    if method != "udhaar":
        ledger_service.record_entry(db, party_id=order.party_id, entry_date=order.date,
            entry_type="credit" if sale else "debit", amount=order.total, method=method,
            ref_order_id=order.id, created_by=created_by, note="Invoice settled on posting")
        order.status = "paid"
