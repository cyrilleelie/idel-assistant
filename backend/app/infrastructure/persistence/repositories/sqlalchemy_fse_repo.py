"""Implémentation SQLAlchemy du repository FSE."""

import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.fse import ActeFse, Fse
from app.infrastructure.persistence.models.fse_model import FseModel


class SQLAlchemyFseRepo:
    def __init__(self, session: AsyncSession):
        self._session = session

    # --- Conversion ---

    def _model_to_entity(self, model: FseModel) -> Fse:
        actes = [
            ActeFse(
                code=a["code"],
                label=a.get("label", ""),
                coefficient=Decimal(str(a.get("coefficient", "1"))),
                quantite=Decimal(str(a.get("quantite", "1"))),
                montant=Decimal(str(a.get("montant", "0"))),
                supplements=a.get("supplements", {}),
            )
            for a in (model.actes_fse or [])
        ]
        return Fse(
            id=model.id,
            cabinet_id=model.cabinet_id,
            invoice_id=model.invoice_id,
            fse_number=model.fse_number,
            lot_number=model.lot_number,
            nir_patient=model.nir_patient,
            birth_rank=model.birth_rank,
            rpps_idel=model.rpps_idel,
            adeli_idel=model.adeli_idel,
            rpps_prescripteur=model.rpps_prescripteur,
            date_soins=model.date_soins,
            date_prescription=model.date_prescription,
            organisme_amo=model.organisme_amo,
            organisme_amc=model.organisme_amc,
            montant_total=Decimal(str(model.montant_total)),
            montant_amo=Decimal(str(model.montant_amo)),
            montant_amc=Decimal(str(model.montant_amc)),
            montant_patient=Decimal(str(model.montant_patient)),
            actes_fse=actes,
            type_fse=model.type_fse,
            nature_assurance=model.nature_assurance,
            exoneration_code=model.exoneration_code,
            raw_fse_data=model.raw_fse_data,
            status=model.status,
            exported_at=model.exported_at,
            exported_format=model.exported_format,
            transmitted_at=model.transmitted_at,
            arl_received_at=model.arl_received_at,
            rejection_reason=model.rejection_reason,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    def _entity_to_dict(self, fse: Fse) -> dict:
        return {
            "id": str(fse.id),
            "cabinet_id": str(fse.cabinet_id),
            "invoice_id": str(fse.invoice_id) if fse.invoice_id else None,
            "fse_number": fse.fse_number,
            "lot_number": fse.lot_number,
            "nir_patient": fse.nir_patient,
            "birth_rank": fse.birth_rank,
            "rpps_idel": fse.rpps_idel,
            "adeli_idel": fse.adeli_idel,
            "rpps_prescripteur": fse.rpps_prescripteur,
            "date_soins": fse.date_soins,
            "date_prescription": fse.date_prescription,
            "organisme_amo": fse.organisme_amo,
            "organisme_amc": fse.organisme_amc,
            "montant_total": fse.montant_total,
            "montant_amo": fse.montant_amo,
            "montant_amc": fse.montant_amc,
            "montant_patient": fse.montant_patient,
            "actes_fse": [
                {
                    "code": a.code,
                    "label": a.label,
                    "coefficient": str(a.coefficient),
                    "quantite": str(a.quantite),
                    "montant": str(a.montant),
                    "supplements": a.supplements,
                }
                for a in fse.actes_fse
            ],
            "type_fse": fse.type_fse,
            "nature_assurance": fse.nature_assurance,
            "exoneration_code": fse.exoneration_code,
            "raw_fse_data": fse.raw_fse_data,
            "status": fse.status,
            "exported_at": fse.exported_at,
            "exported_format": fse.exported_format,
            "transmitted_at": fse.transmitted_at,
            "arl_received_at": fse.arl_received_at,
            "rejection_reason": fse.rejection_reason,
        }

    # --- CRUD ---

    async def add(self, fse: Fse) -> Fse:
        model = FseModel(**self._entity_to_dict(fse))
        self._session.add(model)
        await self._session.flush()
        return self._model_to_entity(model)

    async def get_by_id(self, fse_id: UUID, cabinet_id: UUID) -> Fse | None:
        stmt = select(FseModel).where(
            FseModel.id == str(fse_id),
            FseModel.cabinet_id == str(cabinet_id),
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None

    async def list_by_cabinet(
        self,
        cabinet_id: UUID,
        status: str | None = None,
        lot_number: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Fse]:
        stmt = select(FseModel).where(FseModel.cabinet_id == str(cabinet_id))
        if status:
            stmt = stmt.where(FseModel.status == status)
        if lot_number:
            stmt = stmt.where(FseModel.lot_number == lot_number)
        stmt = stmt.order_by(FseModel.date_soins.desc()).limit(limit).offset(offset)
        result = await self._session.execute(stmt)
        return [self._model_to_entity(m) for m in result.scalars().all()]

    async def update(self, fse: Fse) -> Fse:
        stmt = select(FseModel).where(FseModel.id == str(fse.id))
        result = await self._session.execute(stmt)
        model = result.scalar_one()
        for key, value in self._entity_to_dict(fse).items():
            if key != "id":
                setattr(model, key, value)
        model.updated_at = datetime.datetime.now(datetime.UTC)
        await self._session.flush()
        return self._model_to_entity(model)

    async def list_by_lot(self, cabinet_id: UUID, lot_number: str) -> list[Fse]:
        stmt = select(FseModel).where(
            FseModel.cabinet_id == str(cabinet_id),
            FseModel.lot_number == lot_number,
        ).order_by(FseModel.date_soins)
        result = await self._session.execute(stmt)
        return [self._model_to_entity(m) for m in result.scalars().all()]
