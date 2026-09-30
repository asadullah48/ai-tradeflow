from datetime import date

from typing import Literal
from pydantic import BaseModel, Field


class OrderItemCreate(BaseModel):
    product_id: str
    qty: float = Field(gt=0, allow_inf_nan=False)
    unit_price: float = Field(ge=0, allow_inf_nan=False)


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
    ledger_method: Literal["udhaar", "cash", "bank", "jazzcash", "easypaisa"] | None = None


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
    status: Literal["draft", "received", "delivered", "partial", "paid"]
