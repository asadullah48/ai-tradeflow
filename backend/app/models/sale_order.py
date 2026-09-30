from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.common import Money, OrderStatus, Quantity, TenantMixin, TimestampMixin, new_id


class SaleOrder(Base, TenantMixin, TimestampMixin):
    __tablename__ = "sale_orders"
    # A retried POST with the same Idempotency-Key returns the original
    # order instead of posting stock and khata twice.
    __table_args__ = (UniqueConstraint("tenant_id", "idempotency_key", name="uq_sale_orders_idempotency"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    party_id: Mapped[str] = mapped_column(ForeignKey("parties.id"))
    date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String, default=OrderStatus.draft.value)
    total: Mapped[float] = mapped_column(Money, default=0.0)
    idempotency_key: Mapped[str | None] = mapped_column(String, nullable=True)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    voided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    void_reason: Mapped[str | None] = mapped_column(String, nullable=True)

    items = relationship("SaleOrderItem", back_populates="order", cascade="all, delete-orphan")


class SaleOrderItem(Base, TenantMixin):
    __tablename__ = "sale_order_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    order_id: Mapped[str] = mapped_column(ForeignKey("sale_orders.id"))
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    qty: Mapped[float] = mapped_column(Quantity)
    unit_price: Mapped[float] = mapped_column(Money)
    line_total: Mapped[float] = mapped_column(Money)
    # Weighted-average cost at the moment of sale; profit reads this, never
    # the product's current cost. Nullable only for rows posted before v1.2.
    unit_cost: Mapped[float | None] = mapped_column(Money, nullable=True)

    order = relationship("SaleOrder", back_populates="items")
