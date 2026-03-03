"""Use case : auto-complétion d'un plan de soins quand tous ses RDV sont terminés."""

import logging
from dataclasses import dataclass
from uuid import UUID

from app.domain.repositories.appointment_repository import AppointmentRepository
from app.domain.repositories.care_protocol_repository import CareProtocolRepository
from app.domain.repositories.prescription_repository import PrescriptionRepository

logger = logging.getLogger(__name__)

TERMINAL_STATUSES = frozenset({"completed", "canceled"})


@dataclass
class CareProtocolCompletionResult:
    protocol_completed: bool = False
    prescriptions_expired: list[str] = None
    prescriptions_active: list[str] = None

    def __post_init__(self):
        if self.prescriptions_expired is None:
            self.prescriptions_expired = []
        if self.prescriptions_active is None:
            self.prescriptions_active = []


class CompleteCareProtocolUseCase:
    def __init__(
        self,
        appointment_repo: AppointmentRepository,
        care_protocol_repo: CareProtocolRepository,
        prescription_repo: PrescriptionRepository,
    ):
        self._appointment_repo = appointment_repo
        self._care_protocol_repo = care_protocol_repo
        self._prescription_repo = prescription_repo

    async def execute(
        self,
        care_protocol_id: UUID,
        cabinet_id: UUID,
    ) -> CareProtocolCompletionResult:
        result = CareProtocolCompletionResult()

        # 1. Charger le plan de soins
        protocol = await self._care_protocol_repo.get_by_id(care_protocol_id)
        if not protocol or protocol.cabinet_id != cabinet_id:
            return result
        if protocol.status == "completed":
            return result

        # 2. Charger tous les RDV du plan
        appointments = await self._appointment_repo.list_by_care_protocol(
            care_protocol_id, cabinet_id
        )
        if not appointments:
            return result

        # 3. Vérifier que tous les RDV sont terminaux et au moins un completed
        statuses = [a.status for a in appointments]
        all_terminal = all(s in TERMINAL_STATUSES for s in statuses)
        any_completed = any(s == "completed" for s in statuses)
        if not (all_terminal and any_completed):
            return result

        # 4. Compléter le plan de soins
        protocol.status = "completed"
        await self._care_protocol_repo.update(protocol)
        result.protocol_completed = True
        logger.info("Plan de soins %s complété automatiquement", care_protocol_id)

        # 5. Traiter les ordonnances liées
        prescriptions = await self._prescription_repo.list_by_care_protocol(
            care_protocol_id
        )
        for rx in prescriptions:
            if rx.status not in ("active", "expiring"):
                continue

            rx.current_renewal += 1

            if rx.max_renewals == 0:
                # Aucun renouvellement autorisé → expirer
                rx.status = "expired"
                result.prescriptions_expired.append(str(rx.id))
            elif rx.current_renewal >= rx.max_renewals:
                # Quota de renouvellements atteint → expirer
                rx.status = "expired"
                result.prescriptions_expired.append(str(rx.id))
            else:
                # Renouvellements restants → reste active
                result.prescriptions_active.append(str(rx.id))

            await self._prescription_repo.update(rx)
            logger.info(
                "Ordonnance %s : current_renewal=%d/%d → %s",
                rx.id, rx.current_renewal, rx.max_renewals, rx.status,
            )

        return result
