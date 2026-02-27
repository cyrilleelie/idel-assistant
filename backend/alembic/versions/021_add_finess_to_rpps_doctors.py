"""Ajoute la colonne finess_site sur rpps_doctors

Revision ID: 021
Revises: 020
Create Date: 2026-02-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "rpps_doctors",
        sa.Column("finess_site", sa.String(9), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("rpps_doctors", "finess_site")
