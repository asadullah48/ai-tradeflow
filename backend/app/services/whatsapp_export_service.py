"""WhatsApp-ready report formatting (F6) - plain text sized for forwarding,
plus a simple PDF statement via reportlab."""

import io
from datetime import date as date_type

from sqlalchemy.orm import Session

from app.models.party import Party
from app.services import ledger_service, profit_service, stock_service


def build_daily_summary_text(db: Session, *, on_date: date_type | None = None) -> str:
    on_date = on_date or date_type.today()
    profit = profit_service.get_profit_summary(db, start=on_date, end=on_date)
    alerts = stock_service.get_stock_alerts(db, below_min_only=True)

    lines = [
        f"*TradeFlow — Daily Summary ({on_date.isoformat()})*",
        "",
        f"Sales: Rs {profit['revenue']:,.0f}",
        f"Cost: Rs {profit['cost']:,.0f}",
        f"Profit: Rs {profit['profit']:,.0f}",
        "",
    ]
    if alerts:
        lines.append("*Stock alerts (below minimum):*")
        for p in alerts[:10]:
            lines.append(f"- {p.name}: {p.current_stock:g} {p.unit} (min {p.min_stock_level:g})")
    else:
        lines.append("No stock alerts today.")

    return "\n".join(lines)


def build_party_statement_text(db: Session, *, party_id: str) -> str:
    party = db.get(Party, party_id)
    if party is None:
        raise ValueError(f"Party {party_id} not found")

    balance = ledger_service.get_party_balance(db, party_id)
    aging = ledger_service.get_receivables_aging(db, party_id)

    lines = [
        f"*TradeFlow — Statement for {party.name}*",
        "",
        f"Balance: Rs {balance:,.0f} {'(receivable)' if balance >= 0 else '(payable)'}",
        "",
        "*Aging:*",
    ]
    for bucket, amount in aging.items():
        if amount > 0:
            lines.append(f"- {bucket} days: Rs {amount:,.0f}")

    return "\n".join(lines)


def build_party_statement_pdf(db: Session, *, party_id: str) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    text = build_party_statement_text(db, party_id=party_id)

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setFont("Helvetica", 11)

    y = 800
    for raw_line in text.split("\n"):
        line = raw_line.replace("*", "")  # strip WhatsApp-style markdown bold markers
        pdf.drawString(40, y, line)
        y -= 18
    pdf.showPage()
    pdf.save()

    buffer.seek(0)
    return buffer.read()
