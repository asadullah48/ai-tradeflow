from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.common import TenantMixin, TimestampMixin, UserRole, new_id


class User(Base, TenantMixin, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String)
    phone: Mapped[str] = mapped_column(String, unique=True, index=True)
    role: Mapped[str] = mapped_column(String, default=UserRole.munshi.value)
    password_hash: Mapped[str] = mapped_column(String)
