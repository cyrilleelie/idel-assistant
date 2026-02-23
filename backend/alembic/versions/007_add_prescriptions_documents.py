"""Add patient fields (ssn, doctor), care_protocol fields (label, frequency), documents table

Revision ID: 007
Revises: 006
Create Date: 2026-02-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, TIMESTAMP


revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Patients: new encrypted fields ---
    op.add_column("patients", sa.Column("ssn_encrypted", sa.LargeBinary(), nullable=True))
    op.add_column("patients", sa.Column("ssn_search_hash", sa.String(64), nullable=True))
    op.add_column("patients", sa.Column("doctor_name_encrypted", sa.LargeBinary(), nullable=True))
    op.add_column("patients", sa.Column("doctor_contact_encrypted", sa.LargeBinary(), nullable=True))
    op.create_index("ix_patients_ssn_search_hash", "patients", ["ssn_search_hash"])

    # --- CareProtocols: label + frequency display ---
    op.add_column("care_protocols", sa.Column("label", sa.String(255), nullable=False, server_default=""))
    op.add_column("care_protocols", sa.Column("frequency_display", sa.String(20), nullable=False, server_default="daily"))
    op.add_column("care_protocols", sa.Column("custom_frequency_encrypted", sa.LargeBinary(), nullable=True))

    # --- Documents table ---
    op.create_table(
        "documents",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("cabinet_id", PG_UUID(as_uuid=True), sa.ForeignKey("cabinets.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", PG_UUID(as_uuid=True), nullable=False),
        sa.Column("original_name", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("checksum_sha256", sa.String(64), nullable=False),
        sa.Column("uploaded_by", PG_UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_documents_entity", "documents", ["entity_type", "entity_id"])

    # RLS for documents
    op.execute("ALTER TABLE documents ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY documents_cabinet_isolation ON documents
        FOR ALL
        USING (cabinet_id::text = current_setting('app.current_cabinet_id', true))
        WITH CHECK (cabinet_id::text = current_setting('app.current_cabinet_id', true))
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS documents_cabinet_isolation ON documents")
    op.drop_table("documents")
    op.drop_column("care_protocols", "custom_frequency_encrypted")
    op.drop_column("care_protocols", "frequency_display")
    op.drop_column("care_protocols", "label")
    op.drop_index("ix_patients_ssn_search_hash", table_name="patients")
    op.drop_column("patients", "doctor_contact_encrypted")
    op.drop_column("patients", "doctor_name_encrypted")
    op.drop_column("patients", "ssn_search_hash")
    op.drop_column("patients", "ssn_encrypted")
