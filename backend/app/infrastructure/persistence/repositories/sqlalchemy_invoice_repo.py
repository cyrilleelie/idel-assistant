import datetime
from decimal import Decimal
from uuid import UUID

from uuid import UUID as StdUUID

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.entities.invoice import Invoice, InvoiceLine
from app.domain.repositories.invoice_repository import InvoiceLineRepository, InvoiceRepository
from app.infrastructure.persistence.models.invoice_model import InvoiceLineModel, InvoiceModel


class SQLAlchemyInvoiceRepo(InvoiceRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    def _line_model_to_entity(self, model: InvoiceLineModel) -> InvoiceLine:
        return InvoiceLine(
            id=model.id,
            invoice_id=model.invoice_id,
            line_order=model.line_order,
            act_code=model.act_code,
            act_label=model.act_label,
            coefficient=Decimal(str(model.coefficient)) if model.coefficient is not None else Decimal("1"),
            base_rate=Decimal(str(model.base_rate)) if model.base_rate is not None else Decimal("0.00"),
            quantity=Decimal(str(model.quantity)) if model.quantity is not None else Decimal("1"),
            line_subtotal=Decimal(str(model.line_subtotal)) if model.line_subtotal is not None else Decimal("0.00"),
            supplements=model.supplements,
            supplements_total=Decimal(str(model.supplements_total)) if model.supplements_total is not None else Decimal("0.00"),
            line_total=Decimal(str(model.line_total)) if model.line_total is not None else Decimal("0.00"),
            created_at=model.created_at,
        )

    def _model_to_entity(self, model: InvoiceModel) -> Invoice:
        lines = [self._line_model_to_entity(lm) for lm in model.lines] if model.lines else []
        return Invoice(
            id=model.id,
            cabinet_id=model.cabinet_id,
            idel_id=model.idel_id,
            patient_id=model.patient_id,
            prescription_id=model.prescription_id,
            appointment_id=model.appointment_id,
            invoice_number=model.invoice_number or "",
            invoice_date=model.invoice_date,
            care_date=model.care_date,
            total_amo=Decimal(str(model.total_amo)) if model.total_amo is not None else Decimal("0.00"),
            total_amc=Decimal(str(model.total_amc)) if model.total_amc is not None else Decimal("0.00"),
            total_patient=Decimal(str(model.total_patient)) if model.total_patient is not None else Decimal("0.00"),
            total_amount=Decimal(str(model.total_amount)) if model.total_amount is not None else Decimal("0.00"),
            tiers_payant_type=model.tiers_payant_type or "total",
            status=model.status or "draft",
            rejection_reason=model.rejection_reason,
            validated_at=model.validated_at,
            transmitted_at=model.transmitted_at,
            paid_at=model.paid_at,
            metadata=model.metadata_,
            payment_date=model.payment_date,
            payment_reference=model.payment_reference,
            payment_amount=Decimal(str(model.payment_amount)) if model.payment_amount is not None else None,
            rejection_code=model.rejection_code,
            rejected_at=model.rejected_at,
            corrected_invoice_id=model.corrected_invoice_id,
            lines=lines,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def get_by_id(self, id: UUID, cabinet_id: UUID) -> Invoice | None:
        result = await self._session.execute(
            select(InvoiceModel)
            .options(selectinload(InvoiceModel.lines))
            .where(InvoiceModel.id == id, InvoiceModel.cabinet_id == cabinet_id)
        )
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None

    async def list_invoices(
        self,
        cabinet_id: UUID,
        status: str | None = None,
        patient_id: UUID | None = None,
        date_from: datetime.date | None = None,
        date_to: datetime.date | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Invoice], int]:
        query = select(InvoiceModel).where(InvoiceModel.cabinet_id == cabinet_id)

        if status is not None:
            query = query.where(InvoiceModel.status == status)
        if patient_id is not None:
            query = query.where(InvoiceModel.patient_id == patient_id)
        if date_from is not None:
            query = query.where(InvoiceModel.care_date >= date_from)
        if date_to is not None:
            query = query.where(InvoiceModel.care_date <= date_to)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self._session.execute(count_query)
        total = total_result.scalar_one()

        # Fetch with pagination and eager load lines
        query = (
            query.options(selectinload(InvoiceModel.lines))
            .order_by(InvoiceModel.care_date.desc(), InvoiceModel.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(query)
        models = result.scalars().unique().all()

        return [self._model_to_entity(m) for m in models], total

    async def create(self, entity: Invoice) -> Invoice:
        model = InvoiceModel(
            id=entity.id,
            cabinet_id=entity.cabinet_id,
            idel_id=entity.idel_id,
            patient_id=entity.patient_id,
            prescription_id=entity.prescription_id,
            appointment_id=entity.appointment_id,
            invoice_number=entity.invoice_number,
            invoice_date=entity.invoice_date,
            care_date=entity.care_date,
            total_amo=entity.total_amo,
            total_amc=entity.total_amc,
            total_patient=entity.total_patient,
            total_amount=entity.total_amount,
            tiers_payant_type=entity.tiers_payant_type,
            status=entity.status,
            rejection_reason=entity.rejection_reason,
            validated_at=entity.validated_at,
            transmitted_at=entity.transmitted_at,
            paid_at=entity.paid_at,
            metadata_=entity.metadata,
            payment_date=entity.payment_date,
            payment_reference=entity.payment_reference,
            payment_amount=entity.payment_amount,
            rejection_code=entity.rejection_code,
            rejected_at=entity.rejected_at,
            corrected_invoice_id=entity.corrected_invoice_id,
        )
        self._session.add(model)
        await self._session.flush()
        # Re-fetch with lines loaded
        return await self.get_by_id(entity.id, entity.cabinet_id)  # type: ignore[return-value]

    async def update(self, entity: Invoice) -> Invoice:
        result = await self._session.execute(
            select(InvoiceModel).where(
                InvoiceModel.id == entity.id,
                InvoiceModel.cabinet_id == entity.cabinet_id,
            )
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"Invoice {entity.id} not found")

        model.invoice_number = entity.invoice_number
        model.invoice_date = entity.invoice_date
        model.care_date = entity.care_date
        model.total_amo = entity.total_amo
        model.total_amc = entity.total_amc
        model.total_patient = entity.total_patient
        model.total_amount = entity.total_amount
        model.tiers_payant_type = entity.tiers_payant_type
        model.status = entity.status
        model.rejection_reason = entity.rejection_reason
        model.validated_at = entity.validated_at
        model.transmitted_at = entity.transmitted_at
        model.paid_at = entity.paid_at
        model.metadata_ = entity.metadata
        model.prescription_id = entity.prescription_id
        model.appointment_id = entity.appointment_id
        model.payment_date = entity.payment_date
        model.payment_reference = entity.payment_reference
        model.payment_amount = entity.payment_amount
        model.rejection_code = entity.rejection_code
        model.rejected_at = entity.rejected_at
        model.corrected_invoice_id = entity.corrected_invoice_id

        await self._session.flush()
        return await self.get_by_id(entity.id, entity.cabinet_id)  # type: ignore[return-value]

    async def delete(self, id: UUID, cabinet_id: UUID) -> bool:
        result = await self._session.execute(
            select(InvoiceModel).where(
                InvoiceModel.id == id,
                InvoiceModel.cabinet_id == cabinet_id,
            )
        )
        model = result.scalar_one_or_none()
        if model is None:
            return False
        await self._session.delete(model)
        await self._session.flush()
        return True

    async def list_unpaid(
        self,
        cabinet_id: UUID,
        date_from: datetime.date | None = None,
        date_to: datetime.date | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Invoice], int]:
        """Retourne les factures en attente de paiement (validated + transmitted)."""
        query = select(InvoiceModel).where(
            InvoiceModel.cabinet_id == cabinet_id,
            InvoiceModel.status.in_(["validated", "transmitted"]),
        )
        if date_from is not None:
            query = query.where(InvoiceModel.care_date >= date_from)
        if date_to is not None:
            query = query.where(InvoiceModel.care_date <= date_to)

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self._session.execute(count_query)
        total = total_result.scalar_one()

        query = (
            query.options(selectinload(InvoiceModel.lines))
            .order_by(InvoiceModel.care_date.asc(), InvoiceModel.created_at.asc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(query)
        models = result.scalars().unique().all()
        return [self._model_to_entity(m) for m in models], total

    async def list_rejected(
        self,
        cabinet_id: UUID,
        date_from: datetime.date | None = None,
        date_to: datetime.date | None = None,
    ) -> list[tuple[Invoice, UUID | None]]:
        """Retourne les factures rejetées avec l'ID de la facture corrective si elle existe.

        Le tuple est (invoice, corrected_by_invoice_id).
        corrected_by_invoice_id est l'ID de la nouvelle facture qui corrige celle-ci.
        """
        query = select(InvoiceModel).where(
            InvoiceModel.cabinet_id == cabinet_id,
            InvoiceModel.status == "rejected",
        )
        if date_from is not None:
            query = query.where(InvoiceModel.care_date >= date_from)
        if date_to is not None:
            query = query.where(InvoiceModel.care_date <= date_to)

        query = (
            query.options(selectinload(InvoiceModel.lines))
            .order_by(InvoiceModel.rejected_at.desc().nullslast())
        )
        result = await self._session.execute(query)
        rejected_models = result.scalars().unique().all()

        if not rejected_models:
            return []

        # Cherche les factures correctives (celles qui ont corrected_invoice_id pointant vers les rejetées)
        rejected_ids = [m.id for m in rejected_models]
        correction_result = await self._session.execute(
            select(InvoiceModel.corrected_invoice_id, InvoiceModel.id)
            .where(
                InvoiceModel.cabinet_id == cabinet_id,
                InvoiceModel.corrected_invoice_id.in_(rejected_ids),
            )
        )
        # Map : rejected_id -> correction_invoice_id
        correction_map: dict = {row[0]: row[1] for row in correction_result.all()}

        return [
            (self._model_to_entity(m), correction_map.get(m.id))
            for m in rejected_models
        ]

    async def get_next_sequence(self, cabinet_id: UUID, year: int, month: int) -> int:
        """Retourne le prochain numero sequentiel pour le mois donne.

        Utilise SELECT ... FOR UPDATE pour eviter les doublons en concurrence.
        """
        prefix = f"{year}-{month:02d}-"
        # Lock rows matching prefix for this cabinet to prevent concurrent duplicates
        result = await self._session.execute(
            text(
                "SELECT invoice_number FROM invoices "
                "WHERE cabinet_id = :cabinet_id "
                "AND invoice_number LIKE :prefix "
                "ORDER BY invoice_number DESC "
                "LIMIT 1 "
                "FOR UPDATE"
            ),
            {"cabinet_id": str(cabinet_id), "prefix": f"{prefix}%"},
        )
        row = result.first()
        if row is None:
            return 1

        last_number = row[0]
        # Extract the sequence part: "2026-02-0042" -> "0042" -> 42
        try:
            seq_str = last_number.split("-", 2)[2]
            return int(seq_str) + 1
        except (IndexError, ValueError):
            return 1


class SQLAlchemyInvoiceLineRepo(InvoiceLineRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    def _model_to_entity(self, model: InvoiceLineModel) -> InvoiceLine:
        return InvoiceLine(
            id=model.id,
            invoice_id=model.invoice_id,
            line_order=model.line_order,
            act_code=model.act_code,
            act_label=model.act_label,
            coefficient=Decimal(str(model.coefficient)) if model.coefficient is not None else Decimal("1"),
            base_rate=Decimal(str(model.base_rate)) if model.base_rate is not None else Decimal("0.00"),
            quantity=Decimal(str(model.quantity)) if model.quantity is not None else Decimal("1"),
            line_subtotal=Decimal(str(model.line_subtotal)) if model.line_subtotal is not None else Decimal("0.00"),
            supplements=model.supplements,
            supplements_total=Decimal(str(model.supplements_total)) if model.supplements_total is not None else Decimal("0.00"),
            line_total=Decimal(str(model.line_total)) if model.line_total is not None else Decimal("0.00"),
            created_at=model.created_at,
        )

    async def get_by_id(self, id: UUID) -> InvoiceLine | None:
        result = await self._session.execute(
            select(InvoiceLineModel).where(InvoiceLineModel.id == id)
        )
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None

    async def list_by_invoice(self, invoice_id: UUID) -> list[InvoiceLine]:
        result = await self._session.execute(
            select(InvoiceLineModel)
            .where(InvoiceLineModel.invoice_id == invoice_id)
            .order_by(InvoiceLineModel.line_order)
        )
        return [self._model_to_entity(m) for m in result.scalars().all()]

    async def create(self, entity: InvoiceLine) -> InvoiceLine:
        model = InvoiceLineModel(
            id=entity.id,
            invoice_id=entity.invoice_id,
            line_order=entity.line_order,
            act_code=entity.act_code,
            act_label=entity.act_label,
            coefficient=entity.coefficient,
            base_rate=entity.base_rate,
            quantity=entity.quantity,
            line_subtotal=entity.line_subtotal,
            supplements=entity.supplements,
            supplements_total=entity.supplements_total,
            line_total=entity.line_total,
        )
        self._session.add(model)
        await self._session.flush()
        return self._model_to_entity(model)

    async def update(self, entity: InvoiceLine) -> InvoiceLine:
        result = await self._session.execute(
            select(InvoiceLineModel).where(InvoiceLineModel.id == entity.id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"InvoiceLine {entity.id} not found")

        model.line_order = entity.line_order
        model.act_code = entity.act_code
        model.act_label = entity.act_label
        model.coefficient = entity.coefficient
        model.base_rate = entity.base_rate
        model.quantity = entity.quantity
        model.line_subtotal = entity.line_subtotal
        model.supplements = entity.supplements
        model.supplements_total = entity.supplements_total
        model.line_total = entity.line_total

        await self._session.flush()
        await self._session.refresh(model)
        return self._model_to_entity(model)

    async def delete(self, id: UUID) -> bool:
        result = await self._session.execute(
            select(InvoiceLineModel).where(InvoiceLineModel.id == id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            return False
        await self._session.delete(model)
        await self._session.flush()
        return True
