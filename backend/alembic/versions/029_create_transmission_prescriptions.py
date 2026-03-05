"""Create transmission_prescriptions liaison table.

Revision ID: 029
Revises: 028
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "029"
down_revision: str = "028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "transmission_prescriptions",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("transmission_id", UUID(as_uuid=True), nullable=False),
        sa.Column("prescription_id", UUID(as_uuid=True), nullable=False),
        sa.Column("is_auto_resolved", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["transmission_id"], ["transmissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["prescription_id"], ["prescriptions.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("transmission_id", "prescription_id", name="uq_transmission_prescription"),
    )
    op.create_index("ix_transmission_prescriptions_transmission_id", "transmission_prescriptions", ["transmission_id"])
    op.create_index("ix_transmission_prescriptions_prescription_id", "transmission_prescriptions", ["prescription_id"])


def downgrade() -> None:
    op.drop_index("ix_transmission_prescriptions_prescription_id")
    op.drop_index("ix_transmission_prescriptions_transmission_id")
    op.drop_table("transmission_prescriptions")
