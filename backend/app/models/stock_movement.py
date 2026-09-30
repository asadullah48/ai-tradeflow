from datetime import date

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.common import Quantity, StockMovementReason, TenantMixin, TimestampMixin, new_id


class StockMovement(Base, TenantMixin, TimestampMixin):
    __tablename__ = "stock_movements"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    date: Mapped[date] = mapped_column(Date)
    qty_delta: Mapped[float] = mapped_column(Quantity)
    reason: Mapped[str] = mapped_column(String, default=StockMovementReason.adjustment.value)
    ref_order_id: Mapped[str | None] = mapped_column(String, nullable=True)
