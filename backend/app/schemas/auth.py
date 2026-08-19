from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    name: str
    phone: str
    password: str = Field(min_length=6)
    role: str = "owner"


class LoginRequest(BaseModel):
    phone: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    name: str
    phone: str
    role: str

    class Config:
        from_attributes = True
