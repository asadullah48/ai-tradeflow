from fastapi import APIRouter, Depends, Header, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_owner
from app.database import get_db
from app.models.sale_order import SaleOrder
from app.models.user import User
from app.routers import _orders
from app.schemas.order import OrderCreate, OrderOut, OrderVoid
from app.services import order_service

router = APIRouter(prefix="/sale-orders", tags=["sale-orders"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[OrderOut])
def list_orders(db: Session = Depends(get_db)):
    return _orders.list_orders(db, SaleOrder)


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate, response: Response, db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    idempotency_key: str | None = Header(default=None, alias=_orders.IDEMPOTENCY_HEADER),
):
    return _orders.post_order(db, SaleOrder, order_service.create_sale_order, payload=payload, user=user,
                              idempotency_key=idempotency_key, response=response)


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: str, db: Session = Depends(get_db)):
    return _orders.get_order(db, SaleOrder, order_id, "Sale order")


@router.post("/{order_id}/void", response_model=OrderOut)
def void_order(order_id: str, payload: OrderVoid, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    """Owner-only cancellation. Appends reversing stock and khata entries;
    the original order and its lines stay in history, marked void."""
    return _orders.void(db, SaleOrder, order_id, "Sale order", reason=payload.reason, user=owner)
