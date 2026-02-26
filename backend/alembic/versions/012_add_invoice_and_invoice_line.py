"""Add invoice and invoice_line tables

Revision ID: 012
Revises: 011
Create Date: 2026-02-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Drop existing invoice / invoice_line tables if they exist (from old stubs) ---
    op.execute("DROP TABLE IF EXISTS invoice_lines CASCADE")
    op.execute("DROP TABLE IF EXISTS invoices CASCADE")

    # --- Create invoice table ---
    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("cabinet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cabinets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("idel_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("prescription_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("invoice_number", sa.String(50), nullable=False, server_default=""),
        sa.Column("invoice_date", sa.Date(), nullable=False),
        sa.Column("care_date", sa.Date(), nullable=False),
        sa.Column("total_amo", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("total_amc", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("total_patient", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("total_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("tiers_payant_type", sa.String(20), nullable=False, server_default="total"),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("rejection_reason", sa.String(500), nullable=True),
        sa.Column("validated_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("transmitted_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("paid_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_invoices")),
    )

    # Indexes for invoices
    op.create_index("ix_invoices_cabinet_id_invoice_number", "invoices", ["cabinet_id", "invoice_number"], unique=True)
    op.create_index("ix_invoices_cabinet_id_status", "invoices", ["cabinet_id", "status"])
    op.create_index("ix_invoices_cabinet_id_patient_id", "invoices", ["cabinet_id", "patient_id"])
    op.create_index("ix_invoices_cabinet_id_care_date", "invoices", ["cabinet_id", "care_date"])

    # --- Create invoice_line table ---
    op.create_table(
        "invoice_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("appointment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("line_order", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("act_code", sa.String(30), nullable=False),
        sa.Column("act_label", sa.String(200), nullable=False, server_default=""),
        sa.Column("coefficient", sa.Numeric(8, 2), nullable=False, server_default="1"),
        sa.Column("base_rate", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=False, server_default="1"),
        sa.Column("line_subtotal", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("supplements", postgresql.JSONB(), nullable=True),
        sa.Column("supplements_total", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("line_total", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_invoice_lines")),
    )

    op.create_index("ix_invoice_lines_invoice_id", "invoice_lines", ["invoice_id"])

    # RLS policies
    op.execute("ALTER TABLE invoices ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE invoices FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY invoices_cabinet_isolation ON invoices "
        "FOR ALL "
        "USING (cabinet_id::text = current_setting('app.current_cabinet_id', true)) "
        "WITH CHECK (cabinet_id::text = current_setting('app.current_cabinet_id', true))"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS invoices_cabinet_isolation ON invoices")
    op.execute("ALTER TABLE invoices NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE invoices DISABLE ROW LEVEL SECURITY")

    op.drop_index("ix_invoice_lines_invoice_id", table_name="invoice_lines")
    op.drop_table("invoice_lines")

    op.drop_index("ix_invoices_cabinet_id_care_date", table_name="invoices")
    op.drop_index("ix_invoices_cabinet_id_patient_id", table_name="invoices")
    op.drop_index("ix_invoices_cabinet_id_status", table_name="invoices")
    op.drop_index("ix_invoices_cabinet_id_invoice_number", table_name="invoices")
    op.drop_table("invoices")
