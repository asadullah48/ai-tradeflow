from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.common import TimestampMixin, new_id


class Business(Base, TimestampMixin):
    """A tenant: one wholesale business. Its id is the tenant_id stamped on
    every row that business owns."""

    __tablename__ = "businesses"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
