"""Ajoute le champ care_location (domicile|cabinet) à la table prescriptions.

Revision ID: 025
Revises: 024
Create Date: 2026-03-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "025"
down_revision: Union[str, None] = "024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "prescriptions",
        sa.Column("care_location", sa.String(20), nullable=True, server_default="domicile"),
    )


def downgrade() -> None:
    op.drop_column("prescriptions", "care_location")
