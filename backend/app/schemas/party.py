from pydantic import BaseModel


class PartyBase(BaseModel):
    name: str
    name_ur: str | None = None
    type: str = "customer"
    phone: str | None = None
    city: str | None = None
    credit_limit: float = 0.0
    opening_balance: float = 0.0


class PartyCreate(PartyBase):
    pass


class PartyUpdate(BaseModel):
    name: str | None = None
    name_ur: str | None = None
    type: str | None = None
    phone: str | None = None
    city: str | None = None
    credit_limit: float | None = None


class PartyOut(PartyBase):
    id: str

    class Config:
        from_attributes = True
