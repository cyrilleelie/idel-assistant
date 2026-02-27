from pydantic import BaseModel


class RppsDoctorResponse(BaseModel):
    rpps_number: str
    last_name: str
    first_name: str
    profession_code: str
    profession_label: str | None = None
    specialty_label: str | None = None
    department: str | None = None
    city: str | None = None
    finess_site: str | None = None
