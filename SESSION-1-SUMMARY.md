# Session 1 — Foundation

**Spec target:** repo setup, SQLAlchemy models + migrations, auth with
owner/munshi roles, Parties + Products CRUD (API + UI), bilingual fields,
i18n scaffold, 25+ tests passing.

## What was built

- Fresh repo (`tradeflow/`) - Open Decision #3 resolved as a clean start,
  not a fork of cmt-stitching-system.
- All 9 SQLAlchemy models from SPEC §5 (`backend/app/models/`), each with
  a `tenant_id` column per Open Decision #2 (present, not yet enforced).
- JWT auth (`backend/app/auth/`) with `owner`/`munshi` roles. Password
  hashing uses `bcrypt` directly rather than `passlib` - see the gotcha
  note below.
- Parties and Products CRUD, both API (`backend/app/routers/`) and UI
  (`frontend/app/parties`, `frontend/app/products`), with Urdu name
  fields (`name_ur`) and Urdu-aware search (`ilike` across both scripts).
- A fresh i18n layer (`frontend/lib/i18n.tsx` + `frontend/lib/messages.ts`)
  since `masala-store` wasn't available to port from - a lightweight React
  context, not a library dependency, switching `dir="rtl"`/`dir="ltr"` on
  language change.

## Checkpoint result

Verified live via the seeded demo data and manual API smoke tests: a
supplier and a product can be created through the actual running system,
data persists across a server restart (SQLite file), and the bilingual
search works (`?q=لاہور` correctly finds a party by its Urdu name).

**Tests at end of session: 90** (final count after Session 3's agent
suite - see the note in SESSION-3-SUMMARY.md about why the count wasn't
frozen module-by-module).

## A real gotcha hit and fixed

`passlib==1.7.4` (last released 2020) is incompatible with modern
`bcrypt>=4.1` - its own internal backend self-test crashes with
`ValueError: password cannot be longer than 72 bytes`, before ever
touching a real password. Fixed by dropping `passlib` and hashing
directly with the `bcrypt` package (`backend/app/auth/security.py`) -
less code, no legacy dependency, no hidden self-test.

## A gap found on later review, and closed

A post-hoc audit against this session's own checkpoint ("SQLAlchemy
models + Alembic migrations") found that Alembic had only been scaffolded
as an empty `alembic/versions/` folder - the app was actually relying
entirely on `Base.metadata.create_all()` at startup, which works for
SQLite dev but isn't how you manage schema changes against a real
production Postgres database. Closed by properly running `alembic init`,
wiring `alembic/env.py` to the app's own `Base.metadata` and
`DATABASE_URL` setting, and generating+applying an initial migration
(`alembic/versions/dac..._initial_schema.py`) covering all 10 tables -
verified against SQLite; not live-verified against Postgres since Docker
Desktop wasn't running in this environment, but the generated migration
uses only standard, portable SQLAlchemy types (String, Float,
DateTime(timezone=True), JSON, ForeignKey), so risk is low. The
Docker/Railway startup commands now run `alembic upgrade head` before
starting the server.
