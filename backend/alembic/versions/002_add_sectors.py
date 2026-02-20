"""Add sectors table

Revision ID: 002
Revises: 001
Create Date: 2026-02-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sectors",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("cabinet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("postal_codes", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("communes", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("color", sa.String(20), nullable=False, server_default="'#3B82F6'"),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sectors")),
        sa.ForeignKeyConstraint(["cabinet_id"], ["cabinets.id"], name=op.f("fk_sectors_cabinet_id_cabinets"), ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_sectors_cabinet_id"), "sectors", ["cabinet_id"])

    # RLS policy
    op.execute("ALTER TABLE sectors ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE sectors FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY sectors_cabinet_isolation ON sectors "
        "FOR ALL "
        "USING (cabinet_id::text = current_setting('app.current_cabinet_id', true)) "
        "WITH CHECK (cabinet_id::text = current_setting('app.current_cabinet_id', true))"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS sectors_cabinet_isolation ON sectors")
    op.execute("ALTER TABLE sectors NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE sectors DISABLE ROW LEVEL SECURITY")
    op.drop_table("sectors")
