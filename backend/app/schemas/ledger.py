from datetime import date

from pydantic import BaseModel


class LedgerEntryCreate(BaseModel):
    party_id: str
    date: date
    type: str  # "debit" | "credit"
    amount: float
    ref_order_id: str | None = None
    method: str = "cash"
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

    class Config:
        from_attributes = True


class AgingBucket(BaseModel):
    label: str  # "current" | "30" | "60" | "90+"
    amount: float


class PartyBalance(BaseModel):
    party_id: str
    party_name: str
    balance: float  # positive = they owe us (receivable), negative = we owe them
    aging: list[AgingBucket]
