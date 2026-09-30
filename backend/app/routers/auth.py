from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_owner
from app.auth.security import create_access_token, hash_password, verify_password
from app.config import get_settings
from app.database import get_db
from app.models.business import Business
from app.models.user import User
from app.schemas.auth import (
    LoginRequest, MeOut, RegisterRequest, TeamMemberCreate, TokenResponse, UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])
team_router = APIRouter(prefix="/team", tags=["team"])


def _phone_taken(db: Session, phone: str) -> bool:
    return db.query(User).filter(User.phone == phone).first() is not None


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if not get_settings().allow_signup:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sign-up is closed; ask your business owner for access")
    if _phone_taken(db, payload.phone):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A user with this phone number already exists")

    business = Business(name=payload.business_name or f"{payload.name}'s business", city=payload.city)
    db.add(business)
    db.flush()
    user = User(
        name=payload.name,
        phone=payload.phone,
        role="owner",
        password_hash=hash_password(payload.password),
        tenant_id=business.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone == payload.phone).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid phone or password")

    token = create_access_token(subject=user.id, role=user.role, tenant_id=user.tenant_id)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    business = db.get(Business, user.tenant_id)
    return MeOut(
        id=user.id, name=user.name, phone=user.phone, role=user.role,
        business_id=user.tenant_id,
        business_name=business.name if business else "My business",
    )


@team_router.get("", response_model=list[UserOut])
def list_team(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(User).order_by(User.created_at).all()


@team_router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def add_team_member(payload: TeamMemberCreate, db: Session = Depends(get_db), owner: User = Depends(require_owner)):
    """Owners add staff (munshi role) to THEIR business. Staff can record
    trade and payments; voids, credit-limit overrides, deletions and team
    changes stay with the owner."""
    member = User(name=payload.name, phone=payload.phone, role="munshi",
                  password_hash=hash_password(payload.password), tenant_id=owner.tenant_id)
    db.add(member)
    try:
        # Phone numbers are globally unique logins. This session is scoped to
        # the owner's business, so a clash with ANOTHER business's user is
        # caught by the database constraint rather than a (filtered) lookup.
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A user with this phone number already exists")
    db.refresh(member)
    return member
