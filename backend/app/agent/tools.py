"""The 5 read-only tools Munshi AI can call (SPEC §7). Each one opens its
own short-lived DB session and returns plain JSON-serializable data - the
same "MCP server, zero mutation tools" boundary described in the spec.

Every function here is plain Python, callable and testable directly
without the OpenAI Agents SDK or any API key - the SDK wrapping
(`function_tool`) is layered on top in munshi_agent.py.
"""

from datetime import date as date_type, timedelta

from app import database
from app.models.party import Party
from app.models.product import Product
from app.services import ledger_service, profit_service, stock_service, velocity_service


def get_sales_velocity(product_id: str | None = None, days: int = 30) -> dict:
    db = database.SessionLocal()
    try:
        results = velocity_service.get_sales_velocity(db, product_id=product_id, days=days)
        return {
            "days": days,
            "products": [
                {
                    "product_id": r.product_id,
                    "product_name": r.product_name,
                    "unit": r.unit,
                    "qty_sold": r.qty_sold,
                    "velocity_per_day": r.velocity_per_day,
                    "current_stock": r.current_stock,
                    "recommended_reorder_qty": r.recommended_reorder_qty,
                }
                for r in results
            ],
        }
    finally:
        db.close()


def get_stock_status(below_min_only: bool = True) -> dict:
    db = database.SessionLocal()
    try:
        products = stock_service.get_stock_alerts(db, below_min_only=below_min_only)
        return {
            "below_min_only": below_min_only,
            "products": [
                {
                    "product_id": p.id,
                    "name": p.name,
                    "current_stock": p.current_stock,
                    "min_stock_level": p.min_stock_level,
                    "unit": p.unit,
                }
                for p in products
            ],
        }
    finally:
        db.close()


def get_receivables_aging(party_id: str | None = None) -> dict:
    db = database.SessionLocal()
    try:
        if party_id:
            parties = [db.get(Party, party_id)]
            parties = [p for p in parties if p is not None]
        else:
            parties = db.query(Party).all()

        out = []
        for party in parties:
            balance = ledger_service.get_party_balance(db, party.id)
            aging = ledger_service.get_receivables_aging(db, party.id)
            out.append(
                {
                    "party_id": party.id,
                    "party_name": party.name,
                    "balance": round(balance, 2),
                    "aging": {k: round(v, 2) for k, v in aging.items()},
                }
            )
        out.sort(key=lambda x: -x["balance"])
        return {"parties": out}
    finally:
        db.close()


def get_profit_summary(start: str | None = None, end: str | None = None) -> dict:
    db = database.SessionLocal()
    try:
        end_date = date_type.fromisoformat(end) if end else date_type.today()
        start_date = date_type.fromisoformat(start) if start else end_date - timedelta(days=30)
        return profit_service.get_profit_summary(db, start=start_date, end=end_date)
    finally:
        db.close()


def get_party_statement(party_id: str, start: str | None = None, end: str | None = None) -> dict:
    db = database.SessionLocal()
    try:
        party = db.get(Party, party_id)
        if party is None:
            return {"error": f"No party found with id {party_id}"}
        balance = ledger_service.get_party_balance(db, party_id)
        aging = ledger_service.get_receivables_aging(db, party_id)
        return {
            "party_id": party.id,
            "party_name": party.name,
            "balance": round(balance, 2),
            "aging": {k: round(v, 2) for k, v in aging.items()},
        }
    finally:
        db.close()


TOOL_REGISTRY = {
    "get_sales_velocity": get_sales_velocity,
    "get_stock_status": get_stock_status,
    "get_receivables_aging": get_receivables_aging,
    "get_profit_summary": get_profit_summary,
    "get_party_statement": get_party_statement,
}
