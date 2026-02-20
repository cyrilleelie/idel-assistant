"""Initial schema — all tables + RLS policies

Revision ID: 001
Revises:
Create Date: 2026-02-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # === CABINETS ===
    op.create_table(
        "cabinets",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("address", sa.String(500), nullable=False, server_default=""),
        sa.Column("lat", sa.Numeric(10, 8), nullable=True),
        sa.Column("lon", sa.Numeric(11, 8), nullable=True),
        sa.Column("plan", sa.String(20), nullable=False, server_default="solo"),
        sa.Column("subscription_status", sa.String(20), nullable=False, server_default="trial"),
        sa.Column("trial_ends_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cabinets")),
    )

    # === USERS ===
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("rpps", sa.String(11), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False, server_default=""),
        sa.Column("photo_url", sa.String(500), nullable=False, server_default=""),
        sa.Column("work_hours_start", sa.Time(), nullable=False, server_default=sa.text("'07:00:00'")),
        sa.Column("work_hours_end", sa.Time(), nullable=False, server_default=sa.text("'19:00:00'")),
        sa.Column("lunch_break_start", sa.Time(), nullable=False, server_default=sa.text("'12:00:00'")),
        sa.Column("lunch_break_duration_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("work_zone_radius_km", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("vocal_agent_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("vocal_agent_phone", sa.String(20), nullable=False, server_default=""),
        sa.Column("last_login_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
        sa.UniqueConstraint("rpps", name=op.f("uq_users_rpps")),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"])
    op.create_index(op.f("ix_users_rpps"), "users", ["rpps"])

    # === CABINET_MEMBERS ===
    op.create_table(
        "cabinet_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("cabinet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="member"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("joined_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("left_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cabinet_members")),
        sa.ForeignKeyConstraint(["cabinet_id"], ["cabinets.id"], name=op.f("fk_cabinet_members_cabinet_id_cabinets"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_cabinet_members_user_id_users"), ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_cabinet_members_cabinet_id"), "cabinet_members", ["cabinet_id"])
    op.create_index(op.f("ix_cabinet_members_user_id"), "cabinet_members", ["user_id"])

    # === PATIENTS ===
    op.create_table(
        "patients",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("cabinet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("first_name_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("last_name_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("birth_date_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("phone_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("email_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("address_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("pathologies_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("notes_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("first_name_search_hash", sa.String(64), nullable=True),
        sa.Column("last_name_search_hash", sa.String(64), nullable=True),
        sa.Column("lat", sa.Numeric(10, 8), nullable=True),
        sa.Column("lon", sa.Numeric(11, 8), nullable=True),
        sa.Column("preferred_time_slot", sa.String(20), nullable=True),
        sa.Column("care_duration_default", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("archived_reason", sa.String(255), nullable=False, server_default=""),
        sa.Column("archived_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_patients")),
        sa.ForeignKeyConstraint(["cabinet_id"], ["cabinets.id"], name=op.f("fk_patients_cabinet_id_cabinets"), ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_patients_cabinet_id"), "patients", ["cabinet_id"])
    op.create_index(op.f("ix_patients_first_name_search_hash"), "patients", ["first_name_search_hash"])
    op.create_index(op.f("ix_patients_last_name_search_hash"), "patients", ["last_name_search_hash"])
    op.create_index(op.f("ix_patients_status"), "patients", ["status"])

    # === CARE_PROTOCOLS ===
    op.create_table(
        "care_protocols",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cabinet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("care_type", sa.String(50), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("recurrence_rule", sa.String(255), nullable=False),
        sa.Column("preferred_time", sa.Time(), nullable=True),
        sa.Column("preferred_slot", sa.String(20), nullable=False, server_default=""),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("notes_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_care_protocols")),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name=op.f("fk_care_protocols_patient_id_patients"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["cabinet_id"], ["cabinets.id"], name=op.f("fk_care_protocols_cabinet_id_cabinets"), ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_care_protocols_patient_id"), "care_protocols", ["patient_id"])
    op.create_index(op.f("ix_care_protocols_cabinet_id"), "care_protocols", ["cabinet_id"])
    op.create_index(op.f("ix_care_protocols_status"), "care_protocols", ["status"])

    # === APPOINTMENTS ===
    op.create_table(
        "appointments",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("cabinet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("idel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("care_protocol_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("scheduled_at", postgresql.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("care_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="scheduled"),
        sa.Column("cancellation_reason", sa.String(255), nullable=False, server_default=""),
        sa.Column("canceled_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_appointments")),
        sa.ForeignKeyConstraint(["cabinet_id"], ["cabinets.id"], name=op.f("fk_appointments_cabinet_id_cabinets"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["idel_id"], ["users.id"], name=op.f("fk_appointments_idel_id_users")),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name=op.f("fk_appointments_patient_id_patients")),
        sa.ForeignKeyConstraint(["care_protocol_id"], ["care_protocols.id"], name=op.f("fk_appointments_care_protocol_id_care_protocols"), ondelete="SET NULL"),
    )
    op.create_index(op.f("ix_appointments_cabinet_id"), "appointments", ["cabinet_id"])
    op.create_index(op.f("ix_appointments_idel_id"), "appointments", ["idel_id"])
    op.create_index(op.f("ix_appointments_patient_id"), "appointments", ["patient_id"])
    op.create_index(op.f("ix_appointments_scheduled_at"), "appointments", ["scheduled_at"])
    op.create_index(op.f("ix_appointments_status"), "appointments", ["status"])

    # === TOURNEES ===
    op.create_table(
        "tournees",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("cabinet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("idel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tournee_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("start_location", postgresql.JSONB(), nullable=True),
        sa.Column("end_location", postgresql.JSONB(), nullable=True),
        sa.Column("total_distance_km", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total_duration_hours", sa.Float(), nullable=False, server_default="0"),
        sa.Column("savings_km", sa.Float(), nullable=False, server_default="0"),
        sa.Column("savings_minutes", sa.Float(), nullable=False, server_default="0"),
        sa.Column("num_stops", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("optimization_params", postgresql.JSONB(), nullable=True),
        sa.Column("optimized_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("started_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("completed_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tournees")),
        sa.ForeignKeyConstraint(["cabinet_id"], ["cabinets.id"], name=op.f("fk_tournees_cabinet_id_cabinets"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["idel_id"], ["users.id"], name=op.f("fk_tournees_idel_id_users")),
    )
    op.create_index(op.f("ix_tournees_cabinet_id"), "tournees", ["cabinet_id"])
    op.create_index(op.f("ix_tournees_idel_id"), "tournees", ["idel_id"])
    op.create_index(op.f("ix_tournees_tournee_date"), "tournees", ["tournee_date"])

    # === TOURNEE_STOPS ===
    op.create_table(
        "tournee_stops",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tournee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("appointment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stop_order", sa.Integer(), nullable=False),
        sa.Column("estimated_arrival", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("actual_arrival", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("distance_from_previous_km", sa.Float(), nullable=False, server_default="0"),
        sa.Column("travel_time_from_previous_min", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tournee_stops")),
        sa.ForeignKeyConstraint(["tournee_id"], ["tournees.id"], name=op.f("fk_tournee_stops_tournee_id_tournees"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["appointment_id"], ["appointments.id"], name=op.f("fk_tournee_stops_appointment_id_appointments")),
    )
    op.create_index(op.f("ix_tournee_stops_tournee_id"), "tournee_stops", ["tournee_id"])

    # === TRANSMISSIONS ===
    op.create_table(
        "transmissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("cabinet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("idel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("appointment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("transcription_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("structured_data", postgresql.JSONB(), nullable=True),
        sa.Column("recording_duration_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("generation_time_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_transmissions")),
        sa.ForeignKeyConstraint(["cabinet_id"], ["cabinets.id"], name=op.f("fk_transmissions_cabinet_id_cabinets"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["idel_id"], ["users.id"], name=op.f("fk_transmissions_idel_id_users")),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name=op.f("fk_transmissions_patient_id_patients")),
        sa.ForeignKeyConstraint(["appointment_id"], ["appointments.id"], name=op.f("fk_transmissions_appointment_id_appointments"), ondelete="SET NULL"),
    )
    op.create_index(op.f("ix_transmissions_cabinet_id"), "transmissions", ["cabinet_id"])
    op.create_index(op.f("ix_transmissions_idel_id"), "transmissions", ["idel_id"])
    op.create_index(op.f("ix_transmissions_patient_id"), "transmissions", ["patient_id"])

    # === INVOICES ===
    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("cabinet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("idel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invoice_number", sa.String(50), nullable=False, server_default=""),
        sa.Column("invoice_date", sa.Date(), nullable=False),
        sa.Column("total_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("rejection_reason", sa.String(255), nullable=False, server_default=""),
        sa.Column("transmitted_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("paid_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_invoices")),
        sa.ForeignKeyConstraint(["cabinet_id"], ["cabinets.id"], name=op.f("fk_invoices_cabinet_id_cabinets"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["idel_id"], ["users.id"], name=op.f("fk_invoices_idel_id_users")),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], name=op.f("fk_invoices_patient_id_patients")),
    )
    op.create_index(op.f("ix_invoices_cabinet_id"), "invoices", ["cabinet_id"])
    op.create_index(op.f("ix_invoices_patient_id"), "invoices", ["patient_id"])
    op.create_index(op.f("ix_invoices_status"), "invoices", ["status"])

    # === INVOICE_LINES ===
    op.create_table(
        "invoice_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("appointment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("act_code", sa.String(20), nullable=False),
        sa.Column("coefficient", sa.Numeric(5, 2), nullable=False, server_default="1"),
        sa.Column("base_rate", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("supplements", postgresql.JSONB(), nullable=True),
        sa.Column("line_total", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_invoice_lines")),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], name=op.f("fk_invoice_lines_invoice_id_invoices"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["appointment_id"], ["appointments.id"], name=op.f("fk_invoice_lines_appointment_id_appointments")),
    )
    op.create_index(op.f("ix_invoice_lines_invoice_id"), "invoice_lines", ["invoice_id"])

    # === CARE_TYPE_CATALOG ===
    op.create_table(
        "care_type_catalog",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("cabinet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("default_duration_minutes", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("base_rate", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_care_type_catalog")),
        sa.ForeignKeyConstraint(["cabinet_id"], ["cabinets.id"], name=op.f("fk_care_type_catalog_cabinet_id_cabinets"), ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_care_type_catalog_cabinet_id"), "care_type_catalog", ["cabinet_id"])

    # === AUDIT_LOGS ===
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("cabinet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("changes", postgresql.JSONB(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=False, server_default=""),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_logs")),
        sa.ForeignKeyConstraint(["cabinet_id"], ["cabinets.id"], name=op.f("fk_audit_logs_cabinet_id_cabinets"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_audit_logs_user_id_users")),
    )
    op.create_index(op.f("ix_audit_logs_cabinet_id"), "audit_logs", ["cabinet_id"])
    op.create_index(op.f("ix_audit_logs_user_id"), "audit_logs", ["user_id"])

    # === ROW LEVEL SECURITY ===
    # Tables metier avec cabinet_id : RLS filtre par cabinet_id
    # Le role applicatif (idel_app) definit current_setting('app.current_cabinet_id')
    rls_tables_with_cabinet_id = [
        "patients",
        "care_protocols",
        "appointments",
        "tournees",
        "transmissions",
        "invoices",
        "care_type_catalog",
        "audit_logs",
        "cabinet_members",
    ]

    for table in rls_tables_with_cabinet_id:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY {table}_cabinet_isolation ON {table} "
            f"FOR ALL "
            f"USING (cabinet_id::text = current_setting('app.current_cabinet_id', true)) "
            f"WITH CHECK (cabinet_id::text = current_setting('app.current_cabinet_id', true))"
        )

    # Tables enfant sans cabinet_id direct (jointe via parent)
    # tournee_stops: isolation via tournee_id -> tournees.cabinet_id
    op.execute("ALTER TABLE tournee_stops ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tournee_stops FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tournee_stops_cabinet_isolation ON tournee_stops "
        "FOR ALL "
        "USING (tournee_id IN ("
        "  SELECT id FROM tournees WHERE cabinet_id::text = current_setting('app.current_cabinet_id', true)"
        ")) "
        "WITH CHECK (tournee_id IN ("
        "  SELECT id FROM tournees WHERE cabinet_id::text = current_setting('app.current_cabinet_id', true)"
        "))"
    )

    # invoice_lines: isolation via invoice_id -> invoices.cabinet_id
    op.execute("ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE invoice_lines FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY invoice_lines_cabinet_isolation ON invoice_lines "
        "FOR ALL "
        "USING (invoice_id IN ("
        "  SELECT id FROM invoices WHERE cabinet_id::text = current_setting('app.current_cabinet_id', true)"
        ")) "
        "WITH CHECK (invoice_id IN ("
        "  SELECT id FROM invoices WHERE cabinet_id::text = current_setting('app.current_cabinet_id', true)"
        "))"
    )


def downgrade() -> None:
    # Drop RLS policies
    rls_tables = [
        "patients", "care_protocols", "appointments", "tournees",
        "transmissions", "invoices", "care_type_catalog", "audit_logs",
        "cabinet_members", "tournee_stops", "invoice_lines",
    ]
    for table in rls_tables:
        op.execute(f"DROP POLICY IF EXISTS {table}_cabinet_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    # Drop tables in reverse dependency order
    op.drop_table("audit_logs")
    op.drop_table("care_type_catalog")
    op.drop_table("invoice_lines")
    op.drop_table("invoices")
    op.drop_table("transmissions")
    op.drop_table("tournee_stops")
    op.drop_table("tournees")
    op.drop_table("appointments")
    op.drop_table("care_protocols")
    op.drop_table("patients")
    op.drop_table("cabinet_members")
    op.drop_table("users")
    op.drop_table("cabinets")
