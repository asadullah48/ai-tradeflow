"""Shared enums and mixins used across models."""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

# Money is stored as exact NUMERIC (never binary floating point) and read
# back as a Python float for arithmetic convenience; services quantize to
# the paisa with Decimal at every posting boundary. Quantities allow three
# decimals (kg, meters).
Money = Numeric(14, 2, asdecimal=False)
Quantity = Numeric(14, 3, asdecimal=False)


def new_id() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PartyType(str, enum.Enum):
    customer = "customer"
    supplier = "supplier"
    both = "both"


class Unit(str, enum.Enum):
    piece = "piece"
    dozen = "dozen"
    carton = "carton"
    kg = "kg"
    meter = "meter"


class OrderStatus(str, enum.Enum):
    draft = "draft"
    received = "received"    # purchase orders
    delivered = "delivered"  # sale orders
    partial = "partial"
    paid = "paid"
    void = "void"


class LedgerEntryType(str, enum.Enum):
    debit = "debit"
    credit = "credit"


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    bank = "bank"
    jazzcash = "jazzcash"
    easypaisa = "easypaisa"
    udhaar = "udhaar"


class StockMovementReason(str, enum.Enum):
    purchase = "purchase"
    sale = "sale"
    adjustment = "adjustment"
    return_ = "return"
    void = "void"


class UserRole(str, enum.Enum):
    owner = "owner"
    munshi = "munshi"


class TenantMixin:
    """Every business-owned row carries its business's id.

    Enforcement lives in app/tenancy.py: once a request is authenticated,
    every ORM SELECT/UPDATE/DELETE on a TenantMixin model is filtered to
    the caller's business, and every new row is stamped with it. Rows
    created outside a scoped session (unit tests, scripts) get "default".
    """

    tenant_id: Mapped[str] = mapped_column(String, default="default", index=True)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
