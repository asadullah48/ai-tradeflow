# Architecture

## Request flow

```
Browser (Next.js)
  -> fetch with Authorization: Bearer <JWT>          (or lib/demo in browser-demo mode)
  -> FastAPI router (app/routers/*)
      -> get_current_user verifies JWT, loads User, scope_session(db, user.tenant_id)
      -> service layer (app/services/*) does the actual work
      -> SQLAlchemy models (app/models/*) persist to PostgreSQL / SQLite
```

Routers never contain business logic directly - they validate input via
Pydantic schemas, call a service function, and shape the response. This
is what makes the service layer independently testable (see
`tests/test_*_service.py`) without spinning up HTTP at all.

## Business isolation

`app/tenancy.py` is the only place tenancy lives. Once `get_current_user`
scopes the request's session:

- `do_orm_execute` adds `with_loader_criteria(TenantMixin, tenant_id == caller)`
  to every ORM SELECT/UPDATE/DELETE - joins, relationship loads and
  `Session.get()` included;
- `before_flush` stamps new rows with the caller's business and refuses to
  flush a new, changed or deleted row that belongs to another business;
- a session cannot be re-scoped to a different business.

Every business-owned table (including order line items) carries `tenant_id`.
Phone numbers are global logins; SKUs and idempotency keys are unique per
business. Munshi's tools open their own sessions and scope them to the
tenant bound in `munshi_agent.py` - the model never sees that parameter.
Raw `text()` SQL would bypass the hook; the application uses none for
business data.

Roles: `owner` (everything) and `munshi` (trade and payments). Voids,
credit-limit overrides, party deletion and team changes require the owner.

## Posting, costing and corrections

- **Weighted-average cost.** A purchase re-averages `Product.cost_price`
  over stock on hand; each sale line snapshots it as `unit_cost`, and
  profit reads the snapshot. Money columns are `NUMERIC`; totals are
  computed with `Decimal` and quantized to the paisa.
- **Idempotency.** `Idempotency-Key` on `POST /sale-orders`,
  `/purchase-orders` and `/ledger/entries`. A replay returns the original
  with `200` and `Idempotent-Replay: true`; a concurrent duplicate loses the
  race to the `(tenant_id, idempotency_key)` unique constraint and gets the
  winner's record.
- **Void, never edit.** `POST /{sale,purchase}-orders/{id}/void` (owner)
  appends reversing stock movements and a reversing khata line for every
  line tied to the order, marks it `void` with the reason, and excludes it
  from profit, velocity and today's sales. A purchase whose goods were
  already sold cannot be voided.
- **Credit limit.** A udhaar sale that would take a customer past a
  non-zero `credit_limit` returns `409 {code: "credit_limit_exceeded", …}`
  with the available headroom. `override_credit_limit: true` (owner only)
  posts it and writes the approval on the invoice line.

## Collections desk

`app/services/collections_service.py` ranks every customer with a positive
balance by weighted aging (`current 0.25, 30 1, 60 2, 90+ 3` per rupee),
×1.25 if over their credit limit and ×1.1 if silent for 30+ days or with no
payment ever. Each row carries its reasons and a reminder in Roman Urdu and
English, with a `wa.me` link built from a normalised Pakistani mobile
number. Nothing is sent by the system.

## The stock invariant

`Product.current_stock` is a cached, denormalized value. The source of
truth is the full `StockMovement` history. Every purchase/sale order
writes a movement row AND updates the cache in the same transaction
(`app/services/order_service.py` -> `app/services/stock_service.py`).
Orders validate eligible parties, positive quantities, nonnegative prices and available stock before posting. Product rows are locked in a stable order on PostgreSQL; concurrency still needs production-database verification.

When `ledger_method` is supplied, the same transaction posts the party invoice and any immediate settlement. Credit sales debit customer khata; credit purchases credit supplier khata. Paying a supplier debits their balance. Legacy callers omitting this field retain separate ledger posting.
A repair endpoint (`POST /products/{id}/recompute-stock`) recomputes the
cache from scratch if it ever drifts - tested in
`test_stock_service.py::test_recompute_current_stock_matches_movement_sum`.

## The ledger and udhaar aging

`LedgerEntry.type` is `debit` (increases what a party owes) or `credit`
(decreases it). Balance is always derived - never stored as an editable
field:

```
balance = party.opening_balance + sum(debits) - sum(credits)
```

Aging (`app/services/ledger_service.py::get_receivables_aging`) does a
proper invoice-aware FIFO match: referenced settlement credits pay their
own invoice first; general receipts pay the OLDEST outstanding debit first, then each debit's remaining unpaid amount is bucketed by its
age (current / 30 / 60 / 90+). This is real accounts-receivable aging,
not a balance-minus-recent-payments approximation.

## Munshi AI - three layers

```
1. app/agent/constitution.py   - deterministic BLOCK/FLAG pattern matching,
                                   runs BEFORE anything else, zero LLM cost
2. app/agent/tools.py           - 5 plain Python functions wrapping the
                                    service layer, each opens its own DB
                                    session, fully testable without the SDK
3. app/agent/munshi_agent.py     - wires 1+2 into an OpenAI Agents SDK
                                     Agent, with an InputGuardrail mirroring
                                     the constitution, and a graceful
                                     fallback to tool-grounded-but-
                                     unnarrated answers if the LLM call
                                     fails or no API key is configured
```

A BLOCK never reaches the LLM or any tool - `ask_munshi()` checks it
first and returns immediately. This is a hard architectural boundary,
not a prompt instruction the model could be talked out of.

## Why tools open their own DB sessions

Each tool in `app/agent/tools.py` is written to be a self-contained,
stateless call - exactly the shape a real MCP tool has when exposed over
a network boundary to an agent that isn't trusted with a live transaction.
This is intentional even though the agent currently runs in-process: it's
the same code shape that would let these tools be lifted into an actual
standalone MCP server later without a rewrite.

## Browser demo mode

`frontend/lib/demo/` (engine, seed, adapter, pdf) is a TypeScript port of
the service rules above. With `NEXT_PUBLIC_DEMO_MODE=browser`,
`lib/api.ts` hands every request to the adapter instead of `fetch`, with
the same routes, status codes and error shapes. Books persist in
`localStorage` per visitor. This is how the public demo runs without paying
for a server.

## Testing strategy

- **Service-level unit tests** (`test_*_service.py`) - direct calls
  against an isolated in-memory SQLite session, no HTTP, no auth.
- **API integration tests** (`test_*_api.py`) - through FastAPI's
  `TestClient`, exercising real HTTP request/response cycles including
  auth, validation errors, and the full trade cycle.
- **Isolation and accounting tests** (`test_business_isolation.py`,
  `test_accounting_integrity.py`) - two businesses attacking each other
  through every endpoint; cost snapshots, idempotency, voids, credit limits.
- **PostgreSQL concurrency tests** (`test_postgres_concurrency.py`) - run
  when `TEST_POSTGRES_URL` is set (CI sets it): oversell and idempotency
  races with real row locks.
- **Agent golden-question tests** (`test_agent_offline.py`) - the three
  flagship questions from the spec, asserting both the tool citations
  AND the presence of correct numbers in the answer. Runs entirely
  offline (`OPENAI_API_KEY=""` forced in `conftest.py`) so CI never
  needs a real API key or makes a real network call.

## Web performance

The khata overview uses `/ledger/balances`, with two database reads for parties and entries. It reuses the FIFO aging calculation used by individual statements. Search is debounced and stale responses are ignored; auth redirects wait for saved-session hydration. Shared catalog and order components keep purchase/sale and party/product behavior consistent.
