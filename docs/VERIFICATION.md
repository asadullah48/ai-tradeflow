# Verification

What has been checked, how, and what has not. Updated 30 September 2026 for v1.2 (business isolation and accounting integrity).

## Verified

| Check | How | Result |
|---|---|---|
| Backend suite | `pytest -q` (SQLite in-memory, offline Munshi) | 139 passed, 3 skipped (the PostgreSQL tests) |
| PostgreSQL concurrency | `TEST_POSTGRES_URL=… pytest tests/test_postgres_concurrency.py` against PostgreSQL 16 | 12 parallel sales of 5 units in stock: exactly 5 succeed and stock ends at 0. 6 parallel retries with one Idempotency-Key post one order. Business filter holds |
| The row lock is what prevents overselling | Removed `with_for_update()` and re-ran the race | The oversell test failed in 3 of 3 runs, then passed again once the lock was restored |
| The tenancy hook is what isolates businesses | Disabled the `do_orm_execute` filter and re-ran the isolation suite | 7 of 11 isolation tests failed |
| The cost snapshot is what protects old profit | Stopped writing `unit_cost` and re-ran the accounting suite | The historical-profit test failed |
| Migrations | `alembic upgrade head`, then `alembic check`, then downgrade to the initial revision and upgrade again, on SQLite and PostgreSQL 16, with pre-existing rows | Upgrades clean with no model/schema drift. Existing rows move to business `default`; sale lines get a cost snapshot |
| Frontend | `npm run lint`, `npx tsc --noEmit`, `npm run build` in API mode and in `NEXT_PUBLIC_DEMO_MODE=browser` | Pass |
| Browser demo, end to end (Chromium, production build) | Scripted run, described below | Every step passed; no uncaught errors or console errors |
| Same UI against the real API | Production build pointed at FastAPI on the seeded database | Sign-in, dashboard, collections, credit-limit refusal and owner override, void, ledger PDF (ReportLab) and Munshi all passed. The only console error was the browser logging the expected 409 |

The scripted browser-demo run covered these steps:

1. One-click entry from the landing page to the dashboard.
2. The collections desk, with WhatsApp links.
3. An udhaar sale over the customer's credit limit, which was refused with the headroom.
4. Owner override, after which the sale posted.
5. A void, after which stock returned exactly.
6. A statement PDF download (a valid `%PDF`).
7. Munshi answering a question with its sources, and blocking a fake-invoice request.
8. Switching to the munshi role, after which void buttons and team management were no longer available.
9. Urdu at 390px on seven pages, with zero horizontal overflow.

### What the tests cover

- **Business isolation (`test_business_isolation.py`).** Two businesses on one database. Business B gets empty lists and 404s on A's ids for parties, products, orders, balances, statements and PDFs. B cannot edit, delete, void, pay against or sell A's records. Dashboard, collections, daily brief and Munshi are all scoped. The same SKU is allowed in each business. Sign-up cannot choose a role or a business. A scoped session refuses cross-business rows and cannot load them through `Session.get()`.
- **Accounting integrity (`test_accounting_integrity.py`):**
  - weighted-average cost and sale snapshots;
  - editing cost does not change yesterday's profit;
  - paisa-exact totals;
  - idempotent orders and payments, per business;
  - void of udhaar and cash sales, with stock, balance, aging and profit restored and history kept;
  - voiding a purchase whose goods were sold is refused;
  - credit-limit refusal, cash allowed, owner override recorded;
  - munshi role limits;
  - parties with history cannot be deleted;
  - collections ranking, reasons and WhatsApp links;
  - the PDF is a real PDF;
  - readiness probe;
  - production refuses the default JWT secret and SQLite.
- **Pre-existing suites** cover the stock invariant, FIFO aging, velocity, profit, the constitution, Munshi's golden questions and API validation.

## Not verified

- A hosted production backend. None is running until there is a customer; see [DEPLOY.md](DEPLOY.md).
- Munshi with a live, paid model. The code path is guarded by the same constitution; only the offline path runs in CI.
- The Expo companion on a physical device.
- Large-volume performance. Dashboard and velocity use batched queries; the collections desk reads the ledger in one pass. None of this has been profiled at thousands of parties.
- The in-browser demo engine has no unit tests of its own. It is a port of the tested backend rules and is exercised by the end-to-end run above.
