"""Add color column to cabinet_members

Revision ID: 008
Revises: 007
Create Date: 2026-02-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "cabinet_members",
        sa.Column("color", sa.String(20), nullable=False, server_default="#3B82F6"),
    )


def downgrade() -> None:
    op.drop_column("cabinet_members", "color")
