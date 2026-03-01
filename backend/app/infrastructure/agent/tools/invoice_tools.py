"""Outils de consultation et de cotation de la facturation."""

import datetime
import logging
import re
import time
from decimal import Decimal
from uuid import UUID

from pydantic_ai import RunContext

from app.application.dtos.cotation_dto import SimulateCotationDTO
from app.application.use_cases.billing.simulate_cotation import SimulateCotationUseCase
from app.infrastructure.agent.audit import log_tool_call
from app.infrastructure.agent.context import AgentDeps

logger = logging.getLogger(__name__)


# ── Helpers extraction texte ──────────────────────────────────────────────────

# Mapping mot-clé (en minuscule) → codes NGAP
# Trié par longueur décroissante dans _extract_actes pour éviter les faux matchs
_ACTE_KEYWORDS: dict[str, list[str]] = {
    "pansement complexe": ["AMI 4"],
    "pansement lourd": ["AMI 4"],
    "pansement très lourd": ["AMI 4"],
    "escarre": ["AMI 4"],
    "drainage": ["AMI 4"],
    "nécrose": ["AMI 4"],
    "ablation fils": ["AIS 1"],
    "ablation agrafes": ["AIS 1"],
    "pansement simple": ["AIS 1"],
    "injection insuline": ["AMI 1"],
    "injection iv": ["AMI 1"],
    "injection im": ["AMI 1"],
    "injection sc": ["AMI 1"],
    "glycémie": ["AMI 1"],
    "prise de sang": ["AMI 1"],
    "prélèvement": ["AMI 1"],
    "perfusion": ["AIS 3"],
    "cathéter": ["AIS 3"],
    "sonde urinaire": ["AIS 2"],
    "sondage vésical": ["AIS 2"],
    "cicatrisation": ["AIS 2"],
    "bilan": ["AMI 2"],
    "surveillance": ["AMI 2"],
    "stomie": ["AMI 3"],
    "gastrostomie": ["AMI 3"],
    "colostomie": ["AMI 3"],
    "fistule": ["AMI 3"],
}

_KM_PATTERN = re.compile(r"(\d+(?:[.,]\d+)?)\s*km", re.I)

_HEURE_PATTERNS = [
    re.compile(r"\b(\d{1,2})h(\d{2})\b"),   # 7h30, 07h30
    re.compile(r"\b(\d{1,2})h\b"),            # 7h, 19h
    re.compile(r"\b(\d{1,2}):(\d{2})\b"),     # 07:30, 19:30
]


def _extract_actes(text: str) -> list[str]:
    """Extrait les codes NGAP depuis une description libre (keyword matching)."""
    text_lower = text.lower()
    actes: list[str] = []
    seen: set[str] = set()
    # Tri par longueur décroissante → "pansement complexe" avant "pansement simple"
    for keyword in sorted(_ACTE_KEYWORDS, key=len, reverse=True):
        if keyword in text_lower:
            for code in _ACTE_KEYWORDS[keyword]:
                if code not in seen:
                    actes.append(code)
                    seen.add(code)
    # Fallback
    return actes if actes else ["AMI 1"]


def _extract_distance_km(text: str) -> Decimal:
    """Extrait la distance en km depuis le texte. Retourne 0 si absent."""
    m = _KM_PATTERN.search(text)
    if m:
        return Decimal(m.group(1).replace(",", "."))
    return Decimal("0")


def _extract_heure(text: str) -> tuple[int, int] | None:
    """Extrait heure:minute depuis le texte. Retourne (h, m) ou None."""
    for pat in _HEURE_PATTERNS:
        m = pat.search(text)
        if m:
            hour = int(m.group(1))
            minute = int(m.group(2)) if len(m.groups()) > 1 and m.group(2) else 0
            if 0 <= hour < 24 and 0 <= minute < 60:
                return hour, minute
    return None


# ── Outils de consultation (lecture seule) ────────────────────────────────────


