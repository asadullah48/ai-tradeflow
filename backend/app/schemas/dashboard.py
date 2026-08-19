from pydantic import BaseModel


class StockAlert(BaseModel):
    product_id: str
    name: str
    current_stock: float
    min_stock_level: float
    unit: str


class DashboardSummary(BaseModel):
    todays_sales_total: float
    todays_sales_count: int
    stock_alerts: list[StockAlert]
    total_receivables: float
    total_payables: float
    top_udhaar_exposure: list[dict]
    fast_movers: list[dict]
    dead_stock: list[dict]
