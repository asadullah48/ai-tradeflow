from datetime import date

from sqlalchemy import Date, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.common import OrderStatus, TenantMixin, TimestampMixin, new_id


class SaleOrder(Base, TenantMixin, TimestampMixin):
    __tablename__ = "sale_orders"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    party_id: Mapped[str] = mapped_column(ForeignKey("parties.id"))
    date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String, default=OrderStatus.draft.value)
    total: Mapped[float] = mapped_column(Float, default=0.0)

    items = relationship("SaleOrderItem", back_populates="order", cascade="all, delete-orphan")


class SaleOrderItem(Base):
    __tablename__ = "sale_order_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    order_id: Mapped[str] = mapped_column(ForeignKey("sale_orders.id"))
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    qty: Mapped[float] = mapped_column(Float)
    unit_price: Mapped[float] = mapped_column(Float)
    line_total: Mapped[float] = mapped_column(Float)

    order = relationship("SaleOrder", back_populates="items")
