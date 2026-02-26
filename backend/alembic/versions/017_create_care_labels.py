"""Create care_labels table

Revision ID: 017
Revises: 016
Create Date: 2026-02-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "care_labels",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("cabinet_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column(
            "act_codes", postgresql.ARRAY(sa.String(30)), nullable=False
        ),
        sa.Column("default_duration_minutes", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column(
            "is_system", sa.Boolean(), server_default="true", nullable=False
        ),
        sa.Column(
            "is_active", sa.Boolean(), server_default="true", nullable=False
        ),
        sa.Column(
            "display_order", sa.Integer(), server_default="0", nullable=False
        ),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_care_labels")),
        sa.ForeignKeyConstraint(
            ["cabinet_id"],
            ["cabinets.id"],
            name=op.f("fk_care_labels_cabinet_id_cabinets"),
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "cabinet_id", "label", name="uq_care_labels_cabinet_id_label"
        ),
    )
    op.create_index(
        "ix_care_labels_cabinet_category",
        "care_labels",
        ["cabinet_id", "category"],
    )
    op.create_index(
        op.f("ix_care_labels_cabinet_id"),
        "care_labels",
        ["cabinet_id"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_care_labels_cabinet_id"), table_name="care_labels")
    op.drop_index("ix_care_labels_cabinet_category", table_name="care_labels")
    op.drop_table("care_labels")
