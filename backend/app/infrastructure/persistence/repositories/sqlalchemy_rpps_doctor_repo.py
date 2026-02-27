from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.rpps_doctor import RppsDoctor
from app.domain.repositories.rpps_doctor_repository import RppsDoctorRepository
from app.infrastructure.persistence.models.rpps_doctor_model import RppsDoctorModel

# asyncpg limite les paramètres de requête à 32 767.
# Avec 11 colonnes par ligne : max 2 978 lignes par batch (32767 // 11 = 2978).
_BATCH_SIZE = 2900


class SQLAlchemyRppsDoctorRepo(RppsDoctorRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    def _model_to_entity(self, model: RppsDoctorModel) -> RppsDoctor:
        return RppsDoctor(
            id=model.id,
            rpps_number=model.rpps_number,
            last_name=model.last_name,
            first_name=model.first_name,
            profession_code=model.profession_code,
            profession_label=model.profession_label,
            specialty_code=model.specialty_code,
            specialty_label=model.specialty_label,
            department=model.department,
            city=model.city,
            finess_site=model.finess_site,
            active=model.active,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def search(self, query: str, limit: int = 10) -> list[RppsDoctor]:
        """Recherche full-text sur last_name || ' ' || first_name via ILIKE + trigram."""
        pattern = f"%{query}%"
        stmt = (
            select(RppsDoctorModel)
            .where(
                RppsDoctorModel.active.is_(True),
                (
                    RppsDoctorModel.last_name.ilike(pattern)
                    | RppsDoctorModel.first_name.ilike(pattern)
                ),
            )
            .order_by(
                text(
                    "similarity(last_name || ' ' || first_name, :q) DESC"
                ).bindparams(q=query)
            )
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        models = result.scalars().all()
        return [self._model_to_entity(m) for m in models]

    async def bulk_upsert(self, doctors: list[RppsDoctor]) -> int:
        """INSERT ... ON CONFLICT (rpps_number) DO UPDATE par batches de 5000."""
        total_upserted = 0

        for i in range(0, len(doctors), _BATCH_SIZE):
            batch = doctors[i : i + _BATCH_SIZE]
            values = [
                {
                    "rpps_number": d.rpps_number,
                    "last_name": d.last_name,
                    "first_name": d.first_name,
                    "profession_code": d.profession_code,
                    "profession_label": d.profession_label,
                    "specialty_code": d.specialty_code,
                    "specialty_label": d.specialty_label,
                    "department": d.department,
                    "city": d.city,
                    "finess_site": d.finess_site,
                    "active": d.active,
                }
                for d in batch
            ]
            stmt = pg_insert(RppsDoctorModel).values(values)
            stmt = stmt.on_conflict_do_update(
                index_elements=["rpps_number"],
                set_={
                    "last_name": stmt.excluded.last_name,
                    "first_name": stmt.excluded.first_name,
                    "profession_code": stmt.excluded.profession_code,
                    "profession_label": stmt.excluded.profession_label,
                    "specialty_code": stmt.excluded.specialty_code,
                    "specialty_label": stmt.excluded.specialty_label,
                    "department": stmt.excluded.department,
                    "city": stmt.excluded.city,
                    "finess_site": stmt.excluded.finess_site,
                    "active": stmt.excluded.active,
                    "updated_at": text("now()"),
                },
            )
            await self._session.execute(stmt)
            await self._session.flush()
            total_upserted += len(batch)

        return total_upserted
