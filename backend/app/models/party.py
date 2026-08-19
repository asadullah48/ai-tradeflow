from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.common import PartyType, TenantMixin, TimestampMixin, new_id


class Party(Base, TenantMixin, TimestampMixin):
    __tablename__ = "parties"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String, index=True)
    name_ur: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[str] = mapped_column(String, default=PartyType.customer.value)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    credit_limit: Mapped[float] = mapped_column(Float, default=0.0)
    opening_balance: Mapped[float] = mapped_column(Float, default=0.0)

    ledger_entries = relationship("LedgerEntry", back_populates="party", cascade="all, delete-orphan")
