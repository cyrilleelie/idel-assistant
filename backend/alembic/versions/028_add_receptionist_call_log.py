"""Ajoute la table receptionist_call_logs pour le secrétaire médical IA.

Stocke les appels téléphoniques entrants traités par l'agent vocal,
avec transcription pseudonymisée et score d'urgence.

Revision ID: 028
Revises: 027
Create Date: 2026-03-04
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "028"
down_revision: Union[str, None] = "027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "receptionist_call_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "cabinet_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cabinets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("caller_number", sa.String(255), nullable=False),  # Chiffré AES
        sa.Column("call_duration_seconds", sa.Integer, nullable=False, server_default="0"),
        sa.Column("outcome", sa.String(50), nullable=False),  # answered | voicemail | escalated | abandoned
        sa.Column("urgency_score", sa.Integer, nullable=False, server_default="0"),  # 0-3
        sa.Column("escalation_reason", sa.Text, nullable=True),
        sa.Column("sms_sent_to", sa.String(255), nullable=True),  # Chiffré AES
        sa.Column(
            "appointment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("appointments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "patient_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("patients.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("transcript_pseudonymized", postgresql.JSONB, nullable=True),
        sa.Column("avg_turn_latency_ms", sa.Integer, nullable=True),
        sa.Column("model_version", sa.String(50), nullable=True),
    )

    op.create_index(
        "ix_receptionist_call_logs_cabinet_id",
        "receptionist_call_logs",
        ["cabinet_id"],
    )
    op.create_index(
        "ix_receptionist_call_logs_outcome",
        "receptionist_call_logs",
        ["outcome"],
    )
    op.create_index(
        "ix_receptionist_call_logs_urgency_score",
        "receptionist_call_logs",
        ["urgency_score"],
    )

    # RLS policy : isolation par cabinet
    op.execute(
        "ALTER TABLE receptionist_call_logs ENABLE ROW LEVEL SECURITY"
    )
    op.execute(
        """
        CREATE POLICY cabinet_isolation ON receptionist_call_logs
        USING (cabinet_id = current_setting('app.current_cabinet_id')::uuid)
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS cabinet_isolation ON receptionist_call_logs")
    op.execute("ALTER TABLE receptionist_call_logs DISABLE ROW LEVEL SECURITY")
    op.drop_index("ix_receptionist_call_logs_urgency_score")
    op.drop_index("ix_receptionist_call_logs_outcome")
    op.drop_index("ix_receptionist_call_logs_cabinet_id")
    op.drop_table("receptionist_call_logs")
