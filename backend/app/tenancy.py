"""Business (tenant) isolation, enforced in one place for the whole ORM.

A request becomes tenant-scoped the moment `get_current_user` resolves the
caller (auth/dependencies.py calls `scope_session`). From then on:

* every ORM SELECT, UPDATE and DELETE touching a TenantMixin model gets
  `WHERE tenant_id = :caller_business` appended - including joins, lazy
  loads, `Session.get()` and relationship loads - via `with_loader_criteria`;
* every new TenantMixin row is stamped with the caller's business, and a
  row explicitly carrying another business's id refuses to flush.

So a router or service that forgets a WHERE clause still cannot read or
write another business's rows: the filter is not something each query has
to remember. Sessions that were never scoped (login, registration, unit
tests of the service layer, the seed script) are unfiltered.

Raw SQL (`text()`) bypasses the ORM and therefore this filter; the
application does not use it for business data.
"""

from sqlalchemy import event
from sqlalchemy.orm import Session, with_loader_criteria

from app.models.common import TenantMixin

TENANT_KEY = "tenant_id"


class TenantViolation(RuntimeError):
    """A write tried to touch a row belonging to a different business."""


def scope_session(session: Session, tenant_id: str) -> None:
    current = session.info.get(TENANT_KEY)
    if current is not None and current != tenant_id:
        raise TenantViolation("Session is already scoped to a different business")
    session.info[TENANT_KEY] = tenant_id


def session_tenant(session: Session) -> str | None:
    return session.info.get(TENANT_KEY)


@event.listens_for(Session, "do_orm_execute")
def _filter_to_tenant(state) -> None:
    tenant_id = state.session.info.get(TENANT_KEY)
    if tenant_id is None:
        return
    if state.is_select or state.is_update or state.is_delete:
        state.statement = state.statement.options(
            with_loader_criteria(
                TenantMixin,
                lambda cls: cls.tenant_id == tenant_id,
                include_aliases=True,
            )
        )


@event.listens_for(Session, "before_flush")
def _stamp_and_guard(session: Session, flush_context, instances) -> None:
    tenant_id = session.info.get(TENANT_KEY)
    if tenant_id is None:
        return
    for obj in session.new:
        if isinstance(obj, TenantMixin):
            if obj.tenant_id is None:
                obj.tenant_id = tenant_id
            elif obj.tenant_id != tenant_id:
                raise TenantViolation(f"Refusing to create a {type(obj).__name__} for another business")
    for obj in list(session.dirty) + list(session.deleted):
        if isinstance(obj, TenantMixin) and obj.tenant_id != tenant_id:
            raise TenantViolation(f"Refusing to modify a {type(obj).__name__} of another business")
