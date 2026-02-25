import datetime
from decimal import Decimal
from uuid import UUID

from app.application.dtos.care_catalog_dto import TariffUpdateDTO
from app.domain.entities.care_type_catalog import CareTypeCatalog
from app.domain.repositories.care_type_catalog_repository import (
    CareTypeCatalogRepository,
    TariffUpdateRepository,
)


class ApplyTariffUpdateUseCase:
    def __init__(
        self,
        catalog_repo: CareTypeCatalogRepository,
        tariff_repo: TariffUpdateRepository,
    ):
        self._catalog_repo = catalog_repo
        self._tariff_repo = tariff_repo

    async def execute(self, update_id: UUID) -> TariffUpdateDTO:
        update = await self._tariff_repo.get_by_id(update_id)
        if update is None:
            raise ValueError(f"Mise a jour tarifaire {update_id} introuvable")

        if update.status != "available":
            raise ValueError(
                f"Mise a jour tarifaire {update_id} n'est pas disponible "
                f"(statut actuel: {update.status})"
            )

        changes = update.changes or {}
        effective_date = update.effective_at
        day_before = effective_date - datetime.timedelta(days=1)

        for code, change_data in changes.items():
            # Fermer l'ancien tarif (mettre effective_to a la veille)
            old_entry = await self._catalog_repo.get_by_code(
                code=code,
                at_date=day_before,
            )
            if old_entry is not None:
                old_entry.effective_to = day_before
                await self._catalog_repo.update(old_entry)

            # Creer le nouveau tarif
            new_base_rate = change_data.get("new_base_rate")
            new_fixed = change_data.get("new_fixed_amount")
            new_coeff = change_data.get("new_coefficient")

            new_entry = CareTypeCatalog(
                code=code,
                lettre_cle=change_data.get("lettre_cle", old_entry.lettre_cle if old_entry else ""),
                label=change_data.get("label", old_entry.label if old_entry else code),
                category=change_data.get("category", old_entry.category if old_entry else "technique"),
                unit=change_data.get("unit", old_entry.unit if old_entry else "acte"),
                coefficient=Decimal(str(new_coeff)) if new_coeff is not None else (old_entry.coefficient if old_entry else None),
                base_rate=Decimal(str(new_base_rate)) if new_base_rate is not None else (old_entry.base_rate if old_entry else None),
                fixed_amount=Decimal(str(new_fixed)) if new_fixed is not None else (old_entry.fixed_amount if old_entry else None),
                default_duration_minutes=old_entry.default_duration_minutes if old_entry else None,
                is_cumulative=old_entry.is_cumulative if old_entry else False,
                cumul_rules=old_entry.cumul_rules if old_entry else None,
                context_rules=old_entry.context_rules if old_entry else None,
                effective_from=effective_date,
                effective_to=None,
                avenant_source=update.avenant_reference,
                is_system=True,
                is_active=True,
                display_order=old_entry.display_order if old_entry else 0,
            )
            await self._catalog_repo.create(new_entry)

        # Marquer la mise a jour comme appliquee
        applied = await self._tariff_repo.mark_applied(update_id)
        return TariffUpdateDTO(
            id=applied.id,
            version=applied.version,
            avenant_reference=applied.avenant_reference,
            published_at=applied.published_at,
            effective_at=applied.effective_at,
            description=applied.description,
            changes=applied.changes,
            status=applied.status,
            applied_at=applied.applied_at,
            created_at=applied.created_at,
        )
