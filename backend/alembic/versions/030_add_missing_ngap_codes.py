"""Add missing NGAP codes AMI_2.4, AMI_3.05 and AMX equivalents.

Revision ID: 030
Revises: 029
"""

import uuid
from datetime import date, datetime, UTC

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = "030"
down_revision: str = "029"
branch_labels = None
depends_on = None

AVENANT_10_DATE = date(2024, 1, 28)

NEW_ACTS = [
    {
        "code": "AMI_2.4",
        "lettre_cle": "AMI",
        "label": "Acte medical infirmier coefficient 2.4",
        "category": "technique",
        "coefficient": 2.4,
        "base_rate": 3.15,
        "fixed_amount": None,
        "unit": "acte",
        "default_duration_minutes": 20,
        "is_cumulative": True,
        "display_order": 121,
    },
    {
        "code": "AMI_3.05",
        "lettre_cle": "AMI",
        "label": "Acte medical infirmier coefficient 3.05",
        "category": "technique",
        "coefficient": 3.05,
        "base_rate": 3.15,
        "fixed_amount": None,
        "unit": "acte",
        "default_duration_minutes": 20,
        "is_cumulative": True,
        "display_order": 131,
    },
    {
        "code": "AMX_2.4",
        "lettre_cle": "AMX",
        "label": "Acte medical infirmier pendant BSI coefficient 2.4",
        "category": "technique_bsi",
        "coefficient": 2.4,
        "base_rate": 3.15,
        "fixed_amount": None,
        "unit": "acte",
        "default_duration_minutes": 20,
        "is_cumulative": True,
        "display_order": 221,
    },
    {
        "code": "AMX_3",
        "lettre_cle": "AMX",
        "label": "Acte medical infirmier pendant BSI coefficient 3",
        "category": "technique_bsi",
        "coefficient": 3,
        "base_rate": 3.15,
        "fixed_amount": None,
        "unit": "acte",
        "default_duration_minutes": 20,
        "is_cumulative": True,
        "display_order": 222,
    },
    {
        "code": "AMX_3.05",
        "lettre_cle": "AMX",
        "label": "Acte medical infirmier pendant BSI coefficient 3.05",
        "category": "technique_bsi",
        "coefficient": 3.05,
        "base_rate": 3.15,
        "fixed_amount": None,
        "unit": "acte",
        "default_duration_minutes": 20,
        "is_cumulative": True,
        "display_order": 223,
    },
]


def upgrade() -> None:
    now = datetime.now(UTC)
    for act in NEW_ACTS:
        op.execute(
            sa.text("""
                INSERT INTO care_type_catalog (
                    id, cabinet_id, code, lettre_cle, label, category,
                    coefficient, base_rate, fixed_amount, unit,
                    default_duration_minutes, is_cumulative,
                    effective_from, avenant_source,
                    is_system, is_active, display_order,
                    created_at, updated_at
                )
                SELECT
                    :id, NULL, :code, :lettre_cle, :label, :category,
                    :coefficient, :base_rate, :fixed_amount, :unit,
                    :default_duration_minutes, :is_cumulative,
                    :effective_from, :avenant_source,
                    TRUE, TRUE, :display_order,
                    :now, :now
                WHERE NOT EXISTS (
                    SELECT 1 FROM care_type_catalog
                    WHERE code = :code AND cabinet_id IS NULL AND is_system = TRUE
                )
            """).bindparams(
                id=str(uuid.uuid4()),
                code=act["code"],
                lettre_cle=act["lettre_cle"],
                label=act["label"],
                category=act["category"],
                coefficient=act["coefficient"],
                base_rate=act["base_rate"],
                fixed_amount=act["fixed_amount"],
                unit=act["unit"],
                default_duration_minutes=act["default_duration_minutes"],
                is_cumulative=act["is_cumulative"],
                effective_from=AVENANT_10_DATE,
                avenant_source="avenant_10",
                display_order=act["display_order"],
                now=now,
            )
        )


def downgrade() -> None:
    codes = [act["code"] for act in NEW_ACTS]
    op.execute(
        sa.text(
            "DELETE FROM care_type_catalog WHERE code = ANY(:codes) AND is_system = TRUE"
        ).bindparams(codes=codes)
    )
