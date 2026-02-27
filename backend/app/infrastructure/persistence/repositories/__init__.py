from app.infrastructure.persistence.repositories.sqlalchemy_appointment_repo import (
    SQLAlchemyAppointmentRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_invoice_repo import (
    SQLAlchemyInvoiceLineRepo,
    SQLAlchemyInvoiceRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_cabinet_repo import (
    SQLAlchemyCabinetRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_care_catalog_repo import (
    SQLAlchemyCareCatalogRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_care_label_repo import (
    SQLAlchemyCareLabelRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_tariff_update_repo import (
    SQLAlchemyTariffUpdateRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_care_protocol_repo import (
    SQLAlchemyCareProtocolRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_prescription_repo import (
    SQLAlchemyPrescriptionRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_document_repo import (
    SQLAlchemyDocumentRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_patient_repo import (
    SQLAlchemyPatientRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_schedule_assignment_repo import (
    SQLAlchemyScheduleAssignmentRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_sector_repo import (
    SQLAlchemySectorRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_tournee_repo import (
    SQLAlchemyTourneeRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_user_repo import (
    SQLAlchemyUserRepo,
)

__all__ = [
    "SQLAlchemyAppointmentRepo",
    "SQLAlchemyCabinetRepo",
    "SQLAlchemyCareCatalogRepo",
    "SQLAlchemyCareLabelRepo",
    "SQLAlchemyInvoiceLineRepo",
    "SQLAlchemyInvoiceRepo",
    "SQLAlchemyTariffUpdateRepo",
    "SQLAlchemyCareProtocolRepo",
    "SQLAlchemyDocumentRepo",
    "SQLAlchemyPatientRepo",
    "SQLAlchemyPrescriptionRepo",
    "SQLAlchemyScheduleAssignmentRepo",
    "SQLAlchemySectorRepo",
    "SQLAlchemyTourneeRepo",
    "SQLAlchemyUserRepo",
]
