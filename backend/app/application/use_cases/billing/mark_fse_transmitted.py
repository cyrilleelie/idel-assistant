"""MarkFseTransmittedUseCase — Marque des FSE comme transmises à la CPAM."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.repositories.sqlalchemy_fse_repo import SQLAlchemyFseRepo


@dataclass
class MarkFseTransmittedInput:
    cabinet_id: UUID
    fse_ids: list[UUID]


@dataclass
class MarkFseTransmittedOutput:
    updated: list[str]
    skipped: list[dict]


class MarkFseTransmittedUseCase:
    def __init__(self, session: AsyncSession):
        self._repo = SQLAlchemyFseRepo(session)

    async def execute(self, inp: MarkFseTransmittedInput) -> MarkFseTransmittedOutput:
        updated = []
        skipped = []
        for fse_id in inp.fse_ids:
            fse = await self._repo.get_by_id(fse_id, inp.cabinet_id)
            if fse is None:
                skipped.append({"fse_id": str(fse_id), "reason": "not_found"})
                continue
            try:
                fse.mark_transmitted()
                await self._repo.update(fse)
                updated.append(str(fse_id))
            except ValueError as exc:
                skipped.append({"fse_id": str(fse_id), "reason": str(exc)})
        return MarkFseTransmittedOutput(updated=updated, skipped=skipped)
