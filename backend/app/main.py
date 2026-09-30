import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

import app.models  # noqa: F401  register every model on Base
import app.tenancy  # noqa: F401  install the business-isolation ORM hooks
from app.config import DEV_JWT_SECRET, get_settings
from app.database import Base, engine
from app.routers import (
    agent, auth, collections, dashboard, ledger, parties, products, purchase_orders, reports, sale_orders,
)

logger = logging.getLogger("tradeflow")
settings = get_settings()


def check_production_settings(s) -> None:
    """Refuse to start a production deployment with development defaults."""
    if not s.is_production:
        return
    if s.jwt_secret == DEV_JWT_SECRET or len(s.jwt_secret) < 32:
        raise RuntimeError("JWT_SECRET must be set to a random value of at least 32 characters in production")
    if s.database_url.startswith("sqlite"):
        raise RuntimeError("Production requires PostgreSQL (DATABASE_URL), not SQLite")


@asynccontextmanager
async def lifespan(_: FastAPI):
    check_production_settings(settings)
    if settings.is_production:
        logger.info("Production mode: schema is managed by `alembic upgrade head` only")
    else:
        # Development convenience; production runs Alembic migrations.
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="AI TradeFlow API",
    version="1.2.0",
    description="Inventory, khata and Munshi AI for wholesale businesses. Every authenticated "
                "request is scoped to the caller's business.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Idempotent-Replay"],
)


@app.get("/health", tags=["ops"])
def health():
    """Liveness: the process is up."""
    return {"status": "ok"}


@app.get("/health/ready", tags=["ops"])
def ready():
    """Readiness: the database answers. Point uptime checks here."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        from fastapi.responses import JSONResponse
        return JSONResponse({"status": "unavailable", "database": "unreachable"}, status_code=503)
    return {"status": "ready", "database": "ok", "environment": settings.environment}


app.include_router(auth.router)
app.include_router(auth.team_router)
app.include_router(parties.router)
app.include_router(products.router)
app.include_router(purchase_orders.router)
app.include_router(sale_orders.router)
app.include_router(ledger.router)
app.include_router(collections.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(agent.router)
