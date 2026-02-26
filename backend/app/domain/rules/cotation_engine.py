"""Moteur de cotation automatique NGAP post-avenant 10.

Gere automatiquement :
- Distinction AMI vs AMX selon le statut BSI du patient
- Choix IFD vs IFI selon le contexte de soin
- Non-cumul majorations horaires / forfaits BSI
- Regles de cumul article 11 (acte principal 100%, 2e acte 50%)
- Majorations MCI, MAU, MIE, nuit, dimanche/ferie
"""

import datetime
from decimal import Decimal, ROUND_HALF_UP

from app.domain.entities.care_type_catalog import CareTypeCatalog
from app.domain.services.french_holidays import is_sunday_or_holiday
from app.domain.value_objects.cotation_result import CotationLigne, CotationResult
from app.domain.value_objects.patient_cotation_context import PatientCotationContext

# Tarifs fixes des majorations (avenant 10)
_MAJ_NUIT_PROF = Decimal("18.30")  # 23h-5h
_MAJ_NUIT = Decimal("9.15")        # 20h-23h ou 5h-8h
_MAJ_DIM = Decimal("8.50")         # Dimanche / ferie
_MCI = Decimal("5.00")             # Majoration coordination infirmiere
_MAU = Decimal("1.35")             # Majoration acte unique
_MIE = Decimal("3.15")             # Majoration infirmier enfant (< 7 ans)
_IFD_MONTANT = Decimal("2.75")     # Indemnite forfaitaire de deplacement
_IFI_MONTANT = Decimal("2.75")     # Indemnite forfaitaire infirmiere (BSI)

# Tarifs IK
_IK_PLAINE = Decimal("0.35")
_IK_MONTAGNE = Decimal("0.50")
_IK_ABATTEMENT_PLAINE = Decimal("4")
_IK_ABATTEMENT_MONTAGNE = Decimal("2")


