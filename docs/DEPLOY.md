# Deployment

## 1. Public demo (live, $0)

The frontend alone, with the API served in the browser.

```bash
cd frontend
vercel link --yes --project ai-tradeflow-demo
vercel deploy --prod --yes
```

`frontend/vercel.json` sets `NEXT_PUBLIC_DEMO_MODE=browser` at build time and adds security headers. Each visitor's books live in their own `localStorage`, so nothing is shared and nothing is stored server-side.

The Vercel project is connected to this repository (`vercel git connect`) with **Root Directory = `frontend`** and production branch `master`, so every push to `master` redeploys the demo. The Root Directory was set with `vercel api /v9/projects/<id> -X PATCH -f rootDirectory=frontend`.

## 2. Real backend (when a customer signs)

Any container host works, for example Koyeb, Render or Railway, with managed PostgreSQL such as Neon or Supabase. Check current free-tier limits before provisioning.

**Backend environment:**

| Variable | Value |
|---|---|
| `ENVIRONMENT` | `production`. Startup refuses the default JWT secret and SQLite, and never creates tables itself |
| `DATABASE_URL` | `postgresql://…` (psycopg2). Neon: add `?sslmode=require` |
| `JWT_SECRET` | `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `FRONTEND_ORIGIN` | The frontend URL; separate several with commas |
| `ALLOW_SIGNUP` | `true` for self-service businesses, `false` for invite-only |
| `OPENAI_API_KEY` | Optional. Without it, Munshi answers from tools without narration |

**Start command:** `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT` (already in `backend/Dockerfile` and `railway.json`). Point the host's health check at **`/health/ready`**, which returns 503 if the database is unreachable.

**Frontend:** a second Vercel project, or the same one, with `NEXT_PUBLIC_API_URL=https://<api-host>` and **without** `NEXT_PUBLIC_DEMO_MODE`.

**Before real data:**

1. Run the same smoke checks as `docs/VERIFICATION.md` against the live URL.
2. Take a database backup, restore it into a scratch database, and run the smoke checks there. Do not skip this restore drill.
3. Import opening stock and opening balances, and have the owner confirm them.

## 3. Upgrading an existing v1.1 database

`alembic upgrade head` applies `b7e2c4a91f10`:

- It creates a `businesses` table and assigns all existing rows to business `default`.
- It converts money to `NUMERIC`.
- It gives each existing sale line a cost snapshot equal to the product's cost at migration time. That is the best information available; lines posted afterwards snapshot their real cost.

Existing users keep working in business `default`.
