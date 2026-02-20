"""Add location_type, time_window_start, time_window_end to appointments

Revision ID: 004
Revises: 003
Create Date: 2026-02-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("appointments", sa.Column("location_type", sa.String(20), nullable=False, server_default="home"))
    op.add_column("appointments", sa.Column("time_window_start", sa.Time(), nullable=True))
    op.add_column("appointments", sa.Column("time_window_end", sa.Time(), nullable=True))


def downgrade() -> None:
    op.drop_column("appointments", "time_window_end")
    op.drop_column("appointments", "time_window_start")
    op.drop_column("appointments", "location_type")
