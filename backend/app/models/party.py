from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.common import Money, PartyType, TenantMixin, TimestampMixin, new_id


class Party(Base, TenantMixin, TimestampMixin):
    __tablename__ = "parties"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String, index=True)
    name_ur: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[str] = mapped_column(String, default=PartyType.customer.value)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    # 0 means "no limit set". Enforced on udhaar sales (order_service).
    credit_limit: Mapped[float] = mapped_column(Money, default=0.0)
    opening_balance: Mapped[float] = mapped_column(Money, default=0.0)

    # No delete cascade: a party with khata history cannot be deleted
    # (routers/parties.py refuses), so accounting history is never erased.
    ledger_entries = relationship("LedgerEntry", back_populates="party")
