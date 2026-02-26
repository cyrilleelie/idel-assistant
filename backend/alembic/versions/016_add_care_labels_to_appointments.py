"""Add care_labels array to appointments

Revision ID: 016
Revises: 015
Create Date: 2026-02-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "appointments",
        sa.Column("care_labels", postgresql.ARRAY(sa.String(200)), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("appointments", "care_labels")
