from pydantic import BaseModel, Field


class PartyBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    name_ur: str | None = None
    type: str = "customer"
    phone: str | None = None
    city: str | None = None
    credit_limit: float = Field(default=0, ge=0, allow_inf_nan=False)
    opening_balance: float = 0.0


class PartyCreate(PartyBase):
    pass


class PartyUpdate(BaseModel):
    name: str | None = None
    name_ur: str | None = None
    type: str | None = None
    phone: str | None = None
    city: str | None = None
    credit_limit: float | None = Field(default=None, ge=0, allow_inf_nan=False)


class PartyOut(PartyBase):
    id: str

    class Config:
        from_attributes = True
