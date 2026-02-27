"""Référentiel RPPS médecins + colonne doctor_rpps_encrypted sur patients

Revision ID: 020
Revises: 019
Create Date: 2026-02-27

Ce que fait cette migration:
- Crée la table `rpps_doctors` (référentiel public, sans cabinet_id)
  avec index trigram GIN sur last_name et first_name
- Ajoute la colonne `doctor_rpps_encrypted` sur `patients`
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Table rpps_doctors ────────────────────────────────────────────────

    op.create_table(
        "rpps_doctors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("rpps_number", sa.String(11), nullable=False, unique=True),
        sa.Column("last_name", sa.String(150), nullable=False),
        sa.Column("first_name", sa.String(150), nullable=False),
        sa.Column("profession_code", sa.String(3), nullable=False),
        sa.Column("profession_label", sa.String(200), nullable=True),
        sa.Column("specialty_code", sa.String(10), nullable=True),
        sa.Column("specialty_label", sa.String(200), nullable=True),
        sa.Column("department", sa.String(3), nullable=True),
        sa.Column("city", sa.String(150), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # Index B-Tree sur rpps_number (unicité déjà crée mais index explicite pour les lookups)
    op.create_index("ix_rpps_doctors_rpps_number", "rpps_doctors", ["rpps_number"])

    # Index trigram GIN sur last_name et first_name
    # pg_trgm est déjà activé (migration 001)
    op.execute(
        "CREATE INDEX ix_rpps_doctors_last_name_trgm ON rpps_doctors USING gin (last_name gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX ix_rpps_doctors_first_name_trgm ON rpps_doctors USING gin (first_name gin_trgm_ops)"
    )

    # ── 2. Colonne doctor_rpps_encrypted sur patients ────────────────────────

    op.add_column(
        "patients",
        sa.Column("doctor_rpps_encrypted", sa.LargeBinary(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("patients", "doctor_rpps_encrypted")

    op.execute("DROP INDEX IF EXISTS ix_rpps_doctors_first_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_rpps_doctors_last_name_trgm")
    op.drop_index("ix_rpps_doctors_rpps_number", table_name="rpps_doctors")
    op.drop_table("rpps_doctors")
