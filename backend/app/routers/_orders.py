"""Shared posting logic for the purchase- and sale-order routers:
idempotent create, owner-only void, and consistent error mapping."""

from fastapi import HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.user import User
from app.services import order_service

IDEMPOTENCY_HEADER = "Idempotency-Key"


def list_orders(db: Session, model):
    return db.query(model).options(selectinload(model.items)).order_by(model.date.desc(), model.created_at.desc()).all()


def get_order(db: Session, model, order_id: str, label: str):
    order = db.get(model, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{label} not found")
    return order


def post_order(db: Session, model, create, *, payload, user: User, idempotency_key: str | None, response: Response):
    """Post an order exactly once per Idempotency-Key.

    A replay (same key) returns the ORIGINAL order with 200 instead of 201
    and posts nothing. Two concurrent requests with the same key race to
    the (tenant_id, idempotency_key) unique constraint; the loser rolls
    back and returns the winner's order.
    """
    key = (idempotency_key or "").strip()[:120] or None
    if key:
        existing = db.query(model).filter(model.idempotency_key == key).first()
        if existing is not None:
            response.status_code = status.HTTP_200_OK
            response.headers["Idempotent-Replay"] = "true"
            return existing
    if not payload.items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "An order needs at least one item")
    if payload.override_credit_limit and user.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the business owner can override a credit limit")

    kwargs = dict(
        party_id=payload.party_id, order_date=payload.date,
        items=[item.model_dump() for item in payload.items],
        ledger_method=payload.ledger_method, created_by=user.id, idempotency_key=key,
    )
    if model.__name__ == "SaleOrder":
        kwargs["override_credit_limit"] = payload.override_credit_limit
    try:
        order = create(db, **kwargs)
        db.commit()
    except order_service.CreditLimitExceeded as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, exc.detail())
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    except IntegrityError:
        db.rollback()
        if key:
            existing = db.query(model).filter(model.idempotency_key == key).first()
            if existing is not None:
                response.status_code = status.HTTP_200_OK
                response.headers["Idempotent-Replay"] = "true"
                return existing
        raise
    db.refresh(order)
    return order


def void(db: Session, model, order_id: str, label: str, *, reason: str, user: User):
    order = get_order(db, model, order_id, label)
    try:
        order_service.void_order(db, order, reason=reason, voided_by=user.id)
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))
    db.refresh(order)
    return order
