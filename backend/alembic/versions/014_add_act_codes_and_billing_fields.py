"""Add act_codes to care_protocols/appointments, distance_km to appointments,
appointment_id to invoices, drop appointment_id from invoice_lines.

Revision ID: 014
Revises: 013
Create Date: 2026-02-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, UUID


revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # care_protocols: add act_codes
    op.add_column(
        "care_protocols",
        sa.Column("act_codes", ARRAY(sa.String(30)), nullable=True),
    )

    # appointments: add act_codes and distance_km
    op.add_column(
        "appointments",
        sa.Column("act_codes", ARRAY(sa.String(30)), nullable=True),
    )
    op.add_column(
        "appointments",
        sa.Column("distance_km", sa.Numeric(6, 2), nullable=True),
    )

    # invoices: add appointment_id FK
    op.add_column(
        "invoices",
        sa.Column(
            "appointment_id",
            UUID(as_uuid=True),
            sa.ForeignKey("appointments.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_invoices_appointment_id",
        "invoices",
        ["appointment_id"],
    )

    # invoice_lines: drop appointment_id
    op.drop_column("invoice_lines", "appointment_id")


def downgrade() -> None:
    # invoice_lines: restore appointment_id
    op.add_column(
        "invoice_lines",
        sa.Column("appointment_id", UUID(as_uuid=True), nullable=True),
    )

    # invoices: drop appointment_id
    op.drop_index("ix_invoices_appointment_id", table_name="invoices")
    op.drop_column("invoices", "appointment_id")

    # appointments: drop act_codes and distance_km
    op.drop_column("appointments", "distance_km")
    op.drop_column("appointments", "act_codes")

    # care_protocols: drop act_codes
    op.drop_column("care_protocols", "act_codes")
