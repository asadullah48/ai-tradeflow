from datetime import date as date_type

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.ledger_entry import LedgerEntry
from app.models.party import Party
from app.models.sale_order import SaleOrder
from app.schemas.dashboard import DashboardSummary, StockAlert
from app.services import ledger_service, stock_service, velocity_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=DashboardSummary)
def get_dashboard(db: Session = Depends(get_db)):
    today = date_type.today()

    todays_orders = db.execute(select(SaleOrder).where(SaleOrder.date == today, SaleOrder.status != "void")).scalars().all()
    todays_sales_total = sum(o.total for o in todays_orders)

    stock_alerts = stock_service.get_stock_alerts(db, below_min_only=True)

    receivables = 0.0
    payables = 0.0
    exposure: list[dict] = []
    for row in ledger_service.get_all_balances(db):  # two queries, any party count
        if row["balance"] > 0:
            receivables += row["balance"]
            exposure.append({"party_id": row["party_id"], "party_name": row["party_name"], "amount": row["balance"]})
        elif row["balance"] < 0:
            payables += -row["balance"]
    exposure.sort(key=lambda x: -x["amount"])

    fast_movers, dead_stock = velocity_service.get_fast_movers_and_dead_stock(db, days=30)

    return DashboardSummary(
        todays_sales_total=round(todays_sales_total, 2),
        todays_sales_count=len(todays_orders),
        stock_alerts=[
            StockAlert(
                product_id=p.id, name=p.name, current_stock=p.current_stock,
                min_stock_level=p.min_stock_level, unit=p.unit,
            )
            for p in stock_alerts
        ],
        total_receivables=round(receivables, 2),
        total_payables=round(payables, 2),
        top_udhaar_exposure=exposure[:10],
        fast_movers=[{"product_name": v.product_name, "velocity_per_day": v.velocity_per_day} for v in fast_movers[:10]],
        dead_stock=[{"product_name": v.product_name, "current_stock": v.current_stock} for v in dead_stock[:10]],
    )
