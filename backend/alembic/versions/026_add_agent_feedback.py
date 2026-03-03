"""Crée la table agent_feedback (retours terrain sur les réponses IA)

Chaque 👍/👎 et chaque correction ✏️ est enregistré.
Ces données alimentent les cycles de fine-tuning suivants.

Revision ID: 026
Revises: 025
Create Date: 2026-03-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "026"
down_revision: Union[str, None] = "025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        # Contexte de la session
        sa.Column("session_id", sa.String(36), nullable=False),
        sa.Column("cabinet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        # Message évalué
        sa.Column("user_message", sa.Text(), nullable=False),
        sa.Column("agent_response", sa.Text(), nullable=False),
        sa.Column("tool_called", sa.String(100), nullable=True),
        sa.Column("tool_result", postgresql.JSONB(), nullable=True),
        # Feedback
        sa.Column("rating", sa.String(10), nullable=False),  # "positive" | "negative"
        sa.Column("correction", sa.Text(), nullable=True),  # Texte correct si 👎
        # Métadonnées
        sa.Column("model_version", sa.String(50), nullable=False),
        sa.Column("category", sa.String(50), nullable=True),
        # Contraintes
        sa.ForeignKeyConstraint(["cabinet_id"], ["cabinets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Index pour les requêtes de feedback stats et export training data
    op.create_index("ix_agent_feedback_rating", "agent_feedback", ["rating"])
    op.create_index("ix_agent_feedback_cabinet", "agent_feedback", ["cabinet_id"])
    op.create_index("ix_agent_feedback_model", "agent_feedback", ["model_version"])
    op.create_index(
        "ix_agent_feedback_cabinet_created",
        "agent_feedback",
        ["cabinet_id", "created_at"],
    )

    # RLS : chaque cabinet ne voit que ses propres feedbacks
    op.execute("ALTER TABLE agent_feedback ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY cabinet_isolation_feedback ON agent_feedback "
        "USING (cabinet_id = current_setting('app.current_cabinet_id')::uuid)"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS cabinet_isolation_feedback ON agent_feedback")
    op.execute("ALTER TABLE agent_feedback DISABLE ROW LEVEL SECURITY")
    op.drop_index("ix_agent_feedback_cabinet_created", table_name="agent_feedback")
    op.drop_index("ix_agent_feedback_model", table_name="agent_feedback")
    op.drop_index("ix_agent_feedback_cabinet", table_name="agent_feedback")
    op.drop_index("ix_agent_feedback_rating", table_name="agent_feedback")
    op.drop_table("agent_feedback")
