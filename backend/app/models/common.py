"""Shared enums and mixins used across models."""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column


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


class UserRole(str, enum.Enum):
    owner = "owner"
    munshi = "munshi"


class TenantMixin:
    """Open Decision #2: tenant_id exists on every table now, not yet
    enforced at the query layer (single-tenant in practice for v1)."""

    tenant_id: Mapped[str] = mapped_column(String, default="default", index=True)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
