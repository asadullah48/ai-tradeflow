from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.sale_order import SaleOrder
from app.schemas.order import OrderCreate, OrderOut, OrderStatusUpdate
from app.services import order_service

router = APIRouter(prefix="/sale-orders", tags=["sale-orders"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[OrderOut])
def list_sale_orders(db: Session = Depends(get_db)):
    return (
        db.query(SaleOrder)
        .options(selectinload(SaleOrder.items))
        .order_by(SaleOrder.date.desc())
        .all()
    )


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_sale_order(payload: OrderCreate, db: Session = Depends(get_db)):
    if not payload.items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "An order needs at least one item")
    order = order_service.create_sale_order(
        db,
        party_id=payload.party_id,
        order_date=payload.date,
        items=[item.model_dump() for item in payload.items],
    )
    db.commit()
    db.refresh(order)
    return order


@router.get("/{order_id}", response_model=OrderOut)
def get_sale_order(order_id: str, db: Session = Depends(get_db)):
    order = db.get(SaleOrder, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sale order not found")
    return order


@router.patch("/{order_id}/status", response_model=OrderOut)
def update_status(order_id: str, payload: OrderStatusUpdate, db: Session = Depends(get_db)):
    order = db.get(SaleOrder, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sale order not found")
    order.status = payload.status
    db.commit()
    db.refresh(order)
    return order
