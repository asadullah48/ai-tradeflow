# TradeFlow

AI-powered inventory & accounting platform for Pakistan's wholesalers -
Portfolio Project 1 of the "AI for Pakistan Trade" series.

Built per [`SPEC-TRADEFLOW.md`](SPEC-TRADEFLOW.md) - a bilingual
(Urdu + English), mobile-first system with a real digital FTE, **Munshi
AI**, that reads the business's own data and answers questions like
*"is haftay kya order karna chahiye?"* with grounded, cited recommendations.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + Tailwind + Zustand |
| Backend | FastAPI + SQLAlchemy |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Agent | OpenAI Agents SDK, 5 read-only MCP-style tools |
| i18n | Custom React context (Urdu + English, RTL) |
| Deployment | Vercel (frontend) + Railway/Docker (backend) |

## Quick start

**Backend:**

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate      # macOS/Linux
pip install -r requirements.txt
copy .env.example .env          # cp on macOS/Linux - sqlite works out of the box
python seed.py                    # realistic 90-day demo dataset
uvicorn app.main:app --reload --port 8000
```

**Database migrations** (Alembic - only needed once you point `DATABASE_URL`
at a real Postgres instance; SQLite dev mode auto-creates tables on startup):

```bash
cd backend
alembic upgrade head          # applies backend/alembic/versions/*
alembic revision --autogenerate -m "describe your model change"   # after editing a model
```

The Docker/Railway startup command runs `alembic upgrade head`
automatically before starting the server.

**Frontend** (separate terminal):

```bash
cd frontend
npm install
copy .env.example .env.local      # cp on macOS/Linux
npm run dev
```

Open http://localhost:3000, log in with the seeded demo account:

```
Phone:    03000000000
Password: tradeflow123
```

**Tests:**

```bash
cd backend
pytest -q          # 90 tests: unit, integration, and agent golden-questions
```

## What's actually here

- **Full inventory & accounting**: bilingual party/product CRUD, purchase
  and sale orders with automatic stock movements, a khata (ledger) with
  proper FIFO udhaar aging, a live dashboard.
- **Munshi AI**: a real OpenAI Agents SDK agent with 5 read-only tools,
  a deterministic constitutional guardrail (BLOCK/FLAG patterns) that runs
  *before* any LLM call, and a graceful offline fallback so the feature
  never hard-crashes if the model API has a bad moment.
- **WhatsApp-ready reports**: daily summary and party statement, as text
  and PDF.
- **90 real tests** covering invariants (stock, balance, aging edges),
  the full trade cycle end to end through the HTTP API, and the three
  flagship Munshi AI questions with tool-citation assertions.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the pieces fit
together, and `SESSION-1-SUMMARY.md` through `SESSION-4-SUMMARY.md` for
what was built and verified in each phase of the spec's four-session plan.

## Known deviations from the spec (disclosed, not hidden)

- **`masala-store` reuse source unavailable** - the bilingual/RTL UI was
  built fresh instead of ported (see `SPEC-TRADEFLOW.md`'s execution note).
- **Next.js version**: the spec named Next.js 14; the frontend actually
  runs Next.js 16 (same App Router model, newer release) - a disclosed
  substitution, not a silent one.
- **Product catalog is ~20 items, not ~40** - a deliberate scope trim
  given the time available; still spans 5 categories with 90 days of
  transaction history, enough to exercise every feature meaningfully.
- **Live cloud deployment**: this README documents the deploy path and
  ships ready-to-use configs (`railway.json`, `Dockerfile`,
  `docker-compose.yml`), but provisioning actual Railway/Vercel
  infrastructure with real credentials wasn't done as part of this build -
  see "Deploying" below for the exact steps to finish that yourself.

## Deploying

**Frontend (Vercel):**

```bash
cd frontend
vercel --prod
# then set NEXT_PUBLIC_API_URL to your deployed backend URL in the Vercel dashboard
```

**Backend (Railway):**

```bash
cd backend
railway init
railway up
# Add a Postgres plugin in the Railway dashboard - DATABASE_URL is injected automatically
# Set JWT_SECRET and OPENAI_API_KEY in the Railway dashboard's variables tab
```

**Or self-host both with Docker:**

```bash
docker compose up --build
```

## Project structure

```
tradeflow/
├── SPEC-TRADEFLOW.md          <- the spec this was built from
├── SESSION-1-SUMMARY.md ... SESSION-4-SUMMARY.md
├── docs/ARCHITECTURE.md
├── backend/
│   ├── app/
│   │   ├── models/              <- SQLAlchemy models
│   │   ├── schemas/               <- Pydantic request/response shapes
│   │   ├── routers/                <- FastAPI endpoints
│   │   ├── services/                 <- business logic (stock, ledger, velocity, profit)
│   │   ├── agent/                      <- Munshi AI: constitution, tools, SKILL.md
│   │   └── auth/                         <- JWT + password hashing
│   ├── tests/                           <- 90 tests
│   └── seed.py                            <- demo dataset generator
├── frontend/
│   └── app/                                <- Next.js App Router pages
└── docker-compose.yml
```
