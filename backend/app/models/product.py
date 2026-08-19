from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.common import TenantMixin, TimestampMixin, Unit, new_id


class Product(Base, TenantMixin, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    sku: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String, index=True)
    name_ur: Mapped[str | None] = mapped_column(String, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    unit: Mapped[str] = mapped_column(String, default=Unit.piece.value)
    cost_price: Mapped[float] = mapped_column(Float, default=0.0)
    sale_price: Mapped[float] = mapped_column(Float, default=0.0)
    min_stock_level: Mapped[float] = mapped_column(Float, default=0.0)
    # current_stock is a cached, recomputable projection of StockMovement -
    # never trust it from the client; see services/stock_service.py.
    current_stock: Mapped[float] = mapped_column(Float, default=0.0)
