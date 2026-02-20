"""Update tournees: drop savings/optimization, rename duration, add travel_time

Revision ID: 005
Revises: 004
Create Date: 2026-02-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("tournees", "savings_km")
    op.drop_column("tournees", "savings_minutes")
    op.drop_column("tournees", "optimization_params")
    op.drop_column("tournees", "optimized_at")

    op.alter_column("tournees", "total_duration_hours", new_column_name="total_duration_minutes")
    op.add_column("tournees", sa.Column("travel_time_minutes", sa.Float(), nullable=False, server_default="0"))

    # Update default status from 'draft' to 'planned'
    op.alter_column("tournees", "status", server_default="planned")


def downgrade() -> None:
    op.alter_column("tournees", "status", server_default="draft")
    op.drop_column("tournees", "travel_time_minutes")
    op.alter_column("tournees", "total_duration_minutes", new_column_name="total_duration_hours")

    op.add_column("tournees", sa.Column("savings_km", sa.Float(), nullable=False, server_default="0"))
    op.add_column("tournees", sa.Column("savings_minutes", sa.Float(), nullable=False, server_default="0"))
    op.add_column("tournees", sa.Column("optimization_params", postgresql.JSONB(), nullable=True))
    op.add_column("tournees", sa.Column("optimized_at", postgresql.TIMESTAMP(timezone=True), nullable=True))
