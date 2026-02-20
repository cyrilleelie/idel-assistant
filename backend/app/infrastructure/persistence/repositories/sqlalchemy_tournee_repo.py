import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.tournee import Tournee, TourneeStop
from app.domain.repositories.tournee_repository import TourneeRepository
from app.infrastructure.persistence.models.tournee_model import (
    TourneeModel,
    TourneeStopModel,
)


class SQLAlchemyTourneeRepo(TourneeRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    def _model_to_entity(self, model: TourneeModel) -> Tournee:
        return Tournee(
            id=model.id,
            cabinet_id=model.cabinet_id,
            idel_id=model.idel_id,
            tournee_date=model.tournee_date,
            status=model.status,
            start_location_lat=(model.start_location or {}).get("lat"),
            start_location_lon=(model.start_location or {}).get("lon"),
            end_location_lat=(model.end_location or {}).get("lat"),
            end_location_lon=(model.end_location or {}).get("lon"),
            total_distance_km=model.total_distance_km,
            total_duration_hours=model.total_duration_hours,
            savings_km=model.savings_km,
            savings_minutes=model.savings_minutes,
            num_stops=model.num_stops,
            optimization_params=model.optimization_params or {},
            optimized_at=model.optimized_at,
            started_at=model.started_at,
            completed_at=model.completed_at,
            created_at=model.created_at,
        )

    def _stop_model_to_entity(self, model: TourneeStopModel) -> TourneeStop:
        return TourneeStop(
            id=model.id,
            tournee_id=model.tournee_id,
            appointment_id=model.appointment_id,
            stop_order=model.stop_order,
            estimated_arrival=model.estimated_arrival,
            actual_arrival=model.actual_arrival,
            distance_from_previous_km=model.distance_from_previous_km,
            travel_time_from_previous_min=model.travel_time_from_previous_min,
            status=model.status,
        )

    async def get_by_id(self, tournee_id: UUID) -> Tournee | None:
        result = await self._session.execute(
            select(TourneeModel).where(TourneeModel.id == tournee_id)
        )
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None

    async def get_by_date(
        self, cabinet_id: UUID, idel_id: UUID, date: datetime.date
    ) -> Tournee | None:
        result = await self._session.execute(
            select(TourneeModel).where(
                TourneeModel.cabinet_id == cabinet_id,
                TourneeModel.idel_id == idel_id,
                TourneeModel.tournee_date == date,
            )
        )
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None

    async def get_stops(self, tournee_id: UUID) -> list[TourneeStop]:
        result = await self._session.execute(
            select(TourneeStopModel)
            .where(TourneeStopModel.tournee_id == tournee_id)
            .order_by(TourneeStopModel.stop_order)
        )
        return [self._stop_model_to_entity(m) for m in result.scalars().all()]

    async def save_with_stops(
        self, tournee: Tournee, stops: list[TourneeStop]
    ) -> Tournee:
        model = TourneeModel(
            id=tournee.id,
            cabinet_id=tournee.cabinet_id,
            idel_id=tournee.idel_id,
            tournee_date=tournee.tournee_date,
            status=tournee.status,
            start_location={"lat": tournee.start_location_lat, "lon": tournee.start_location_lon}
            if tournee.start_location_lat
            else None,
            end_location={"lat": tournee.end_location_lat, "lon": tournee.end_location_lon}
            if tournee.end_location_lat
            else None,
            total_distance_km=tournee.total_distance_km,
            total_duration_hours=tournee.total_duration_hours,
            savings_km=tournee.savings_km,
            savings_minutes=tournee.savings_minutes,
            num_stops=tournee.num_stops,
            optimization_params=tournee.optimization_params,
            optimized_at=tournee.optimized_at,
        )
        self._session.add(model)

        for stop in stops:
            stop_model = TourneeStopModel(
                id=stop.id,
                tournee_id=stop.tournee_id,
                appointment_id=stop.appointment_id,
                stop_order=stop.stop_order,
                estimated_arrival=stop.estimated_arrival,
                distance_from_previous_km=stop.distance_from_previous_km,
                travel_time_from_previous_min=stop.travel_time_from_previous_min,
                status=stop.status,
            )
            self._session.add(stop_model)

        await self._session.flush()
        return self._model_to_entity(model)

    async def update(self, tournee: Tournee) -> Tournee:
        result = await self._session.execute(
            select(TourneeModel).where(TourneeModel.id == tournee.id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"Tournee {tournee.id} not found")

        model.status = tournee.status
        model.started_at = tournee.started_at
        model.completed_at = tournee.completed_at
        await self._session.flush()
        return self._model_to_entity(model)

    async def update_stop(self, stop: TourneeStop) -> TourneeStop:
        result = await self._session.execute(
            select(TourneeStopModel).where(TourneeStopModel.id == stop.id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"TourneeStop {stop.id} not found")

        model.actual_arrival = stop.actual_arrival
        model.status = stop.status
        await self._session.flush()
        return self._stop_model_to_entity(model)

    async def get_stats(
        self,
        cabinet_id: UUID,
        from_date: datetime.date,
        to_date: datetime.date,
    ) -> dict:
        from sqlalchemy import func as sqlfunc

        result = await self._session.execute(
            select(
                sqlfunc.count(TourneeModel.id).label("num_tournees"),
                sqlfunc.coalesce(sqlfunc.sum(TourneeModel.savings_km), 0).label("total_km_saved"),
                sqlfunc.coalesce(sqlfunc.sum(TourneeModel.savings_minutes), 0).label("total_minutes_saved"),
                sqlfunc.coalesce(sqlfunc.avg(TourneeModel.num_stops), 0).label("avg_patients_per_day"),
            ).where(
                TourneeModel.cabinet_id == cabinet_id,
                TourneeModel.tournee_date.between(from_date, to_date),
                TourneeModel.status.in_(["optimized", "in_progress", "completed"]),
            )
        )
        row = result.one()
        return {
            "num_tournees": row.num_tournees,
            "total_km_saved": float(row.total_km_saved),
            "total_minutes_saved": float(row.total_minutes_saved),
            "avg_patients_per_day": float(row.avg_patients_per_day),
        }
