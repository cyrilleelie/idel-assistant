"""Crée la table agent_audit_log (audit immuable des appels outils IA)

Revision ID: 024
Revises: 023
Create Date: 2026-03-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "024"
down_revision: Union[str, None] = "023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cabinet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("session_id", sa.String(36), nullable=False),
        sa.Column("tool_name", sa.String(100), nullable=False),
        sa.Column("tool_input", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("tool_output", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("llm_model", sa.String(100), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.ForeignKeyConstraint(["cabinet_id"], ["cabinets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_agent_audit_log_cabinet_created",
        "agent_audit_log",
        ["cabinet_id", "created_at"],
    )
    op.create_index(
        "ix_agent_audit_log_session_id",
        "agent_audit_log",
        ["session_id"],
    )
    # Rendre la table immuable (conformité HDS) — seuls INSERT et SELECT autorisés
    op.execute("REVOKE UPDATE, DELETE ON agent_audit_log FROM PUBLIC")


def downgrade() -> None:
    op.execute("GRANT UPDATE, DELETE ON agent_audit_log TO PUBLIC")
    op.drop_index("ix_agent_audit_log_session_id", table_name="agent_audit_log")
    op.drop_index("ix_agent_audit_log_cabinet_created", table_name="agent_audit_log")
    op.drop_table("agent_audit_log")
