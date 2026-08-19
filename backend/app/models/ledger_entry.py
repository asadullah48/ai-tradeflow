from datetime import date

from sqlalchemy import Date, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.common import LedgerEntryType, PaymentMethod, TenantMixin, TimestampMixin, new_id


class LedgerEntry(Base, TenantMixin, TimestampMixin):
    __tablename__ = "ledger_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    party_id: Mapped[str] = mapped_column(ForeignKey("parties.id"))
    date: Mapped[date] = mapped_column(Date)
    type: Mapped[str] = mapped_column(String)  # LedgerEntryType
    amount: Mapped[float] = mapped_column(Float)
    ref_order_id: Mapped[str | None] = mapped_column(String, nullable=True)
    method: Mapped[str] = mapped_column(String, default=PaymentMethod.cash.value)
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    party = relationship("Party", back_populates="ledger_entries")
