"""business isolation and accounting integrity (v1.2)

* businesses table; every pre-existing row belongs to business "default"
* tenant_id on order line items (so every business-owned table is scoped)
* SKU unique per business instead of globally
* exact NUMERIC money/quantity columns instead of binary floats
* sale-line cost snapshots (backfilled with the cost known at migration time)
* idempotency keys, creator and void metadata on orders; idempotency on khata

Revision ID: b7e2c4a91f10
Revises: dac001fc3702
Create Date: 2026-09-30 12:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b7e2c4a91f10"
down_revision: Union[str, Sequence[str], None] = "dac001fc3702"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MONEY = sa.Numeric(14, 2, asdecimal=False)
QTY = sa.Numeric(14, 3, asdecimal=False)

MONEY_COLUMNS = {
    "parties": {"credit_limit": MONEY, "opening_balance": MONEY},
    "products": {"cost_price": MONEY, "sale_price": MONEY, "min_stock_level": QTY, "current_stock": QTY},
    "ledger_entries": {"amount": MONEY},
    "purchase_orders": {"total": MONEY},
    "sale_orders": {"total": MONEY},
    "stock_movements": {"qty_delta": QTY},
    "purchase_order_items": {"qty": QTY, "unit_price": MONEY, "line_total": MONEY},
    "sale_order_items": {"qty": QTY, "unit_price": MONEY, "line_total": MONEY},
}


def upgrade() -> None:
    op.create_table(
        "businesses",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("city", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        "INSERT INTO businesses (id, name, city, created_at) "
        "VALUES ('default', 'My business', NULL, CURRENT_TIMESTAMP)"
    )

    for table, columns in MONEY_COLUMNS.items():
        with op.batch_alter_table(table) as batch:
            for column, type_ in columns.items():
                batch.alter_column(column, existing_type=sa.Float(), type_=type_, existing_nullable=False)

    for table in ("purchase_order_items", "sale_order_items"):
        with op.batch_alter_table(table) as batch:
            batch.add_column(sa.Column("tenant_id", sa.String(), nullable=False, server_default="default"))
            batch.create_index(f"ix_{table}_tenant_id", ["tenant_id"])
    # Inherit each line's business from its order.
    op.execute("UPDATE purchase_order_items SET tenant_id = "
               "(SELECT tenant_id FROM purchase_orders WHERE purchase_orders.id = purchase_order_items.order_id)")
    op.execute("UPDATE sale_order_items SET tenant_id = "
               "(SELECT tenant_id FROM sale_orders WHERE sale_orders.id = sale_order_items.order_id)")

    with op.batch_alter_table("sale_order_items") as batch:
        batch.add_column(sa.Column("unit_cost", MONEY, nullable=True))
    # Best available history: the cost on record when this migration runs.
    op.execute("UPDATE sale_order_items SET unit_cost = "
               "(SELECT cost_price FROM products WHERE products.id = sale_order_items.product_id)")

    for table in ("purchase_orders", "sale_orders"):
        with op.batch_alter_table(table) as batch:
            batch.add_column(sa.Column("idempotency_key", sa.String(), nullable=True))
            batch.add_column(sa.Column("created_by", sa.String(), nullable=True))
            batch.add_column(sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True))
            batch.add_column(sa.Column("void_reason", sa.String(), nullable=True))
            batch.create_foreign_key(f"fk_{table}_created_by_users", "users", ["created_by"], ["id"])
            batch.create_unique_constraint(f"uq_{table}_idempotency", ["tenant_id", "idempotency_key"])

    with op.batch_alter_table("ledger_entries") as batch:
        batch.add_column(sa.Column("idempotency_key", sa.String(), nullable=True))
        batch.create_unique_constraint("uq_ledger_entries_idempotency", ["tenant_id", "idempotency_key"])

    with op.batch_alter_table("products") as batch:
        batch.drop_index("ix_products_sku")
        batch.create_index("ix_products_sku", ["sku"], unique=False)
        batch.create_unique_constraint("uq_products_tenant_sku", ["tenant_id", "sku"])


def downgrade() -> None:
    with op.batch_alter_table("products") as batch:
        batch.drop_constraint("uq_products_tenant_sku", type_="unique")
        batch.drop_index("ix_products_sku")
        batch.create_index("ix_products_sku", ["sku"], unique=True)

    with op.batch_alter_table("ledger_entries") as batch:
        batch.drop_constraint("uq_ledger_entries_idempotency", type_="unique")
        batch.drop_column("idempotency_key")

    for table in ("purchase_orders", "sale_orders"):
        with op.batch_alter_table(table) as batch:
            batch.drop_constraint(f"uq_{table}_idempotency", type_="unique")
            batch.drop_constraint(f"fk_{table}_created_by_users", type_="foreignkey")
            for column in ("void_reason", "voided_at", "created_by", "idempotency_key"):
                batch.drop_column(column)

    with op.batch_alter_table("sale_order_items") as batch:
        batch.drop_column("unit_cost")
    for table in ("purchase_order_items", "sale_order_items"):
        with op.batch_alter_table(table) as batch:
            batch.drop_index(f"ix_{table}_tenant_id")
            batch.drop_column("tenant_id")

    for table, columns in MONEY_COLUMNS.items():
        with op.batch_alter_table(table) as batch:
            for column, type_ in columns.items():
                batch.alter_column(column, existing_type=type_, type_=sa.Float(), existing_nullable=False)

    op.drop_table("businesses")
