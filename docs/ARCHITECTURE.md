# Architecture

## Request flow

```
Browser (Next.js)
  -> fetch with Authorization: Bearer <JWT>
  -> FastAPI router (app/routers/*)
      -> auth dependency verifies JWT, loads User
      -> service layer (app/services/*) does the actual work
      -> SQLAlchemy models (app/models/*) persist to SQLite/Postgres
```

Routers never contain business logic directly - they validate input via
Pydantic schemas, call a service function, and shape the response. This
is what makes the service layer independently testable (see
`tests/test_*_service.py`) without spinning up HTTP at all.

## The stock invariant

`Product.current_stock` is a cached, denormalized value. The source of
truth is the full `StockMovement` history. Every purchase/sale order
writes a movement row AND updates the cache in the same transaction
(`app/services/order_service.py` -> `app/services/stock_service.py`).
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
proper FIFO match: every credit is applied against the OLDEST outstanding
debit first, then each debit's remaining unpaid amount is bucketed by its
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

## Testing strategy

- **Service-level unit tests** (`test_*_service.py`) - direct calls
  against an isolated in-memory SQLite session, no HTTP, no auth.
- **API integration tests** (`test_*_api.py`) - through FastAPI's
  `TestClient`, exercising real HTTP request/response cycles including
  auth, validation errors, and the full trade cycle.
- **Agent golden-question tests** (`test_agent_offline.py`) - the three
  flagship questions from the spec, asserting both the tool citations
  AND the presence of correct numbers in the answer. Runs entirely
  offline (`OPENAI_API_KEY=""` forced in `conftest.py`) so CI never
  needs a real API key or makes a real network call.
