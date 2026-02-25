"""Refactor care_type_catalog and add tariff_updates table

Revision ID: 011
Revises: 010
Create Date: 2026-02-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Refactor care_type_catalog ---
    # Make cabinet_id nullable (system acts have NULL cabinet_id)
    op.alter_column("care_type_catalog", "cabinet_id", nullable=True)

    # Add new columns
    op.add_column("care_type_catalog", sa.Column("lettre_cle", sa.String(10), nullable=False, server_default=""))
    op.add_column("care_type_catalog", sa.Column("coefficient", sa.Numeric(8, 2), nullable=True))
    op.add_column("care_type_catalog", sa.Column("fixed_amount", sa.Numeric(10, 2), nullable=True))
    op.add_column("care_type_catalog", sa.Column("unit", sa.String(20), nullable=False, server_default="acte"))
    op.add_column("care_type_catalog", sa.Column("is_cumulative", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("care_type_catalog", sa.Column("cumul_rules", postgresql.JSONB(), nullable=True))
    op.add_column("care_type_catalog", sa.Column("context_rules", postgresql.JSONB(), nullable=True))
    op.add_column("care_type_catalog", sa.Column("effective_from", sa.Date(), nullable=True))
    op.add_column("care_type_catalog", sa.Column("effective_to", sa.Date(), nullable=True))
    op.add_column("care_type_catalog", sa.Column("avenant_source", sa.String(50), nullable=True))
    op.add_column("care_type_catalog", sa.Column("is_system", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("care_type_catalog", sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"))

    # Make default_duration_minutes nullable
    op.alter_column("care_type_catalog", "default_duration_minutes", nullable=True)

    # Make base_rate nullable (some acts use fixed_amount instead)
    op.alter_column("care_type_catalog", "base_rate", nullable=True)

    # Set effective_from for existing rows then make NOT NULL
    op.execute("UPDATE care_type_catalog SET effective_from = '2024-01-28' WHERE effective_from IS NULL")
    op.alter_column("care_type_catalog", "effective_from", nullable=False)

    # Widen code and label columns
    op.alter_column("care_type_catalog", "code", type_=sa.String(30))
    op.alter_column("care_type_catalog", "label", type_=sa.String(200))
    op.alter_column("care_type_catalog", "category", type_=sa.String(30))

    # Create indexes
    op.create_index("ix_care_type_catalog_code_effective", "care_type_catalog", ["cabinet_id", "code", "effective_from"])
    op.create_index("ix_care_type_catalog_category", "care_type_catalog", ["category"])
    op.create_index("ix_care_type_catalog_lettre_cle", "care_type_catalog", ["lettre_cle"])

    # --- Create tariff_updates table ---
    op.create_table(
        "tariff_updates",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("version", sa.String(20), nullable=False),
        sa.Column("avenant_reference", sa.String(50), nullable=True),
        sa.Column("published_at", sa.Date(), nullable=True),
        sa.Column("effective_at", sa.Date(), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("changes", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("status", sa.String(20), nullable=False, server_default="'available'"),
        sa.Column("applied_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tariff_updates")),
    )

    # RLS policy for care_type_catalog: allow access to system acts (cabinet_id IS NULL) + own cabinet
    # Drop existing policy if any, then recreate
    op.execute("DROP POLICY IF EXISTS care_type_catalog_cabinet_isolation ON care_type_catalog")
    op.execute("ALTER TABLE care_type_catalog ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE care_type_catalog FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY care_type_catalog_cabinet_isolation ON care_type_catalog "
        "FOR ALL "
        "USING (cabinet_id IS NULL OR cabinet_id::text = current_setting('app.current_cabinet_id', true)) "
        "WITH CHECK (cabinet_id IS NULL OR cabinet_id::text = current_setting('app.current_cabinet_id', true))"
    )


def downgrade() -> None:
    # Drop RLS
    op.execute("DROP POLICY IF EXISTS care_type_catalog_cabinet_isolation ON care_type_catalog")
    op.execute("ALTER TABLE care_type_catalog NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE care_type_catalog DISABLE ROW LEVEL SECURITY")

    # Drop tariff_updates
    op.drop_table("tariff_updates")

    # Drop indexes
    op.drop_index("ix_care_type_catalog_lettre_cle", table_name="care_type_catalog")
    op.drop_index("ix_care_type_catalog_category", table_name="care_type_catalog")
    op.drop_index("ix_care_type_catalog_code_effective", table_name="care_type_catalog")

    # Drop new columns
    op.drop_column("care_type_catalog", "display_order")
    op.drop_column("care_type_catalog", "is_system")
    op.drop_column("care_type_catalog", "avenant_source")
    op.drop_column("care_type_catalog", "effective_to")
    op.drop_column("care_type_catalog", "effective_from")
    op.drop_column("care_type_catalog", "context_rules")
    op.drop_column("care_type_catalog", "cumul_rules")
    op.drop_column("care_type_catalog", "is_cumulative")
    op.drop_column("care_type_catalog", "unit")
    op.drop_column("care_type_catalog", "fixed_amount")
    op.drop_column("care_type_catalog", "coefficient")
    op.drop_column("care_type_catalog", "lettre_cle")

    # Restore NOT NULL on cabinet_id
    op.alter_column("care_type_catalog", "cabinet_id", nullable=False)
    op.alter_column("care_type_catalog", "default_duration_minutes", nullable=False)
    op.alter_column("care_type_catalog", "base_rate", nullable=False)

    # Restore column sizes
    op.alter_column("care_type_catalog", "code", type_=sa.String(20))
    op.alter_column("care_type_catalog", "label", type_=sa.String(100))
    op.alter_column("care_type_catalog", "category", type_=sa.String(20))
