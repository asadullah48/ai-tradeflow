from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
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
def create_entry(
    payload: LedgerEntryCreate, response: Response, db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    """Record a payment or adjustment. Send an Idempotency-Key so a retried
    request (flaky shop Wi-Fi, double tap) cannot record the payment twice."""
    key = (idempotency_key or "").strip()[:120] or None
    if key:
        existing = db.query(LedgerEntry).filter(LedgerEntry.idempotency_key == key).first()
        if existing is not None:
            response.status_code = status.HTTP_200_OK
            response.headers["Idempotent-Replay"] = "true"
            return existing
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
            idempotency_key=key,
        )
        db.commit()
    except ValueError as e:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    except IntegrityError:
        db.rollback()
        existing = db.query(LedgerEntry).filter(LedgerEntry.idempotency_key == key).first() if key else None
        if existing is None:
            raise
        response.status_code = status.HTTP_200_OK
        return existing
    db.refresh(entry)
    return entry


@router.get("/parties/{party_id}", response_model=list[LedgerEntryOut])
def party_ledger(party_id: str, db: Session = Depends(get_db)):
    return db.query(LedgerEntry).filter(LedgerEntry.party_id == party_id).order_by(LedgerEntry.date, LedgerEntry.created_at).all()


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


@router.get("/balances", response_model=list[PartyBalance])
def balances(db: Session = Depends(get_db)):
    return ledger_service.get_all_balances(db)
