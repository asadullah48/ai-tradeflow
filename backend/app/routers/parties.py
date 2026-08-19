from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.party import Party
from app.schemas.party import PartyCreate, PartyOut, PartyUpdate

router = APIRouter(prefix="/parties", tags=["parties"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[PartyOut])
def list_parties(q: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Party)
    if q:
        # Search across both English and Urdu names.
        like = f"%{q}%"
        query = query.filter((Party.name.ilike(like)) | (Party.name_ur.ilike(like)))
    return query.order_by(Party.name).all()


@router.post("", response_model=PartyOut, status_code=status.HTTP_201_CREATED)
def create_party(payload: PartyCreate, db: Session = Depends(get_db)):
    party = Party(**payload.model_dump())
    db.add(party)
    db.commit()
    db.refresh(party)
    return party


@router.get("/{party_id}", response_model=PartyOut)
def get_party(party_id: str, db: Session = Depends(get_db)):
    party = db.get(Party, party_id)
    if party is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Party not found")
    return party


@router.patch("/{party_id}", response_model=PartyOut)
def update_party(party_id: str, payload: PartyUpdate, db: Session = Depends(get_db)):
    party = db.get(Party, party_id)
    if party is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Party not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(party, field, value)
    db.commit()
    db.refresh(party)
    return party


@router.delete("/{party_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_party(party_id: str, db: Session = Depends(get_db)):
    party = db.get(Party, party_id)
    if party is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Party not found")
    db.delete(party)
    db.commit()
