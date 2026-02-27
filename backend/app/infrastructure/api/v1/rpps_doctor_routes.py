"""Routes de recherche dans le référentiel RPPS."""

from fastapi import APIRouter, Depends, Query

from app.infrastructure.api.dependencies import AuthContext, get_current_user, get_rpps_doctor_repo
from app.infrastructure.api.schemas.rpps_doctor_schemas import RppsDoctorResponse
from app.infrastructure.persistence.repositories.sqlalchemy_rpps_doctor_repo import SQLAlchemyRppsDoctorRepo

router = APIRouter(prefix="/rpps-doctors", tags=["rpps"])


@router.get("/", response_model=list[RppsDoctorResponse])
async def search_rpps_doctors(
    q: str = Query(min_length=2, description="Terme de recherche (nom ou prénom)"),
    limit: int = Query(default=10, ge=1, le=50),
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyRppsDoctorRepo = Depends(get_rpps_doctor_repo),
) -> list[RppsDoctorResponse]:
    doctors = await repo.search(q, limit=limit)
    return [
        RppsDoctorResponse(
            rpps_number=d.rpps_number,
            last_name=d.last_name,
            first_name=d.first_name,
            profession_code=d.profession_code,
            profession_label=d.profession_label,
            specialty_label=d.specialty_label,
            department=d.department,
            city=d.city,
            finess_site=d.finess_site,
        )
        for d in doctors
    ]
