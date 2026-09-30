from pydantic import BaseModel, ConfigDict, Field

PHONE_PATTERN = r"^\+?[0-9]{10,14}$"


class RegisterRequest(BaseModel):
    """Self-service sign-up: always creates a NEW business with the caller
    as its owner. Joining an existing business is done by that business's
    owner through POST /team - a sign-up can never pick its own role or
    attach itself to someone else's books."""

    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(pattern=PHONE_PATTERN)
    password: str = Field(min_length=8, max_length=128)
    business_name: str | None = Field(default=None, max_length=160)
    city: str | None = Field(default=None, max_length=80)


class LoginRequest(BaseModel):
    phone: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    phone: str
    role: str


class MeOut(UserOut):
    business_id: str
    business_name: str


class TeamMemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(pattern=PHONE_PATTERN)
    password: str = Field(min_length=8, max_length=128)
