"""Add schedule_assignments table

Revision ID: 009
Revises: 008
Create Date: 2026-02-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "schedule_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("cabinet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nurse_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slot_id", sa.String(50), nullable=False),
        sa.Column("assigned_date", sa.Date(), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_schedule_assignments")),
        sa.ForeignKeyConstraint(["cabinet_id"], ["cabinets.id"], name=op.f("fk_schedule_assignments_cabinet_id_cabinets"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["nurse_id"], ["users.id"], name=op.f("fk_schedule_assignments_nurse_id_users"), ondelete="CASCADE"),
        sa.UniqueConstraint("cabinet_id", "nurse_id", "slot_id", "assigned_date", name="uq_schedule_assignment_key"),
    )
    op.create_index(op.f("ix_schedule_assignments_cabinet_id"), "schedule_assignments", ["cabinet_id"])
    op.create_index(op.f("ix_schedule_assignments_nurse_id"), "schedule_assignments", ["nurse_id"])
    op.create_index(op.f("ix_schedule_assignments_assigned_date"), "schedule_assignments", ["assigned_date"])

    # RLS policy
    op.execute("ALTER TABLE schedule_assignments ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE schedule_assignments FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY schedule_assignments_cabinet_isolation ON schedule_assignments "
        "FOR ALL "
        "USING (cabinet_id::text = current_setting('app.current_cabinet_id', true)) "
        "WITH CHECK (cabinet_id::text = current_setting('app.current_cabinet_id', true))"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS schedule_assignments_cabinet_isolation ON schedule_assignments")
    op.execute("ALTER TABLE schedule_assignments NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE schedule_assignments DISABLE ROW LEVEL SECURITY")
    op.drop_table("schedule_assignments")
