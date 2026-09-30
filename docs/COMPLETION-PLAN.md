# AI TradeFlow: completion criteria

## Current milestone: v1.2, production-ready, pilot-pending

The v1.1 "polished local MVP" listed gates before accepting real customer data. This table records how each was closed, and what is still open.

| Gate | Status | Evidence |
|---|---|---|
| Business isolation | **Closed** | Business per sign-up. Tenant scope is enforced for every ORM query, write and Munshi tool (`app/tenancy.py`). Sign-up cannot choose a role; owners add staff via `/team`. Two-business leak tests cover every endpoint (`tests/test_business_isolation.py`) |
| Accounting precision | **Closed** | `NUMERIC(14,2)` money and `NUMERIC(14,3)` quantities. Weighted-average cost is snapshotted on each sale line. A test proves that changing today's cost cannot alter yesterday's profit |
| Posting reliability | **Closed** | `Idempotency-Key` on orders and payments. PostgreSQL concurrency tests (oversell race, idempotency race) run in CI. Corrections are owner-only voids by reversal; the free-form status `PATCH` was removed |
| Fulfilment | **Decided** | An order posts on delivery or receipt. A partial delivery is posted as separate orders, and a return is a void. A draft/partial state machine is not built |
| Operations | **Partly closed** | Production refuses dev secrets and SQLite; schema is migration-only; `/health/ready`; migration round-trip in CI. A backup-and-restore drill must be run on the chosen host before real data |
| Launch | **Demo live, backend on hold** | Public demo on Vercel, running in-browser. The backend is not hosted until a customer signs ([DEPLOY.md](DEPLOY.md)) |
| Native mobile | **Open** | The Expo companion typechecks and bundles; device checks are outstanding |

## Practical launch sequence (unchanged in spirit)

1. Pilot with one wholesaler on a small container plus managed PostgreSQL. Run the restore drill first.
2. Verify opening stock and party balances with the owner before importing real records.
3. Measure time to record a sale, reconcile khata and prepare a reorder. Use that evidence for the case study and a paid implementation offer.

Do not describe deployment, business impact or customers that do not exist.
