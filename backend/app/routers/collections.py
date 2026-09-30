from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.business import Business
from app.models.user import User
from app.services import collections_service

router = APIRouter(prefix="/collections", tags=["collections"])


@router.get("")
def collections(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Ranked udhaar recovery list with the reason for each rank and a
    ready-to-send WhatsApp reminder (Roman Urdu and English)."""
    business = db.get(Business, user.tenant_id)
    return collections_service.get_collections(db, business_name=business.name if business else "our shop")
