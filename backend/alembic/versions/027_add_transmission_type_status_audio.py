"""Ajoute type, status, audio_file_path sur transmissions.

Supporte les transmissions vocales et le pipeline IA (transcription + synthèse).

Revision ID: 027
Revises: 026
Create Date: 2026-03-04
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "027"
down_revision: Union[str, None] = "026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transmissions",
        sa.Column("type", sa.String(20), nullable=False, server_default="written"),
    )
    op.add_column(
        "transmissions",
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
    )
    op.add_column(
        "transmissions",
        sa.Column("audio_file_path", sa.String(500), nullable=True),
    )

    op.create_index("ix_transmissions_type", "transmissions", ["type"])
    op.create_index("ix_transmissions_status", "transmissions", ["status"])


def downgrade() -> None:
    op.drop_index("ix_transmissions_status", table_name="transmissions")
    op.drop_index("ix_transmissions_type", table_name="transmissions")
    op.drop_column("transmissions", "audio_file_path")
    op.drop_column("transmissions", "status")
    op.drop_column("transmissions", "type")
