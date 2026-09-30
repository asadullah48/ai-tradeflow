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
    if db.get(Party, party_id) is None:
        raise ValueError("Party not found")
    if entry_type not in {"debit", "credit"}:
        raise ValueError("Invalid ledger entry type")
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
    ref_order_id: str | None = None


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

    return _age_entries(entries, as_of)


def _age_entries(entries, as_of):
    debits = sorted(
        [AgedDebit(e.id, e.date, e.amount, e.ref_order_id) for e in entries if e.type == "debit"],
        key=lambda d: d.date,
    )
    # Settle explicitly linked invoices first. Otherwise a cash sale could
    # incorrectly rejuvenate an older unpaid credit invoice through FIFO.
    remaining_credit = 0.0
    for credit in (e for e in entries if e.type == "credit"):
        unallocated = credit.amount
        if credit.ref_order_id:
            for debit in debits:
                if debit.ref_order_id == credit.ref_order_id:
                    applied = min(debit.remaining, unallocated)
                    debit.remaining -= applied
                    unallocated -= applied
        remaining_credit += unallocated
    # General receipts and any surplus still apply FIFO to outstanding debt.
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


def get_all_balances(db: Session) -> list[dict]:
    """Build the overview with two queries, independent of party count."""
    from collections import defaultdict
    parties = db.query(Party).order_by(Party.name).all()
    grouped = defaultdict(list)
    for entry in db.query(LedgerEntry).all():
        grouped[entry.party_id].append(entry)
    result = []
    for party in parties:
        entries = grouped[party.id]
        balance = party.opening_balance + sum(e.amount if e.type == "debit" else -e.amount for e in entries)
        result.append({"party_id": party.id, "party_name": party.name,
            "balance": round(balance, 2), "aging": [
                {"label": label, "amount": round(amount, 2)}
                for label, amount in _age_entries(entries, date_type.today()).items()]})
    return result
