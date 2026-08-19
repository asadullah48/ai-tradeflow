from datetime import date, timedelta

import pytest

from app.models.party import Party
from app.services import ledger_service


def make_party(db, **overrides):
    defaults = dict(name="Test Party", type="customer", opening_balance=0.0)
    defaults.update(overrides)
    party = Party(**defaults)
    db.add(party)
    db.flush()
    return party


def test_balance_starts_at_opening_balance(db_session):
    party = make_party(db_session, opening_balance=500)
    assert ledger_service.get_party_balance(db_session, party.id) == 500


def test_debit_increases_balance(db_session):
    party = make_party(db_session)
    ledger_service.record_entry(db_session, party_id=party.id, entry_date=date.today(), entry_type="debit", amount=1000, method="cash")
    assert ledger_service.get_party_balance(db_session, party.id) == 1000


def test_credit_decreases_balance(db_session):
    party = make_party(db_session, opening_balance=1000)
    ledger_service.record_entry(db_session, party_id=party.id, entry_date=date.today(), entry_type="credit", amount=400, method="cash")
    assert ledger_service.get_party_balance(db_session, party.id) == 600


def test_udhaar_entry_requires_ref_order_id(db_session):
    party = make_party(db_session)
    with pytest.raises(ValueError, match="udhaar"):
        ledger_service.record_entry(
            db_session, party_id=party.id, entry_date=date.today(), entry_type="debit", amount=500, method="udhaar"
        )


def test_udhaar_entry_with_ref_order_id_succeeds(db_session):
    party = make_party(db_session)
    entry = ledger_service.record_entry(
        db_session, party_id=party.id, entry_date=date.today(), entry_type="debit",
        amount=500, method="udhaar", ref_order_id="order-123",
    )
    assert entry.ref_order_id == "order-123"


def test_amount_must_be_positive(db_session):
    party = make_party(db_session)
    with pytest.raises(ValueError):
        ledger_service.record_entry(db_session, party_id=party.id, entry_date=date.today(), entry_type="debit", amount=0, method="cash")
    with pytest.raises(ValueError):
        ledger_service.record_entry(db_session, party_id=party.id, entry_date=date.today(), entry_type="debit", amount=-50, method="cash")


def test_aging_bucket_current_for_recent_debit(db_session):
    party = make_party(db_session)
    ledger_service.record_entry(db_session, party_id=party.id, entry_date=date.today(), entry_type="debit", amount=1000, method="udhaar", ref_order_id="o1")

    aging = ledger_service.get_receivables_aging(db_session, party.id, as_of=date.today())
    assert aging["current"] == 1000
    assert aging["30"] == 0
    assert aging["60"] == 0
    assert aging["90+"] == 0


@pytest.mark.parametrize("age_days,expected_bucket", [(10, "current"), (35, "30"), (65, "60"), (120, "90+")])
def test_aging_bucket_edges(db_session, age_days, expected_bucket):
    party = make_party(db_session)
    old_date = date.today() - timedelta(days=age_days)
    ledger_service.record_entry(db_session, party_id=party.id, entry_date=old_date, entry_type="debit", amount=1000, method="udhaar", ref_order_id="o1")

    aging = ledger_service.get_receivables_aging(db_session, party.id, as_of=date.today())
    assert aging[expected_bucket] == 1000
    other_buckets = [b for b in aging if b != expected_bucket]
    assert all(aging[b] == 0 for b in other_buckets)


def test_aging_fifo_applies_credit_to_oldest_debit_first(db_session):
    party = make_party(db_session)
    old_date = date.today() - timedelta(days=100)
    new_date = date.today() - timedelta(days=5)

    ledger_service.record_entry(db_session, party_id=party.id, entry_date=old_date, entry_type="debit", amount=1000, method="udhaar", ref_order_id="o1")
    ledger_service.record_entry(db_session, party_id=party.id, entry_date=new_date, entry_type="debit", amount=500, method="udhaar", ref_order_id="o2")
    # Pay off exactly the old debit.
    ledger_service.record_entry(db_session, party_id=party.id, entry_date=date.today(), entry_type="credit", amount=1000, method="cash")

    aging = ledger_service.get_receivables_aging(db_session, party.id, as_of=date.today())
    assert aging["90+"] == 0       # old debit fully paid
    assert aging["current"] == 500  # new debit still outstanding
