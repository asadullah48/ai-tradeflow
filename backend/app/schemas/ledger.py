from datetime import date

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class LedgerEntryCreate(BaseModel):
    party_id: str
    date: date
    type: Literal["debit", "credit"]
    amount: float = Field(gt=0, allow_inf_nan=False)
    ref_order_id: str | None = None
    method: Literal["cash", "bank", "jazzcash", "easypaisa", "udhaar"] = "cash"
    note: str | None = None


class LedgerEntryOut(BaseModel):
    id: str
    party_id: str
    date: date
    type: str
    amount: float
    ref_order_id: str | None
    method: str
    note: str | None

    model_config = ConfigDict(from_attributes=True)


class AgingBucket(BaseModel):
    label: str  # "current" | "30" | "60" | "90+"
    amount: float


class PartyBalance(BaseModel):
    party_id: str
    party_name: str
    balance: float  # positive = they owe us (receivable), negative = we owe them
    aging: list[AgingBucket]
