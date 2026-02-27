"""Fusion soins→prescriptions : les ordonnances absorbent les données des soins

Revision ID: 019
Revises: 018
Create Date: 2026-02-27

Ce que fait cette migration:
- Enrichit `prescriptions` avec les champs de scheduling (repris des soins) :
  care_protocol_id, label, care_label_code, duration_minutes, frequency_display,
  custom_frequency, preferred_time, preferred_slot, recurrence_rule, document_filename
- Rend optionnels prescriber_name, prescription_date, care_description dans prescriptions
  (une ordonnance issue d'un plan de soins peut ne pas avoir de prescripteur)
- Simplifie `care_protocols` : suppression de tous les champs portés par les soins
  (care_type, duration_minutes, frequency_display, custom_frequency_encrypted,
  preferred_time, preferred_slot, recurrence_rule, act_codes, notes_encrypted)
  et suppression du FK prescription_id (relation inversée : Prescription → CareProtocol)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Enrichir la table prescriptions ─────────────────────────────────

    # 1a. Lien vers le plan de soins
    op.add_column(
        "prescriptions",
        sa.Column("care_protocol_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_prescriptions_care_protocol_id",
        "prescriptions",
        "care_protocols",
        ["care_protocol_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_prescription_care_protocol", "prescriptions", ["care_protocol_id"])

    # 1b. Libellé (référentiel CareLabel)
    op.add_column("prescriptions", sa.Column("label", sa.String(255), nullable=True))
    op.add_column("prescriptions", sa.Column("care_label_code", sa.String(100), nullable=True))

    # 1c. Champs scheduling (repris des soins)
    op.add_column("prescriptions", sa.Column("duration_minutes", sa.Integer(), nullable=True))
    op.add_column(
        "prescriptions",
        sa.Column("frequency_display", sa.String(20), nullable=True, server_default="daily"),
    )
    op.add_column("prescriptions", sa.Column("custom_frequency", sa.String(255), nullable=True))
    op.add_column("prescriptions", sa.Column("preferred_time", sa.Time(), nullable=True))
    op.add_column("prescriptions", sa.Column("preferred_slot", sa.String(20), nullable=True))
    op.add_column("prescriptions", sa.Column("recurrence_rule", sa.String(500), nullable=True))

    # 1d. Document uploadé
    op.add_column("prescriptions", sa.Column("document_filename", sa.String(500), nullable=True))

    # 1e. Rendre optionnels les champs prescripteur/date/description
    op.alter_column("prescriptions", "prescriber_name", nullable=True)
    op.alter_column("prescriptions", "prescription_date", nullable=True)
    op.alter_column("prescriptions", "care_description", nullable=True)

    # ── 2. Simplifier la table care_protocols ───────────────────────────────

    # 2a. Supprimer le FK prescription_id (relation inversée désormais)
    op.drop_constraint("fk_care_protocols_prescription_id", "care_protocols", type_="foreignkey")
    op.drop_column("care_protocols", "prescription_id")

    # 2b. Supprimer les champs scheduling (maintenant dans Prescription)
    op.drop_column("care_protocols", "care_type")
    op.drop_column("care_protocols", "duration_minutes")
    op.drop_column("care_protocols", "frequency_display")
    op.drop_column("care_protocols", "custom_frequency_encrypted")
    op.drop_column("care_protocols", "preferred_time")
    op.drop_column("care_protocols", "preferred_slot")
    op.drop_column("care_protocols", "recurrence_rule")
    op.drop_column("care_protocols", "act_codes")
    op.drop_column("care_protocols", "notes_encrypted")


def downgrade() -> None:
    # Restaurer les colonnes supprimées de care_protocols
    op.add_column("care_protocols", sa.Column("notes_encrypted", sa.LargeBinary(), nullable=True))
    op.add_column(
        "care_protocols",
        sa.Column("act_codes", postgresql.ARRAY(sa.String(30)), nullable=True),
    )
    op.add_column(
        "care_protocols",
        sa.Column("recurrence_rule", sa.String(255), nullable=False, server_default=""),
    )
    op.add_column(
        "care_protocols",
        sa.Column("preferred_slot", sa.String(20), nullable=False, server_default=""),
    )
    op.add_column("care_protocols", sa.Column("preferred_time", sa.Time(), nullable=True))
    op.add_column(
        "care_protocols",
        sa.Column("custom_frequency_encrypted", sa.LargeBinary(), nullable=True),
    )
    op.add_column(
        "care_protocols",
        sa.Column("frequency_display", sa.String(20), nullable=False, server_default="daily"),
    )
    op.add_column("care_protocols", sa.Column("duration_minutes", sa.Integer(), nullable=True))
    op.add_column(
        "care_protocols",
        sa.Column("care_type", sa.String(50), nullable=False, server_default="soins_infirmiers"),
    )
    op.add_column(
        "care_protocols",
        sa.Column("prescription_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_care_protocols_prescription_id",
        "care_protocols",
        "prescriptions",
        ["prescription_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Restaurer les colonnes supprimées de prescriptions
    op.alter_column("prescriptions", "care_description", nullable=False)
    op.alter_column("prescriptions", "prescription_date", nullable=False)
    op.alter_column("prescriptions", "prescriber_name", nullable=False)

    op.drop_column("prescriptions", "document_filename")
    op.drop_column("prescriptions", "recurrence_rule")
    op.drop_column("prescriptions", "preferred_slot")
    op.drop_column("prescriptions", "preferred_time")
    op.drop_column("prescriptions", "custom_frequency")
    op.drop_column("prescriptions", "frequency_display")
    op.drop_column("prescriptions", "duration_minutes")
    op.drop_column("prescriptions", "care_label_code")
    op.drop_column("prescriptions", "label")

    op.drop_index("ix_prescription_care_protocol", table_name="prescriptions")
    op.drop_constraint("fk_prescriptions_care_protocol_id", "prescriptions", type_="foreignkey")
    op.drop_column("prescriptions", "care_protocol_id")
