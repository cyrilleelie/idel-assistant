"""Add sector_id, postal_code, city to patients

Revision ID: 003
Revises: 002
Create Date: 2026-02-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("patients", sa.Column("sector_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("patients", sa.Column("postal_code", sa.String(10), nullable=False, server_default=""))
    op.add_column("patients", sa.Column("city", sa.String(100), nullable=False, server_default=""))

    op.create_foreign_key(
        op.f("fk_patients_sector_id_sectors"),
        "patients", "sectors",
        ["sector_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_patients_sector_id"), "patients", ["sector_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_patients_sector_id"), table_name="patients")
    op.drop_constraint(op.f("fk_patients_sector_id_sectors"), "patients", type_="foreignkey")
    op.drop_column("patients", "city")
    op.drop_column("patients", "postal_code")
    op.drop_column("patients", "sector_id")
