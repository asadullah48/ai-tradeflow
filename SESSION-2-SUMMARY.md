# Session 2 — Integration

**Spec target:** purchase/sale orders end-to-end with stock movements,
ledger engine with derived balances and udhaar aging buckets, invariant
test suite, dashboard v1, 60+ tests passing.

## What was built

- `backend/app/services/order_service.py` - purchase orders increase
  stock, sale orders decrease it, both via `stock_service.record_movement`
  so the `current_stock` cache and the movement history never disagree.
- `backend/app/services/ledger_service.py` - `record_entry()` enforces
  the udhaar-must-reference-an-order invariant from SPEC §5, and
  `get_receivables_aging()` does real FIFO aging: credits are applied to
  the oldest outstanding debits first, then remaining balances are
  bucketed by age (current/30/60/90+).
- Dashboard v1 (`backend/app/routers/dashboard.py` +
  `frontend/app/dashboard`) - today's sales, stock alerts, total
  receivables/payables, top udhaar exposure, fast movers vs dead stock
  (30-day sales velocity).
- Purchase and Sale order UI (`frontend/app/purchases`,
  `frontend/app/sales`) with a multi-line-item order builder.
- Khata UI (`frontend/app/khata`) - party list with balance/aging,
  drill-down to a full ledger + payment-recording form.

## Checkpoint result

`tests/test_orders_ledger_api.py::test_full_trade_cycle_reflects_correctly_in_khata`
is the literal spec checkpoint, automated: purchase 100 units in, sell 20
on udhaar, record a partial 1000 payment, assert the khata balance is
exactly 2000 and stock is exactly 80. Verified both as an automated test
and manually via curl against a live server before the test was written.

**Tests at end of session: 90** (see note in SESSION-3-SUMMARY.md).

## Design decision: FIFO aging, not a balance heuristic

An earlier, simpler approach would bucket the party's *total* overdue
balance by the age of their *most recent* transaction. That's wrong for
a real khata: a customer with one very old unpaid invoice and several
recent paid-off ones should show the old amount in the 90+ bucket, not
have it hidden behind newer activity. `get_receivables_aging()`
(`backend/app/services/ledger_service.py`) applies every credit against
the oldest debit first before bucketing what's left - the standard
accounts-receivable aging algorithm - and is tested against the exact
bucket boundaries (`test_aging_bucket_edges`, parametrized at 10/35/65/120
days) and the FIFO behavior itself
(`test_aging_fifo_applies_credit_to_oldest_debit_first`).