async def get_invoices_pending(ctx: RunContext[AgentDeps]) -> dict:
    """Retourne la liste des factures en attente de paiement (validées ou transmises)."""
    logger.info("[AGENT TOOL] get_invoices_pending appelé")
    start = time.monotonic()
    tool_input = {}
    cabinet_id = ctx.deps.context.cabinet_id
    try:
        invoices, _total = await ctx.deps.invoice_repo.list_unpaid(
            cabinet_id=cabinet_id, offset=0, limit=50
        )
        total_amount = sum(float(inv.total_amount or 0) for inv in invoices)
        result = {
            "count": len(invoices),
            "total_amount": round(total_amount, 2),
            "invoices": [
                {
                    "id": str(inv.id),
                    "invoice_number": inv.invoice_number,
                    "patient_id": str(inv.patient_id) if inv.patient_id else None,
                    "total_amount": float(inv.total_amount or 0),
                    "status": inv.status,
                    "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
                }
                for inv in invoices[:20]  # limite affichage
            ],
        }
    except Exception as exc:
        logger.warning("Erreur get_invoices_pending", exc_info=True)
        result = {"error": f"Impossible de récupérer les factures : {type(exc).__name__}: {exc}"}

    duration_ms = int((time.monotonic() - start) * 1000)
    try:
        await log_tool_call(
            ctx.deps.db, ctx.deps.context, "get_invoices_pending",
            tool_input, result, ctx.deps.context.session_id, duration_ms,
        )
    except Exception:
        pass

    return result


async def get_billing_stats(
    ctx: RunContext[AgentDeps],
    month: int | None = None,
    year: int | None = None,
) -> dict:
    """Retourne les statistiques de facturation pour un mois donné.

    Args:
        month: Mois (1-12). Défaut : mois courant.
        year: Année (ex: 2026). Défaut : année courante.
    """
    logger.info("[AGENT TOOL] get_billing_stats appelé (month=%s, year=%s)", month, year)
    start = time.monotonic()
    today = datetime.date.today()
    month = month or today.month
    year = year or today.year
    tool_input = {"month": month, "year": year}
    cabinet_id = ctx.deps.context.cabinet_id
    try:
        invoices, total = await ctx.deps.invoice_repo.list_invoices(
            cabinet_id=cabinet_id,
            offset=0,
            limit=500,
        )

        # Filtrer par mois/année
        month_invoices = [
            inv for inv in invoices
            if inv.invoice_date
            and inv.invoice_date.month == month
            and inv.invoice_date.year == year
        ]

        total_amount = sum(float(inv.total_amount or 0) for inv in month_invoices)
        paid_amount = sum(
            float(inv.payment_amount or inv.total_amount or 0)
            for inv in month_invoices
            if inv.status == "paid"
        )
        count_by_status: dict[str, int] = {}
        for inv in month_invoices:
            count_by_status[inv.status] = count_by_status.get(inv.status, 0) + 1

        result = {
            "month": month,
            "year": year,
            "total_invoices": len(month_invoices),
            "total_amount": round(total_amount, 2),
            "paid_amount": round(paid_amount, 2),
            "pending_amount": round(total_amount - paid_amount, 2),
            "by_status": count_by_status,
        }
    except Exception as exc:
        logger.warning("Erreur get_billing_stats", exc_info=True)
        result = {"error": f"Erreur statistiques facturation : {type(exc).__name__}: {exc}"}

    duration_ms = int((time.monotonic() - start) * 1000)
    try:
        await log_tool_call(
            ctx.deps.db, ctx.deps.context, "get_billing_stats",
            tool_input, result, ctx.deps.context.session_id, duration_ms,
        )
    except Exception:
        pass

    return result


# ── Outil actif : cotation NGAP (Iter B) ─────────────────────────────────────


