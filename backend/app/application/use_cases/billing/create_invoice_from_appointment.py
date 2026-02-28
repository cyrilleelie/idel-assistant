"""Use case : creation d'une facture a partir d'un RDV complete."""

import datetime
import logging
from decimal import Decimal
from uuid import UUID, uuid4

from app.application.dtos.cotation_dto import SimulateCotationDTO
from app.application.dtos.invoice_dto import InvoiceDTO
from app.application.use_cases.billing.invoice_helpers import invoice_entity_to_dto
from app.application.use_cases.billing.simulate_cotation import SimulateCotationUseCase
from app.domain.entities.invoice import Invoice, InvoiceLine
from app.domain.repositories.appointment_repository import AppointmentRepository
from app.domain.repositories.care_type_catalog_repository import CareTypeCatalogRepository
from app.domain.repositories.invoice_repository import InvoiceLineRepository, InvoiceRepository
from app.domain.repositories.patient_repository import PatientRepository
from app.domain.rules.prescription_rules import (
    can_bill_against_prescription,
    compute_prescription_status,
    is_prescription_complete_for_billing,
)
from app.domain.value_objects.haversine import haversine_distance_km
from app.domain.value_objects.invoice_number import generate_next_invoice_number

logger = logging.getLogger(__name__)


class CreateInvoiceFromAppointmentUseCase:
    def __init__(
        self,
        appointment_repo: AppointmentRepository,
        invoice_repo: InvoiceRepository,
        line_repo: InvoiceLineRepository,
        patient_repo: PatientRepository,
        catalog_repo: CareTypeCatalogRepository,
        db_session=None,
    ):
        self._appointment_repo = appointment_repo
        self._invoice_repo = invoice_repo
        self._line_repo = line_repo
        self._patient_repo = patient_repo
        self._catalog_repo = catalog_repo
        self._session = db_session

    async def execute(
        self,
        cabinet_id: UUID,
        appointment_id: UUID,
        zone_ik: str = "plaine",
    ) -> InvoiceDTO:
        # 1. Charge le RDV
        appt = await self._appointment_repo.get_by_id(appointment_id)
        if appt is None or appt.cabinet_id != cabinet_id:
            raise ValueError("Rendez-vous introuvable")

        if appt.status != "completed":
            raise ValueError("Seul un rendez-vous realise peut etre facture")

        if not appt.act_codes:
            raise ValueError("Le rendez-vous n'a pas de codes actes NGAP associes")

        # 2. Verifie qu'il n'y a pas deja une facture pour ce RDV
        existing_invoices, _ = await self._invoice_repo.list_invoices(
            cabinet_id=cabinet_id,
            date_from=appt.scheduled_at.date(),
            date_to=appt.scheduled_at.date(),
            offset=0,
            limit=200,
        )
        for inv in existing_invoices:
            if inv.appointment_id == appointment_id and inv.status != "canceled":
                raise ValueError("Une facture existe deja pour ce rendez-vous")

        # 3. Charge le patient
        patient = await self._patient_repo.get_by_id(appt.patient_id)
        if patient is None:
            raise ValueError("Patient introuvable")

        # 4. Calcule ou recupere la distance cabinet→patient
        distance_km = appt.distance_km
        if distance_km is None:
            distance_km = await self._compute_distance(cabinet_id, patient.lat, patient.lon)
            if distance_km is not None and distance_km > 0:
                # Persiste la distance pour eviter de recalculer
                appt.distance_km = distance_km
                await self._appointment_repo.update(appt)
        if distance_km is None:
            distance_km = Decimal("0")

        # 5. Verifie si le forfait BSI a deja ete facture aujourd'hui (multi-IDEL)
        bsi_already_billed = False
        if patient.has_active_bsi and patient.bsi_level:
            bsi_already_billed = await self._check_bsi_already_billed(
                patient_id=appt.patient_id,
                cabinet_id=cabinet_id,
                care_date=appt.scheduled_at.date(),
            )

        # 6. Simule la cotation
        lieu = "cabinet" if appt.location_type == "office" else "domicile"
        cotation_dto = SimulateCotationDTO(
            patient_id=appt.patient_id,
            idel_id=appt.idel_id,
            actes=appt.act_codes,
            date_heure_soin=appt.scheduled_at.isoformat(),
            distance_km=distance_km,
            lieu=lieu,
            zone_ik=zone_ik,
            est_premier_soin_journee=True,
            bsi_already_billed_today=bsi_already_billed,
        )
        simulate_uc = SimulateCotationUseCase(self._patient_repo, self._catalog_repo)
        cotation = await simulate_uc.execute(cabinet_id, cotation_dto)

        # 7. Genere le numero de facture
        today = datetime.date.today()
        seq = await self._invoice_repo.get_next_sequence(cabinet_id, today.year, today.month)
        invoice_number = generate_next_invoice_number(cabinet_id, today.year, today.month, seq)

        # 8. Cherche l'ordonnance valide et complete liee au plan de soins du RDV
        prescription_id = None
        found_prescription_entity = None
        prescription_warning_for_review: str | None = None

        if appt.care_protocol_id and self._session:
            from sqlalchemy import select
            from app.infrastructure.persistence.models.prescription_model import PrescriptionModel
            from app.domain.entities.prescription import Prescription as PrescriptionEntity

            result = await self._session.execute(
                select(PrescriptionModel)
                .where(
                    PrescriptionModel.care_protocol_id == appt.care_protocol_id,
                    PrescriptionModel.status.in_(["active", "expiring"]),
                )
                .order_by(PrescriptionModel.created_at)
            )
            prescriptions = result.scalars().all()

            if not prescriptions:
                # Pas d'ordonnance rattachée : non-bloquant, signalé comme needs_review
                prescription_warning_for_review = "Aucune ordonnance rattachée au plan de soins"
            else:
                care_date = appt.scheduled_at.date()
                found_valid = False
                last_reason: str | None = None
                for presc_model in prescriptions:
                    presc_entity = PrescriptionEntity(
                        id=presc_model.id,
                        cabinet_id=presc_model.cabinet_id,
                        patient_id=presc_model.patient_id,
                        prescriber_name=presc_model.prescriber_name,
                        prescription_date=presc_model.prescription_date,
                        start_date=presc_model.start_date,
                        end_date=presc_model.end_date,
                        care_description=presc_model.care_description,
                        status=presc_model.status,
                        document_filename=presc_model.document_filename,
                        document_url=presc_model.document_url,
                    )
                    ok, reason = can_bill_against_prescription(presc_entity, care_date)
                    if not ok:
                        last_reason = reason
                        continue
                    complete, incomplete_reason = is_prescription_complete_for_billing(presc_entity)
                    if not complete:
                        last_reason = incomplete_reason
                        continue
                    prescription_id = presc_model.id
                    found_prescription_entity = presc_entity
                    found_valid = True
                    break

                if not found_valid:
                    # Ordonnance présente mais invalide/incomplète : non-bloquant, signalé comme needs_review
                    prescription_warning_for_review = last_reason or "Ordonnance invalide ou incomplète"

            # Verifie si l'ordonnance expire bientot (avertissement non-bloquant)
            if found_prescription_entity and found_prescription_entity.end_date:
                eff_status = compute_prescription_status(found_prescription_entity, care_date)
                if eff_status == "expiring":
                    days = (found_prescription_entity.end_date - care_date).days
                    prescription_warning_for_review = f"Ordonnance expire dans {days} jour(s)"

        # 9. Calcule needs_review
        needs_review, review_reason = self._detect_needs_review(
            appt=appt,
            cotation_total=cotation.total,
            prescription_warning=prescription_warning_for_review,
        )

        # 10. Cree la facture draft
        invoice = Invoice(
            cabinet_id=cabinet_id,
            idel_id=appt.idel_id,
            patient_id=appt.patient_id,
            appointment_id=appointment_id,
            prescription_id=prescription_id,
            invoice_number=invoice_number,
            invoice_date=today,
            care_date=appt.scheduled_at.date(),
            total_amo=cotation.repartition_amo,
            total_amc=cotation.repartition_amc,
            total_patient=cotation.repartition_patient,
            total_amount=cotation.total,
            tiers_payant_type="total",
            status="draft",
            metadata={
                "auto_cotation": True,
                "from_appointment": str(appointment_id),
                "auto_corrections": cotation.auto_corrections,
                "explications": cotation.explications,
                **({"needs_review": True, "review_reason": review_reason} if needs_review else {}),
            },
        )

        created = await self._invoice_repo.create(invoice)

        # 11. Cree les lignes de facture
        for i, ligne in enumerate(cotation.lignes):
            invoice_line = InvoiceLine(
                id=uuid4(),
                invoice_id=created.id,
                line_order=i + 1,
                act_code=ligne.code,
                act_label=ligne.label,
                coefficient=ligne.coefficient or Decimal("1"),
                base_rate=ligne.base_rate or Decimal("0.00"),
                quantity=ligne.quantity,
                line_subtotal=ligne.montant,
                supplements=None,
                supplements_total=Decimal("0.00"),
                line_total=ligne.montant,
            )
            await self._line_repo.create(invoice_line)

        # 12. Re-fetch avec les lignes
        final = await self._invoice_repo.get_by_id(created.id, cabinet_id)
        if final is None:
            raise ValueError("Facture introuvable apres creation")
        return invoice_entity_to_dto(final)

    # ── Helpers privés ──────────────────────────────────────────────────────

    async def _compute_distance(
        self,
        cabinet_id: UUID,
        patient_lat: float | None,
        patient_lon: float | None,
    ) -> Decimal | None:
        """
        Calcule la distance cabinet→patient via Haversine × 1.3.
        Retourne None si les coordonnées sont manquantes.
        """
        if patient_lat is None or patient_lon is None:
            return None
        if self._session is None:
            return None
        try:
            from sqlalchemy import select
            from app.infrastructure.persistence.models.cabinet_model import CabinetModel

            result = await self._session.execute(
                select(CabinetModel.lat, CabinetModel.lon)
                .where(CabinetModel.id == cabinet_id)
            )
            row = result.first()
            if row is None or row.lat is None or row.lon is None:
                return None
            return haversine_distance_km(
                float(row.lat), float(row.lon),
                patient_lat, patient_lon,
            )
        except Exception as exc:
            logger.warning("Impossible de calculer la distance cabinet→patient : %s", exc)
            return None

    async def _check_bsi_already_billed(
        self,
        patient_id: UUID,
        cabinet_id: UUID,
        care_date: datetime.date,
    ) -> bool:
        """
        Vérifie si un forfait BSI (BSA/BSB/BSC) a déjà été facturé aujourd'hui
        pour ce patient par n'importe quel IDEL du cabinet.
        """
        try:
            existing, _ = await self._invoice_repo.list_invoices(
                cabinet_id=cabinet_id,
                patient_id=patient_id,
                date_from=care_date,
                date_to=care_date,
                offset=0,
                limit=50,
            )
            for inv in existing:
                if inv.status == "canceled":
                    continue
                for line in inv.lines:
                    if line.act_code and line.act_code.upper().startswith("BS"):
                        return True
        except Exception as exc:
            logger.warning("Erreur lors du check BSI multi-IDEL : %s", exc)
        return False

    def _detect_needs_review(
        self,
        appt,
        cotation_total: Decimal,
        prescription_warning: str | None,
    ) -> tuple[bool, str | None]:
        """
        Détecte si la facture nécessite une vérification humaine.
        Retourne (needs_review, reason_str).
        """
        reasons: list[str] = []

        # 1. Ordonnance expirante bientôt
        if prescription_warning:
            reasons.append(prescription_warning)

        # 2. Soin de nuit ou très tôt (potentielle majoration)
        hour = appt.scheduled_at.hour
        if hour < 7 or hour >= 20:
            reasons.append("Soin en horaire exceptionnel — vérifier majorations")

        # 3. Montant anormalement élevé ou quasi-nul
        if cotation_total > Decimal("80"):
            reasons.append(f"Montant élevé ({cotation_total}€) — vérifier")
        elif Decimal("0") < cotation_total < Decimal("3"):
            reasons.append(f"Montant très faible ({cotation_total}€) — vérifier")

        if reasons:
            return True, " · ".join(reasons)
        return False, None
