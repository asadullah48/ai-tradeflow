from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.common import TenantMixin, TimestampMixin, new_id


class AgentQuery(Base, TenantMixin, TimestampMixin):
    """Audit log for every Munshi AI interaction - what was asked, what was
    answered, and exactly which read-only tools were used to answer it."""

    __tablename__ = "agent_queries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    question: Mapped[str] = mapped_column(String)
    answer: Mapped[str] = mapped_column(String)
    tools_called: Mapped[list] = mapped_column(JSON, default=list)
    flagged: Mapped[bool] = mapped_column(default=False)
