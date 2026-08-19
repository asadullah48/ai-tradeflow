from datetime import date

from pydantic import BaseModel


class OrderItemCreate(BaseModel):
    product_id: str
    qty: float
    unit_price: float


class OrderItemOut(BaseModel):
    id: str
    product_id: str
    qty: float
    unit_price: float
    line_total: float

    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    party_id: str
    date: date
    items: list[OrderItemCreate]


class OrderOut(BaseModel):
    id: str
    party_id: str
    date: date
    status: str
    total: float
    items: list[OrderItemOut]

    class Config:
        from_attributes = True


class OrderStatusUpdate(BaseModel):
    status: str
