"""Mapping care_type → codes NGAP par defaut."""

CARE_TYPE_NGAP_MAP: dict[str, list[str]] = {
    "pansement": ["AMI_1.5"],
    "injection": ["AMI_1"],
    "perfusion": ["AMI_4"],
    "bsi": [],  # BSI = forfait, pas d'acte technique
    "prelevements": ["AMI_1.5"],
    "soins_infirmiers": ["AMI_1"],
}


def suggest_ngap_codes(care_type: str) -> list[str]:
    """Retourne les codes NGAP suggeres pour un type de soin."""
    return list(CARE_TYPE_NGAP_MAP.get(care_type, []))
