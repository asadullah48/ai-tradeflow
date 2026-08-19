from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.ledger_entry import LedgerEntry
from app.models.party import Party
from app.models.user import User
from app.schemas.ledger import AgingBucket, LedgerEntryCreate, LedgerEntryOut, PartyBalance
from app.services import ledger_service

router = APIRouter(prefix="/ledger", tags=["ledger"], dependencies=[Depends(get_current_user)])


@router.post("/entries", response_model=LedgerEntryOut, status_code=status.HTTP_201_CREATED)
def create_entry(payload: LedgerEntryCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        entry = ledger_service.record_entry(
            db,
            party_id=payload.party_id,
            entry_date=payload.date,
            entry_type=payload.type,
            amount=payload.amount,
            method=payload.method,
            ref_order_id=payload.ref_order_id,
            note=payload.note,
            created_by=user.id,
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/parties/{party_id}", response_model=list[LedgerEntryOut])
def party_ledger(party_id: str, db: Session = Depends(get_db)):
    return db.query(LedgerEntry).filter(LedgerEntry.party_id == party_id).order_by(LedgerEntry.date).all()


@router.get("/parties/{party_id}/balance", response_model=PartyBalance)
def party_balance(party_id: str, db: Session = Depends(get_db)):
    party = db.get(Party, party_id)
    if party is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Party not found")

    balance = ledger_service.get_party_balance(db, party_id)
    aging = ledger_service.get_receivables_aging(db, party_id)
    return PartyBalance(
        party_id=party.id,
        party_name=party.name,
        balance=round(balance, 2),
        aging=[AgingBucket(label=label, amount=round(amount, 2)) for label, amount in aging.items()],
    )
