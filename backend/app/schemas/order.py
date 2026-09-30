from datetime import date

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


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
    unit_cost: float | None = None

    model_config = ConfigDict(from_attributes=True)


class OrderCreate(BaseModel):
    party_id: str
    date: date
    items: list[OrderItemCreate]
    ledger_method: Literal["udhaar", "cash", "bank", "jazzcash", "easypaisa"] | None = None
    # Owner-only: post a udhaar sale above the customer's credit limit. The
    # approval is written onto the invoice's khata line.
    override_credit_limit: bool = False


class OrderOut(BaseModel):
    id: str
    party_id: str
    date: date
    status: str
    total: float
    items: list[OrderItemOut]
    void_reason: str | None = None

    model_config = ConfigDict(from_attributes=True)


class OrderVoid(BaseModel):
    reason: str = Field(min_length=3, max_length=300)
