from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine
from app.routers import agent, auth, dashboard, ledger, parties, products, purchase_orders, reports, sale_orders

settings = get_settings()

app = FastAPI(title="TradeFlow API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    # Dev convenience only - production uses Alembic migrations
    # (see alembic/ and README "Database migrations").
    import app.models  # noqa: F401  ensure every model is registered on Base
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(parties.router)
app.include_router(products.router)
app.include_router(purchase_orders.router)
app.include_router(sale_orders.router)
app.include_router(ledger.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(agent.router)
