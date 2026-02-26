"""Add billing fields to patient table

Revision ID: 013
Revises: 012
Create Date: 2026-02-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("patients", sa.Column("is_ald", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("patients", sa.Column("is_maternity", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("patients", sa.Column("has_active_bsi", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("patients", sa.Column("bsi_level", sa.String(20), nullable=True))
    op.add_column("patients", sa.Column("bsi_start_date", sa.Date(), nullable=True))
    op.add_column("patients", sa.Column("bsi_end_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("patients", "bsi_end_date")
    op.drop_column("patients", "bsi_start_date")
    op.drop_column("patients", "bsi_level")
    op.drop_column("patients", "has_active_bsi")
    op.drop_column("patients", "is_maternity")
    op.drop_column("patients", "is_ald")