async def analyser_et_coter(
    ctx: RunContext[AgentDeps],
    description_libre: str,
    patient_id: str,
    datetime_soin: str | None = None,
) -> dict:
    """Analyse une description libre de soins et calcule la cotation NGAP automatique.

    Extrait les actes, la distance et l'horaire depuis le texte en langage naturel,
    puis appelle le moteur de cotation pour produire les lignes de facturation.
    Si la cotation réussit, propose une action de création de brouillon de facture.

    Args:
        description_libre: Description en langage naturel.
                           Ex: "pansement complexe escarre sacrum, 12km, 7h30"
        patient_id: UUID du patient (str).
        datetime_soin: Date/heure ISO 8601 optionnelle (déduite du texte si absent).
    """
    logger.info("[AGENT TOOL] analyser_et_coter appelé (patient=%s)", patient_id)
    start = time.monotonic()
    tool_input = {
        "description_libre": description_libre,
        "patient_id": patient_id,
        "datetime_soin": datetime_soin,
    }
    cabinet_id = ctx.deps.context.cabinet_id
    user_id = ctx.deps.context.user_id

    # Validation UUID patient
    try:
        patient_uuid = UUID(patient_id)
    except ValueError:
        result: dict = {"error": f"UUID patient invalide : {patient_id}"}
        duration_ms = int((time.monotonic() - start) * 1000)
        try:
            await log_tool_call(
                ctx.deps.db, ctx.deps.context, "analyser_et_coter",
                tool_input, result, ctx.deps.context.session_id, duration_ms,
            )
        except Exception:
            pass
        return result

    # Extraction depuis la description
    actes = _extract_actes(description_libre)
    distance_km = _extract_distance_km(description_libre)

    # Construction date/heure
    if datetime_soin:
        date_heure_str = datetime_soin
    else:
        now = datetime.datetime.now()
        heure = _extract_heure(description_libre)
        if heure:
            now = now.replace(hour=heure[0], minute=heure[1], second=0, microsecond=0)
        date_heure_str = now.isoformat()

    try:
        use_case = SimulateCotationUseCase(
            patient_repo=ctx.deps.patient_repo,
            catalog_repo=ctx.deps.care_catalog_repo,
        )
        dto = SimulateCotationDTO(
            patient_id=patient_uuid,
            idel_id=user_id,
            actes=actes,
            date_heure_soin=date_heure_str,
            distance_km=distance_km,
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            bsi_already_billed_today=False,
        )
        cotation = await use_case.execute(cabinet_id=cabinet_id, dto=dto)

        lignes = [
            {
                "code": l.code,
                "label": l.label,
                "montant": float(l.montant),
                "quantity": float(l.quantity),
            }
            for l in cotation.lignes
        ]
        total = float(cotation.total)
        codes_str = " + ".join(
            f"{l['code']} (×{l['quantity']:.0f})" if l["quantity"] != 1 else l["code"]
            for l in lignes
            if l["montant"] > 0
        )
        label_confirmation = f"Créer brouillon — {codes_str} — {total:.2f} €"

        result = {
            "actes_detectes": actes,
            "distance_km": float(distance_km),
            "date_heure": date_heure_str,
            "lignes": lignes,
            "total": total,
            "explications": cotation.explications,
            "auto_corrections": cotation.auto_corrections,
            "action_pending": {
                "action_type": "create_invoice_draft",
                "label": label_confirmation,
                "data": {
                    "patient_id": str(patient_uuid),
                    "care_lines": [
                        {"code": l["code"], "label": l["label"], "montant": l["montant"]}
                        for l in lignes
                    ],
                    "total_amount": total,
                    "date_heure": date_heure_str,
                },
            },
        }

        # Ajouter aux pending_tool_results (lu par l'orchestrateur après le stream)
        ctx.deps.pending_tool_results.append({
            "tool_name": "analyser_et_coter",
            "data": result,
        })

    except ValueError as exc:
        result = {"error": str(exc)}
    except Exception as exc:
        logger.warning("Erreur analyser_et_coter", exc_info=True)
        result = {"error": f"Erreur cotation : {type(exc).__name__}: {exc}"}

    duration_ms = int((time.monotonic() - start) * 1000)
    try:
        await log_tool_call(
            ctx.deps.db, ctx.deps.context, "analyser_et_coter",
            tool_input, result, ctx.deps.context.session_id, duration_ms,
        )
    except Exception:
        pass

    return result
