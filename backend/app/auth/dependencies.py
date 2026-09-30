"""FastAPI dependencies for authenticated routes and role checks."""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.auth.security import decode_access_token
from app.database import get_db
from app.models.user import User
from app.tenancy import scope_session

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.get(User, payload.get("sub"))
    if user is None or user.tenant_id != payload.get("tid", user.tenant_id):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    # From here on, this request's session only sees the caller's business.
    # FastAPI caches get_db per request, so the router's `db` is this session.
    scope_session(db, user.tenant_id)
    return user


def require_owner(user: User = Depends(get_current_user)) -> User:
    if user.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the business owner can do this")
    return user
