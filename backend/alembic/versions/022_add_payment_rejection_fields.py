"""Ajoute les colonnes de paiement et rejet sur la table invoices

Revision ID: 022
Revises: 021
Create Date: 2026-02-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "022"
down_revision: Union[str, None] = "021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Colonnes paiement
    op.add_column("invoices", sa.Column("payment_date", sa.Date(), nullable=True))
    op.add_column("invoices", sa.Column("payment_reference", sa.String(100), nullable=True))
    op.add_column("invoices", sa.Column("payment_amount", sa.Numeric(10, 2), nullable=True))
    # Colonnes rejet
    op.add_column("invoices", sa.Column("rejection_code", sa.String(10), nullable=True))
    op.add_column("invoices", sa.Column("rejected_at", sa.TIMESTAMP(timezone=True), nullable=True))
    # Colonne auto-correction (FK vers la nouvelle facture corrigeant celle-ci)
    op.add_column(
        "invoices",
        sa.Column("corrected_invoice_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_invoices_corrected_invoice_id",
        "invoices",
        "invoices",
        ["corrected_invoice_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_invoices_corrected_invoice_id", "invoices", ["corrected_invoice_id"])


def downgrade() -> None:
    op.drop_index("ix_invoices_corrected_invoice_id", table_name="invoices")
    op.drop_constraint("fk_invoices_corrected_invoice_id", "invoices", type_="foreignkey")
    op.drop_column("invoices", "corrected_invoice_id")
    op.drop_column("invoices", "rejected_at")
    op.drop_column("invoices", "rejection_code")
    op.drop_column("invoices", "payment_amount")
    op.drop_column("invoices", "payment_reference")
    op.drop_column("invoices", "payment_date")