class CotationEngine:
    def coter_passage(
        self,
        actes: list[str],
        date_heure_soin: datetime.datetime,
        distance_km: Decimal,
        lieu: str,
        zone_ik: str,
        est_premier_soin_journee: bool,
        patient_context: PatientCotationContext,
        catalog: dict[str, CareTypeCatalog],
    ) -> CotationResult:
        result = CotationResult()
        date_soin = date_heure_soin.date()
        heure_soin = date_heure_soin.time()

        if not actes and not patient_context.has_active_bsi:
            return result

        # --- Etape 1 : Resolution AMI -> AMX si patient BSI ---
        resolved_actes = self._resolve_ami_to_amx(actes, patient_context, result)

        # --- Etape 2 : Application article 11 (cumul d'actes techniques) ---
        actes_techniques = self._apply_article_11(resolved_actes, catalog, result)

        # --- Etape 3 : Ajout forfait BSI ---
        self._add_bsi_forfait(patient_context, catalog, result)

        # --- Etape 4 : Indemnites de deplacement ---
        self._add_indemnites_deplacement(lieu, distance_km, zone_ik, patient_context, result)

        # --- Etape 5 : Majorations horaires (pas sur BSI) ---
        nb_actes_techniques = len(actes_techniques)
        self._add_majorations_horaires(heure_soin, date_soin, nb_actes_techniques, result)

        # --- Etape 6 : MCI ---
        self._add_mci(est_premier_soin_journee, nb_actes_techniques, result)

        # --- Etape 7 : MAU ---
        self._add_mau(nb_actes_techniques, result)

        # --- Etape 8 : MIE (enfant < 7 ans) ---
        self._add_mie(patient_context, nb_actes_techniques, result)

        # --- Etape 9 : Totaux et repartition ---
        self._calculate_totals(patient_context, result)

        return result

    def _resolve_ami_to_amx(
        self,
        actes: list[str],
        ctx: PatientCotationContext,
        result: CotationResult,
    ) -> list[str]:
        """Etape 1 : Remplace AMI par AMX si patient avec BSI actif."""
        resolved = []
        for acte in actes:
            if ctx.has_active_bsi and acte.upper().startswith("AMI"):
                suffix = acte[3:]  # "_4", "_1.5", etc.
                new_code = f"AMX{suffix}"
                result.auto_corrections.append(
                    f"{acte} \u2192 {new_code} (patient avec BSI actif)"
                )
                resolved.append(new_code)
            else:
                resolved.append(acte)
        return resolved

    def _apply_article_11(
        self,
        actes: list[str],
        catalog: dict[str, CareTypeCatalog],
        result: CotationResult,
    ) -> list[str]:
        """Etape 2 : Trie les actes techniques par coefficient decroissant et applique article 11."""
        # Separe les actes techniques (AMI/AMX) des autres
        actes_techniques: list[tuple[str, CareTypeCatalog]] = []
        for code in actes:
            upper = code.upper()
            if upper.startswith("AMI") or upper.startswith("AMX"):
                cat_entry = catalog.get(code)
                if cat_entry is None:
                    raise ValueError(f"Acte '{code}' introuvable dans le catalogue")
                actes_techniques.append((code, cat_entry))

        if not actes_techniques:
            return []

        # Trier par coefficient decroissant
        actes_techniques.sort(
            key=lambda x: x[1].coefficient or Decimal("0"),
            reverse=True,
        )

        technique_codes = []
        for i, (code, entry) in enumerate(actes_techniques):
            coeff = entry.coefficient or Decimal("1")
            base = entry.base_rate or Decimal("0.00")

            if i == 0:
                # 1er acte : 100%
                montant = (coeff * base).quantize(Decimal("0.01"), ROUND_HALF_UP)
                result.lignes.append(CotationLigne(
                    code=code,
                    label=entry.label,
                    montant=montant,
                    coefficient=coeff,
                    base_rate=base,
                    category="acte",
                ))
            elif i == 1:
                # 2e acte : 50%
                montant = (coeff * base * Decimal("0.5")).quantize(Decimal("0.01"), ROUND_HALF_UP)
                result.lignes.append(CotationLigne(
                    code=code,
                    label=f"{entry.label} (art.11 : 50%)",
                    montant=montant,
                    coefficient=coeff,
                    base_rate=base,
                    category="acte",
                ))
                result.explications.append(
                    f"Article 11 : 2e acte {code} a 50%"
                )
            else:
                # 3e et suivants : 0
                result.lignes.append(CotationLigne(
                    code=code,
                    label=f"{entry.label} (art.11 : gratuit)",
                    montant=Decimal("0.00"),
                    coefficient=coeff,
                    base_rate=base,
                    category="acte",
                ))
                result.explications.append(
                    f"Article 11 : {i + 1}e acte {code} gratuit"
                )

            technique_codes.append(code)

        return technique_codes

    def _add_bsi_forfait(
        self,
        ctx: PatientCotationContext,
        catalog: dict[str, CareTypeCatalog],
        result: CotationResult,
    ) -> None:
        """Etape 3 : Ajoute le forfait BSI si applicable."""
        if not ctx.has_active_bsi:
            return

        if ctx.bsi_already_billed_today:
            result.auto_corrections.append(
                "Forfait BSI non facture (deja facture aujourd'hui par un collegue)"
            )
            return

        if not ctx.bsi_level:
            return

        level_code = ctx.bsi_level.upper()  # "BSA", "BSB", "BSC"
        cat_entry = catalog.get(level_code)
        if cat_entry is None:
            result.explications.append(
                f"Forfait BSI {level_code} non trouve dans le catalogue"
            )
            return

        montant = cat_entry.fixed_amount or Decimal("0.00")
        result.lignes.append(CotationLigne(
            code=level_code,
            label=cat_entry.label,
            montant=montant,
            base_rate=montant,
            category="forfait",
        ))
        result.explications.append(
            f"Forfait BSI {level_code} journalier ({montant}\u20ac)"
        )

    def _add_indemnites_deplacement(
        self,
        lieu: str,
        distance_km: Decimal,
        zone_ik: str,
        ctx: PatientCotationContext,
        result: CotationResult,
    ) -> None:
        """Etape 4 : Indemnites de deplacement (uniquement a domicile)."""
        if lieu != "domicile":
            result.explications.append(
                "Soin au cabinet : pas d'indemnites de deplacement"
            )
            return

        # IFD ou IFI
        if ctx.has_active_bsi:
            result.lignes.append(CotationLigne(
                code="IFI",
                label="Indemnite forfaitaire infirmiere (BSI)",
                montant=_IFI_MONTANT,
                base_rate=_IFI_MONTANT,
                category="indemnite",
            ))
            result.auto_corrections.append("IFD \u2192 IFI (patient avec BSI actif)")
        else:
            result.lignes.append(CotationLigne(
                code="IFD",
                label="Indemnite forfaitaire de deplacement",
                montant=_IFD_MONTANT,
                base_rate=_IFD_MONTANT,
                category="indemnite",
            ))

        # IK
        if zone_ik == "montagne":
            abattement = _IK_ABATTEMENT_MONTAGNE
            tarif_km = _IK_MONTAGNE
        else:
            abattement = _IK_ABATTEMENT_PLAINE
            tarif_km = _IK_PLAINE

        distance_facturable = max(Decimal("0"), distance_km - abattement)
        if distance_facturable > 0:
            montant_ik = (distance_facturable * tarif_km).quantize(Decimal("0.01"), ROUND_HALF_UP)
            result.lignes.append(CotationLigne(
                code="IK",
                label=f"Indemnite kilometrique ({zone_ik})",
                montant=montant_ik,
                quantity=distance_facturable,
                base_rate=tarif_km,
                category="indemnite",
            ))
            result.explications.append(
                f"IK : {distance_km}km \u2212 {abattement}km = {distance_facturable}km \u00d7 {tarif_km}\u20ac = {montant_ik}\u20ac"
            )

    def _add_majorations_horaires(
        self,
        heure: datetime.time,
        date_soin: datetime.date,
        nb_actes_techniques: int,
        result: CotationResult,
    ) -> None:
        """Etape 5 : Majorations horaires (pas sur forfaits BSI)."""
        if nb_actes_techniques == 0:
            return

        # Majoration nuit
        if heure >= datetime.time(23, 0) or heure < datetime.time(5, 0):
            result.lignes.append(CotationLigne(
                code="MAJ_NUIT_PROF",
                label="Majoration nuit profonde (23h-5h)",
                montant=_MAJ_NUIT_PROF,
                base_rate=_MAJ_NUIT_PROF,
                category="majoration",
            ))
            result.explications.append(
                f"Majoration nuit profonde appliquee ({heure.strftime('%Hh%M')} \u2192 tranche 23h-5h)"
            )
        elif heure >= datetime.time(20, 0) or heure < datetime.time(8, 0):
            result.lignes.append(CotationLigne(
                code="MAJ_NUIT",
                label="Majoration nuit (20h-23h / 5h-8h)",
                montant=_MAJ_NUIT,
                base_rate=_MAJ_NUIT,
                category="majoration",
            ))
            result.explications.append(
                f"Majoration nuit appliquee ({heure.strftime('%Hh%M')} \u2192 tranche 20h-23h ou 5h-8h)"
            )

        # Majoration dimanche / ferie
        if is_sunday_or_holiday(date_soin):
            result.lignes.append(CotationLigne(
                code="MAJ_DIM",
                label="Majoration dimanche / jour ferie",
                montant=_MAJ_DIM,
                base_rate=_MAJ_DIM,
                category="majoration",
            ))
            result.explications.append("Majoration dimanche/ferie appliquee")

    def _add_mci(
        self,
        est_premier_soin: bool,
        nb_actes_techniques: int,
        result: CotationResult,
    ) -> None:
        """Etape 6 : MCI (Majoration Coordination Infirmiere)."""
        if est_premier_soin and nb_actes_techniques > 0:
            result.lignes.append(CotationLigne(
                code="MCI",
                label="Majoration coordination infirmiere",
                montant=_MCI,
                base_rate=_MCI,
                category="majoration",
            ))
            result.explications.append(
                "MCI : premier soin technique du patient aujourd'hui"
            )

    def _add_mau(
        self,
        nb_actes_techniques: int,
        result: CotationResult,
    ) -> None:
        """Etape 7 : MAU (Majoration Acte Unique)."""
        if nb_actes_techniques == 1:
            result.lignes.append(CotationLigne(
                code="MAU",
                label="Majoration acte unique",
                montant=_MAU,
                base_rate=_MAU,
                category="majoration",
            ))
            result.explications.append(
                "MAU : acte technique unique dans le passage"
            )

    def _add_mie(
        self,
        ctx: PatientCotationContext,
        nb_actes_techniques: int,
        result: CotationResult,
    ) -> None:
        """Etape 8 : MIE (Majoration Infirmier Enfant, < 7 ans)."""
        if ctx.age >= 7 or nb_actes_techniques == 0:
            return

        for _ in range(nb_actes_techniques):
            result.lignes.append(CotationLigne(
                code="MIE",
                label="Majoration infirmier enfant (< 7 ans)",
                montant=_MIE,
                base_rate=_MIE,
                category="majoration",
            ))

        result.explications.append(
            f"MIE : patient de {ctx.age} ans (< 7 ans), {nb_actes_techniques} majoration(s)"
        )

    def _calculate_totals(
        self,
        ctx: PatientCotationContext,
        result: CotationResult,
    ) -> None:
        """Etape 9 : Calcul des totaux et repartition AMO/AMC."""
        result.total = sum(
            (l.montant for l in result.lignes), Decimal("0.00")
        ).quantize(Decimal("0.01"), ROUND_HALF_UP)

        if ctx.is_ald or ctx.is_maternity:
            result.repartition_amo = result.total
            result.repartition_amc = Decimal("0.00")
            result.repartition_patient = Decimal("0.00")
        else:
            result.repartition_amo = (result.total * Decimal("0.6")).quantize(Decimal("0.01"), ROUND_HALF_UP)
            result.repartition_amc = (result.total * Decimal("0.4")).quantize(Decimal("0.01"), ROUND_HALF_UP)
            result.repartition_patient = Decimal("0.00")
