"""Collections desk - which udhaar to chase first, and the message to send.

Deterministic ranking over the khata the business already keeps: older
debt weighs more than fresh debt, a customer over their credit limit or
silent for weeks moves up, and every row says WHY it is ranked where it
is. The reminder text is ready to paste or open in WhatsApp; nothing is
sent automatically.
"""

from collections import defaultdict
from datetime import date as date_type
from urllib.parse import quote

from sqlalchemy.orm import Session

from app.models.ledger_entry import LedgerEntry
from app.models.party import Party
from app.services.ledger_service import _age_entries

# Rupees of debt in each bucket count this many times toward priority.
BUCKET_WEIGHTS = {"current": 0.25, "30": 1.0, "60": 2.0, "90+": 3.0}
QUIET_DAYS = 30  # no payment for this long counts against the customer


def whatsapp_number(phone: str | None) -> str | None:
    """Normalise a Pakistani mobile number to wa.me's international form."""
    if not phone:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    if digits.startswith("0092"):
        digits = digits[2:]
    if digits.startswith("03") and len(digits) == 11:
        digits = "92" + digits[1:]
    if digits.startswith("92") and len(digits) == 12:
        return digits
    return None


def build_reminder(party_name: str, balance: float, overdue: float, business_name: str) -> dict[str, str]:
    overdue_en = f", of which Rs {overdue:,.0f} is over 30 days old" if overdue > 0 else ""
    overdue_ur = f", jis mein se Rs {overdue:,.0f} 30 din se zyada purana hai" if overdue > 0 else ""
    return {
        "en": (f"Assalam-o-Alaikum {party_name}. Your balance with {business_name} is Rs {balance:,.0f}"
               f"{overdue_en}. Kindly arrange payment at your earliest convenience. JazakAllah."),
        "roman_ur": (f"Assalam-o-Alaikum {party_name}. {business_name} ke khata mein aap ka baqaya Rs {balance:,.0f} hai"
                     f"{overdue_ur}. Meherbani farma kar jald adaigi kar dein. JazakAllah."),
    }


def get_collections(db: Session, *, business_name: str, as_of: date_type | None = None) -> dict:
    as_of = as_of or date_type.today()
    grouped: dict[str, list[LedgerEntry]] = defaultdict(list)
    for entry in db.query(LedgerEntry).all():
        grouped[entry.party_id].append(entry)

    rows = []
    for party in db.query(Party).all():
        entries = grouped[party.id]
        balance = round(party.opening_balance + sum(e.amount if e.type == "debit" else -e.amount for e in entries), 2)
        if balance <= 0:
            continue
        aging = {k: round(v, 2) for k, v in _age_entries(entries, as_of).items()}
        # Opening balances carry no invoice date; treat any unexplained
        # remainder as current rather than inventing an age for it.
        aged_total = sum(aging.values())
        if balance > aged_total:
            aging["current"] = round(aging["current"] + balance - aged_total, 2)
        elif balance < aged_total:
            # An advance or negative opening balance pays the oldest debt first.
            excess = aged_total - balance
            for bucket in ("90+", "60", "30", "current"):
                applied = min(aging[bucket], excess)
                aging[bucket] = round(aging[bucket] - applied, 2)
                excess -= applied
        overdue = round(aging["30"] + aging["60"] + aging["90+"], 2)

        payments = [e.date for e in entries if e.type == "credit"]
        last_payment = max(payments) if payments else None
        quiet_days = (as_of - last_payment).days if last_payment else None

        score = sum(aging[b] * w for b, w in BUCKET_WEIGHTS.items())
        reasons = []
        if aging["90+"] > 0:
            reasons.append(f"Rs {aging['90+']:,.0f} unpaid for 90+ days")
        elif aging["60"] > 0:
            reasons.append(f"Rs {aging['60']:,.0f} unpaid for 60+ days")
        elif aging["30"] > 0:
            reasons.append(f"Rs {aging['30']:,.0f} unpaid for 30+ days")
        over_limit = bool(party.credit_limit and balance > party.credit_limit)
        if over_limit:
            score *= 1.25
            reasons.append(f"Over credit limit by Rs {balance - party.credit_limit:,.0f}")
        if quiet_days is None:
            score *= 1.1
            reasons.append("No payment on record")
        elif quiet_days >= QUIET_DAYS:
            score *= 1.1
            reasons.append(f"No payment for {quiet_days} days")
        if not reasons:
            reasons.append("Balance is recent - a friendly reminder is enough")

        number = whatsapp_number(party.phone)
        message = build_reminder(party.name, balance, overdue, business_name)
        rows.append({
            "party_id": party.id,
            "party_name": party.name,
            "party_name_ur": party.name_ur,
            "phone": party.phone,
            "balance": balance,
            "overdue": overdue,
            "aging": aging,
            "credit_limit": party.credit_limit or 0.0,
            "over_limit": over_limit,
            "last_payment_date": last_payment.isoformat() if last_payment else None,
            "days_since_payment": quiet_days,
            "priority_score": round(score, 2),
            "reasons": reasons,
            "message": message,
            "whatsapp_url": f"https://wa.me/{number}?text={quote(message['roman_ur'])}" if number else None,
        })

    rows.sort(key=lambda r: (-r["priority_score"], -r["balance"]))
    for i, row in enumerate(rows, start=1):
        row["rank"] = i
    return {
        "as_of": as_of.isoformat(),
        "total_receivable": round(sum(r["balance"] for r in rows), 2),
        "total_overdue": round(sum(r["overdue"] for r in rows), 2),
        "customers": rows,
    }
