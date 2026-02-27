"""Add prescription table and links to care_protocol and invoice

Revision ID: 018
Revises: 017
Create Date: 2026-02-27

Ce que fait cette migration:
- Crée la table `prescriptions` (entité réglementaire CPAM)
- Ajoute prescription_id (nullable FK) sur care_protocols
- Ajoute la contrainte FK sur invoices.prescription_id (colonne existante)

Aucune migration de données : les champs ordonnance historiques (label, notes JSON,
act_codes) sont conservés dans care_protocol pour rétrocompatibilité.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- 1. Créer la table prescriptions ---
    op.create_table(
        "prescriptions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("cabinet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        # Prescripteur
        sa.Column("prescriber_name", sa.String(255), nullable=False),
        sa.Column("prescriber_rpps", sa.String(11), nullable=True),
        # Dates
        sa.Column("prescription_date", sa.Date(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("duration_days", sa.Integer(), nullable=True),
        # Contenu
        sa.Column("care_description", sa.Text(), nullable=False),
        sa.Column("act_codes", postgresql.ARRAY(sa.String(30)), nullable=True),
        sa.Column("frequency", sa.String(50), nullable=True),
        # Renouvellement
        sa.Column("max_renewals", sa.Integer(), server_default="0", nullable=False),
        sa.Column("current_renewal", sa.Integer(), server_default="0", nullable=False),
        sa.Column("parent_prescription_id", postgresql.UUID(as_uuid=True), nullable=True),
        # Statut
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        # Document scanné
        sa.Column("document_url", sa.Text(), nullable=True),
        sa.Column("document_type", sa.String(20), nullable=True),
        # Notes
        sa.Column("notes", sa.Text(), nullable=True),
        # Audit
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
        sa.PrimaryKeyConstraint("id", name=op.f("pk_prescriptions")),
        sa.ForeignKeyConstraint(
            ["cabinet_id"],
            ["cabinets.id"],
            name=op.f("fk_prescriptions_cabinet_id_cabinets"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["patient_id"],
            ["patients.id"],
            name=op.f("fk_prescriptions_patient_id_patients"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["parent_prescription_id"],
            ["prescriptions.id"],
            name=op.f("fk_prescriptions_parent_prescription_id"),
            ondelete="SET NULL",
        ),
    )

    # Index pour les requêtes fréquentes
    op.create_index("ix_prescription_patient", "prescriptions", ["patient_id"])
    op.create_index("ix_prescription_cabinet_status", "prescriptions", ["cabinet_id", "status"])
    op.create_index(
        "ix_prescription_end_date_active",
        "prescriptions",
        ["end_date"],
        postgresql_where=sa.text("status = 'active'"),
    )

    # --- 2. Ajouter prescription_id sur care_protocols ---
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

    # --- 3. Ajouter la contrainte FK sur invoices.prescription_id (colonne déjà existante) ---
    op.create_foreign_key(
        "fk_invoices_prescription_id",
        "invoices",
        "prescriptions",
        ["prescription_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- 4. RLS policy sur prescriptions ---
    op.execute("""
        ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
    """)
    op.execute("""
        CREATE POLICY prescriptions_cabinet_isolation
        ON prescriptions
        USING (cabinet_id = current_setting('app.current_cabinet_id', true)::uuid);
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS prescriptions_cabinet_isolation ON prescriptions;")
    op.execute("ALTER TABLE prescriptions DISABLE ROW LEVEL SECURITY;")

    op.drop_constraint("fk_invoices_prescription_id", "invoices", type_="foreignkey")
    op.drop_constraint("fk_care_protocols_prescription_id", "care_protocols", type_="foreignkey")
    op.drop_column("care_protocols", "prescription_id")

    op.drop_index("ix_prescription_end_date_active", table_name="prescriptions")
    op.drop_index("ix_prescription_cabinet_status", table_name="prescriptions")
    op.drop_index("ix_prescription_patient", table_name="prescriptions")
    op.drop_table("prescriptions")
