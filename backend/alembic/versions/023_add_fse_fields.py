"""Ajoute les champs SESAM-Vitale (patients/users/cabinets) et crée la table fse

Revision ID: 023
Revises: 022
Create Date: 2026-03-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "023"
down_revision: Union[str, None] = "022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Patients : champs SESAM-Vitale complémentaires ---
    op.add_column("patients", sa.Column("birth_rank", sa.Integer(), nullable=True))
    op.add_column("patients", sa.Column("insured_nir_encrypted", sa.LargeBinary(), nullable=True))
    op.add_column("patients", sa.Column("amo_code", sa.String(9), nullable=True))
    op.add_column("patients", sa.Column("amo_center", sa.String(50), nullable=True))
    op.add_column("patients", sa.Column("amc_code", sa.String(10), nullable=True))
    op.add_column("patients", sa.Column("amc_name", sa.String(100), nullable=True))
    op.add_column("patients", sa.Column("amc_contract", sa.String(50), nullable=True))
    op.add_column("patients", sa.Column("exoneration_type", sa.String(3), nullable=True))

    # --- Users : identifiants professionnels complémentaires ---
    op.add_column("users", sa.Column("adeli", sa.String(9), nullable=True))
    op.add_column("users", sa.Column("am_number", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("convention_zone", sa.Integer(), nullable=True))

    # --- Cabinets : identifiants établissement ---
    op.add_column("cabinets", sa.Column("finess", sa.String(9), nullable=True))
    op.add_column("cabinets", sa.Column("siren", sa.String(9), nullable=True))
    op.add_column("cabinets", sa.Column("siret", sa.String(14), nullable=True))

    # --- Table FSE ---
    op.create_table(
        "fse",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("cabinet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cabinets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True),
        # Numérotation
        sa.Column("fse_number", sa.String(50), nullable=False, server_default=""),
        sa.Column("lot_number", sa.String(20), nullable=True),
        # Identité patient
        sa.Column("nir_patient", sa.String(15), nullable=False, server_default=""),
        sa.Column("birth_rank", sa.Integer(), nullable=True),
        # Identité professionnel
        sa.Column("rpps_idel", sa.String(11), nullable=False, server_default=""),
        sa.Column("adeli_idel", sa.String(9), nullable=True),
        sa.Column("rpps_prescripteur", sa.String(11), nullable=True),
        # Dates
        sa.Column("date_soins", sa.Date(), nullable=False),
        sa.Column("date_prescription", sa.Date(), nullable=True),
        # Organismes
        sa.Column("organisme_amo", sa.String(9), nullable=True),
        sa.Column("organisme_amc", sa.String(10), nullable=True),
        # Montants
        sa.Column("montant_total", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("montant_amo", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("montant_amc", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("montant_patient", sa.Numeric(10, 2), nullable=False, server_default="0"),
        # Actes (tableau JSON : [{code, label, coefficient, quantite, montant}])
        sa.Column("actes_fse", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        # Classification
        sa.Column("type_fse", sa.String(10), nullable=False, server_default="FSE"),
        sa.Column("nature_assurance", sa.String(3), nullable=True),
        sa.Column("exoneration_code", sa.String(3), nullable=True),
        # Données brutes (pour formats tiers)
        sa.Column("raw_fse_data", postgresql.JSONB(), nullable=True),
        # Statut
        sa.Column("status", sa.String(20), nullable=False, server_default="generated"),
        sa.Column("exported_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("exported_format", sa.String(10), nullable=True),
        sa.Column("transmitted_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("arl_received_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.String(500), nullable=True),
        # Audit
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_index("ix_fse_cabinet_id", "fse", ["cabinet_id"])
    op.create_index("ix_fse_cabinet_id_status", "fse", ["cabinet_id", "status"])
    op.create_index("ix_fse_invoice_id", "fse", ["invoice_id"])
    op.create_index("ix_fse_fse_number", "fse", ["cabinet_id", "fse_number"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_fse_fse_number")
    op.drop_index("ix_fse_invoice_id")
    op.drop_index("ix_fse_cabinet_id_status")
    op.drop_index("ix_fse_cabinet_id")
    op.drop_table("fse")

    op.drop_column("cabinets", "siret")
    op.drop_column("cabinets", "siren")
    op.drop_column("cabinets", "finess")

    op.drop_column("users", "convention_zone")
    op.drop_column("users", "am_number")
    op.drop_column("users", "adeli")

    op.drop_column("patients", "exoneration_type")
    op.drop_column("patients", "amc_contract")
    op.drop_column("patients", "amc_name")
    op.drop_column("patients", "amc_code")
    op.drop_column("patients", "amo_center")
    op.drop_column("patients", "amo_code")
    op.drop_column("patients", "insured_nir_encrypted")
    op.drop_column("patients", "birth_rank")
