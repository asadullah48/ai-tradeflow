"""Ledger balance and udhaar (receivables/payables) aging.

Convention: a `debit` entry increases what the party owes us (e.g. a sale
on credit); a `credit` entry decreases it (e.g. a payment received).
Balance = opening_balance + sum(debits) - sum(credits). Positive balance
= they owe us (receivable); negative = we owe them (payable).
"""

from dataclasses import dataclass
from datetime import date as date_type

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ledger_entry import LedgerEntry
from app.models.party import Party

AGING_BUCKETS = ["current", "30", "60", "90+"]


def record_entry(
    db: Session,
    *,
    party_id: str,
    entry_date: date_type,
    entry_type: str,
    amount: float,
    method: str = "cash",
    ref_order_id: str | None = None,
    note: str | None = None,
    created_by: str | None = None,
) -> LedgerEntry:
    if amount <= 0:
        raise ValueError("Ledger entry amount must be positive")
    if method == "udhaar" and ref_order_id is None:
        # Invariant (SPEC §5): every udhaar entry must reference an order.
        raise ValueError("A udhaar ledger entry must reference an order (ref_order_id)")

    entry = LedgerEntry(
        party_id=party_id,
        date=entry_date,
        type=entry_type,
        amount=amount,
        method=method,
        ref_order_id=ref_order_id,
        note=note,
        created_by=created_by,
    )
    db.add(entry)
    db.flush()
    return entry


def get_party_balance(db: Session, party_id: str) -> float:
    party = db.get(Party, party_id)
    if party is None:
        raise ValueError(f"Party {party_id} not found")

    entries = db.execute(
        select(LedgerEntry).where(LedgerEntry.party_id == party_id)
    ).scalars().all()

    debits = sum(e.amount for e in entries if e.type == "debit")
    credits = sum(e.amount for e in entries if e.type == "credit")
    return party.opening_balance + debits - credits


@dataclass
class AgedDebit:
    entry_id: str
    date: date_type
    remaining: float


def _bucket_for_age(days: int) -> str:
    if days < 30:
        return "current"
    if days < 60:
        return "30"
    if days < 90:
        return "60"
    return "90+"


def get_receivables_aging(db: Session, party_id: str, as_of: date_type | None = None) -> dict[str, float]:
    """FIFO aging: apply credits to the oldest unpaid debits first, then
    bucket each debit's remaining unpaid amount by its age."""
    as_of = as_of or date_type.today()

    entries = db.execute(
        select(LedgerEntry).where(LedgerEntry.party_id == party_id)
    ).scalars().all()

    debits = sorted(
        [AgedDebit(e.id, e.date, e.amount) for e in entries if e.type == "debit"],
        key=lambda d: d.date,
    )
    credits_total = sum(e.amount for e in entries if e.type == "credit")

    # Apply all credits FIFO against the oldest debits.
    remaining_credit = credits_total
    for debit in debits:
        if remaining_credit <= 0:
            break
        applied = min(debit.remaining, remaining_credit)
        debit.remaining -= applied
        remaining_credit -= applied

    buckets = {b: 0.0 for b in AGING_BUCKETS}
    for debit in debits:
        if debit.remaining <= 0:
            continue
        age_days = (as_of - debit.date).days
        buckets[_bucket_for_age(age_days)] += debit.remaining

    return buckets
