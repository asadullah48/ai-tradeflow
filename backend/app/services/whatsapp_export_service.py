"""WhatsApp-ready report formatting (F6) - plain text sized for forwarding,
plus a simple PDF statement via reportlab."""

import io
from datetime import date as date_type

from sqlalchemy.orm import Session

from app.models.ledger_entry import LedgerEntry
from app.models.party import Party
from app.services import ledger_service, profit_service, stock_service


def build_daily_summary_text(db: Session, *, on_date: date_type | None = None, business_name: str = "TradeFlow") -> str:
    on_date = on_date or date_type.today()
    profit = profit_service.get_profit_summary(db, start=on_date, end=on_date)
    alerts = stock_service.get_stock_alerts(db, below_min_only=True)

    lines = [
        f"*{business_name} — Daily Summary ({on_date.isoformat()})*",
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


def build_party_statement_text(db: Session, *, party_id: str, business_name: str = "TradeFlow") -> str:
    party = db.get(Party, party_id)
    if party is None:
        raise ValueError(f"Party {party_id} not found")

    balance = ledger_service.get_party_balance(db, party_id)
    aging = ledger_service.get_receivables_aging(db, party_id)

    lines = [
        f"*{business_name} — Statement for {party.name}*",
        "",
        f"Balance: Rs {abs(balance):,.0f} {'(receivable)' if balance > 0 else '(payable)' if balance < 0 else '(settled)'}",
        "",
        "*Aging:*",
    ]
    for bucket, amount in aging.items():
        if amount > 0:
            lines.append(f"- {bucket} days: Rs {amount:,.0f}")

    return "\n".join(lines)


def build_party_statement_pdf(db: Session, *, party_id: str, business_name: str = "TradeFlow") -> bytes:
    """A one-document khata statement: header, balance, aging and the full
    ledger with a running balance - what a trader hands a customer."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet

    party = db.get(Party, party_id)
    if party is None:
        raise ValueError(f"Party {party_id} not found")
    balance = ledger_service.get_party_balance(db, party_id)
    aging = ledger_service.get_receivables_aging(db, party_id)
    entries = (
        db.query(LedgerEntry).filter(LedgerEntry.party_id == party_id)
        .order_by(LedgerEntry.date, LedgerEntry.created_at).all()
    )

    styles = getSampleStyleSheet()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm,
                            title=f"Statement - {party.name}", author=business_name)
    story = [
        Paragraph(f"<b>{_esc(business_name)}</b>", styles["Title"]),
        Paragraph(f"Khata statement: <b>{_esc(party.name)}</b>" + (f" · {_esc(party.city)}" if party.city else ""), styles["Normal"]),
        Paragraph(f"Generated {date_type.today().isoformat()}", styles["Normal"]),
        Spacer(1, 6 * mm),
        Paragraph(
            f"<b>Balance: Rs {abs(balance):,.2f}</b> "
            f"{'(receivable - they owe you)' if balance > 0 else '(payable - you owe them)' if balance < 0 else '(settled)'}",
            styles["Heading3"],
        ),
    ]
    aging_table = Table(
        [["Current", "30+ days", "60+ days", "90+ days"],
         [f"Rs {aging[b]:,.0f}" for b in ("current", "30", "60", "90+")]],
        hAlign="LEFT",
    )
    aging_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8f3ef")),
    ]))
    story += [aging_table, Spacer(1, 6 * mm)]

    cell = styles["Normal"].clone("cell", fontSize=8.5, leading=10.5)
    running = party.opening_balance
    rows = [["Date", "Details", "Debit", "Credit", "Balance"]]
    if party.opening_balance:
        rows.append(["", "Opening balance", "", "", f"{running:,.2f}"])
    for e in entries:
        running += e.amount if e.type == "debit" else -e.amount
        rows.append([
            e.date.isoformat(), Paragraph(_esc(_details(e)), cell),
            f"{e.amount:,.2f}" if e.type == "debit" else "",
            f"{e.amount:,.2f}" if e.type == "credit" else "",
            f"{running:,.2f}",
        ])
    ledger_table = Table(rows, colWidths=[24 * mm, 76 * mm, 26 * mm, 26 * mm, 26 * mm], repeatRows=1)
    ledger_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, colors.HexColor("#102f3a")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    story += [ledger_table, Spacer(1, 6 * mm),
              Paragraph("Debit increases what the party owes; credit is a payment or reversal.", styles["Italic"])]
    doc.build(story)
    buffer.seek(0)
    return buffer.read()


def _details(entry: LedgerEntry) -> str:
    note = (entry.note or "").strip() or "Entry"
    # Invoice lines are always "udhaar"; the method only informs payments.
    return note if entry.method == "udhaar" else f"{note} ({entry.method})"


def _esc(value: str) -> str:
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
