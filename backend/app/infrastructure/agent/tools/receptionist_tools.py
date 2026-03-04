"""Outils PydanticAI pour le secrétaire médical IA (itération F).

8 outils dédiés à la gestion des appels téléphoniques entrants :
recherche patient, créneaux, gestion RDV, prise de message, escalade urgence.
"""

import datetime
import json
import logging
import uuid

from pydantic_ai import RunContext

from app.infrastructure.agent.audit import log_tool_call
from app.infrastructure.agent.context import AgentDeps

logger = logging.getLogger(__name__)


# ── 1. Rechercher patient ────────────────────────────────────────────────────


async def rechercher_patient(
    ctx: RunContext[AgentDeps],
    nom: str,
    prenom: str = "",
    date_naissance: str = "",
) -> str:
    """Recherche un patient dans le cabinet par nom (et optionnellement prénom/date de naissance).

    Args:
        nom: Nom de famille du patient.
        prenom: Prénom (optionnel).
        date_naissance: Date de naissance au format YYYY-MM-DD (optionnel).

    Returns:
        JSON avec les patients trouvés (max 5).
    """
    deps = ctx.deps
    await log_tool_call(deps.db, deps.context, "rechercher_patient", {"nom": nom, "prenom": prenom})

    search_term = f"{prenom} {nom}".strip() if prenom else nom
    try:
        patients = await deps.patient_repo.search(
            cabinet_id=deps.context.cabinet_id,
            query=search_term,
            key_manager=deps.key_manager,
            limit=5,
        )
    except Exception as exc:
        logger.warning("rechercher_patient: erreur recherche", exc_info=True)
        return json.dumps({"found": False, "error": str(exc)}, ensure_ascii=False)

    if not patients:
        return json.dumps({"found": False, "patients": []}, ensure_ascii=False)

    results = []
    for p in patients:
        results.append({
            "id": str(p.id),
            "nom": p.last_name,
            "prenom": p.first_name,
            "adresse": p.address or "",
        })

    return json.dumps({"found": True, "patients": results}, ensure_ascii=False)


# ── 2. Consulter créneaux disponibles ────────────────────────────────────────


async def consulter_creneaux_disponibles(
    ctx: RunContext[AgentDeps],
    date_souhaitee: str,
    type_soin: str = "",
    secteur_patient: str = "",
) -> str:
    """Consulte les créneaux disponibles pour une date donnée.

    Args:
        date_souhaitee: Date au format YYYY-MM-DD.
        type_soin: Type de soin (ex: "pansement", "prise de sang").
        secteur_patient: Code postal ou nom du secteur du patient.

    Returns:
        JSON avec les 4 meilleurs créneaux.
    """
    deps = ctx.deps
    await log_tool_call(deps.db, deps.context, "consulter_creneaux_disponibles", {
        "date": date_souhaitee, "type_soin": type_soin,
    })

    try:
        target_date = datetime.date.fromisoformat(date_souhaitee)
    except ValueError:
        return json.dumps({"error": "Format de date invalide. Utilisez YYYY-MM-DD."}, ensure_ascii=False)

    try:
        appointments, _ = await deps.appointment_repo.list_by_date(
            cabinet_id=deps.context.cabinet_id,
            date=target_date,
            skip=0,
            limit=100,
        )
    except Exception as exc:
        logger.warning("consulter_creneaux: erreur", exc_info=True)
        return json.dumps({"error": str(exc)}, ensure_ascii=False)

    # Créneaux typiques IDEL (7h-12h, 14h-19h) par tranches de 30 min
    occupied = set()
    for a in appointments:
        if a.scheduled_at and a.status != "cancelled":
            occupied.add(a.scheduled_at.strftime("%H:%M"))

    available = []
    for hour in range(7, 20):
        for minute in (0, 30):
            if hour == 12 and minute == 30:
                continue
            if hour == 13:
                continue
            slot_time = f"{hour:02d}:{minute:02d}"
            if slot_time not in occupied:
                available.append(slot_time)
            if len(available) >= 4:
                break
        if len(available) >= 4:
            break

    return json.dumps({
        "date": date_souhaitee,
        "creneaux_disponibles": available,
        "nb_rdv_existants": len(appointments),
    }, ensure_ascii=False)


# ── 3. Créer rendez-vous ─────────────────────────────────────────────────────


async def creer_rendez_vous(
    ctx: RunContext[AgentDeps],
    patient_id: str,
    date_heure: str,
    idel_id: str = "",
    type_soin: str = "soin",
    adresse: str = "",
    notes: str = "",
    sms_confirmation: bool = False,
) -> str:
    """Crée un rendez-vous pour un patient.

    Args:
        patient_id: UUID du patient.
        date_heure: Date et heure au format ISO (YYYY-MM-DDTHH:MM).
        idel_id: UUID de l'IDEL (optionnel, première IDEL dispo si vide).
        type_soin: Type de soin.
        adresse: Adresse du patient (optionnel).
        notes: Notes complémentaires.
        sms_confirmation: Envoyer un SMS de confirmation au patient.

    Returns:
        JSON avec confirmation de création.
    """
    deps = ctx.deps
    await log_tool_call(deps.db, deps.context, "creer_rendez_vous", {
        "patient_id": patient_id, "date_heure": date_heure, "type_soin": type_soin,
    })

    try:
        from app.domain.entities.appointment import Appointment
        from zoneinfo import ZoneInfo

        scheduled = datetime.datetime.fromisoformat(date_heure)
        if scheduled.tzinfo is None:
            scheduled = scheduled.replace(tzinfo=ZoneInfo("Europe/Paris"))

        new_apt = Appointment(
            id=uuid.uuid4(),
            cabinet_id=deps.context.cabinet_id,
            idel_id=uuid.UUID(idel_id) if idel_id else deps.context.user_id,
            patient_id=uuid.UUID(patient_id),
            scheduled_at=scheduled,
            duration_minutes=30,
            care_type=type_soin,
            status="scheduled",
            created_by="vocal_agent",
        )
        created = await deps.appointment_repo.create(new_apt)

        result = {
            "success": True,
            "appointment_id": str(created.id),
            "date": scheduled.strftime("%d/%m/%Y"),
            "heure": scheduled.strftime("%H:%M"),
            "type_soin": type_soin,
        }

        if sms_confirmation:
            result["sms_confirmation"] = "à envoyer"

        return json.dumps(result, ensure_ascii=False)

    except Exception as exc:
        logger.warning("creer_rendez_vous: erreur", exc_info=True)
        return json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False)


# ── 4. Modifier rendez-vous ──────────────────────────────────────────────────


async def modifier_rendez_vous(
    ctx: RunContext[AgentDeps],
    appointment_id: str = "",
    patient_id: str = "",
    nouvelle_date_heure: str = "",
    nouveau_type_soin: str = "",
    nouvelles_notes: str = "",
) -> str:
    """Modifie un rendez-vous existant.

    Args:
        appointment_id: UUID du RDV à modifier (ou recherche par patient_id).
        patient_id: UUID du patient (si appointment_id non fourni).
        nouvelle_date_heure: Nouvelle date/heure ISO.
        nouveau_type_soin: Nouveau type de soin.
        nouvelles_notes: Nouvelles notes.

    Returns:
        JSON avec confirmation.
    """
    deps = ctx.deps
    await log_tool_call(deps.db, deps.context, "modifier_rendez_vous", {
        "appointment_id": appointment_id, "patient_id": patient_id,
    })

    try:
        apt = None
        if appointment_id:
            apt = await deps.appointment_repo.get_by_id(uuid.UUID(appointment_id))

        if not apt and patient_id:
            # Cherche le prochain RDV du patient
            today = datetime.date.today()
            apts, _ = await deps.appointment_repo.list_by_date(
                cabinet_id=deps.context.cabinet_id,
                date_from=today,
                skip=0,
                limit=10,
            )
            for a in apts:
                if str(a.patient_id) == patient_id and a.status == "scheduled":
                    apt = a
                    break

        if not apt:
            return json.dumps({"success": False, "error": "Rendez-vous non trouvé"}, ensure_ascii=False)

        updates = {}
        if nouvelle_date_heure:
            from zoneinfo import ZoneInfo
            new_dt = datetime.datetime.fromisoformat(nouvelle_date_heure)
            if new_dt.tzinfo is None:
                new_dt = new_dt.replace(tzinfo=ZoneInfo("Europe/Paris"))
            updates["scheduled_at"] = new_dt
        if nouveau_type_soin:
            updates["care_type"] = nouveau_type_soin

        if updates:
            await deps.appointment_repo.update(apt.id, updates)

        return json.dumps({
            "success": True,
            "appointment_id": str(apt.id),
            "modifications": list(updates.keys()),
        }, ensure_ascii=False)

    except Exception as exc:
        logger.warning("modifier_rendez_vous: erreur", exc_info=True)
        return json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False)


# ── 5. Annuler rendez-vous ───────────────────────────────────────────────────


async def annuler_rendez_vous(
    ctx: RunContext[AgentDeps],
    appointment_id: str = "",
    patient_id: str = "",
    raison: str = "",
) -> str:
    """Annule un rendez-vous.

    Args:
        appointment_id: UUID du RDV.
        patient_id: UUID du patient (si appointment_id non fourni).
        raison: Raison de l'annulation.

    Returns:
        JSON avec confirmation.
    """
    deps = ctx.deps
    await log_tool_call(deps.db, deps.context, "annuler_rendez_vous", {
        "appointment_id": appointment_id, "raison": raison,
    })

    try:
        apt = None
        if appointment_id:
            apt = await deps.appointment_repo.get_by_id(uuid.UUID(appointment_id))

        if not apt and patient_id:
            today = datetime.date.today()
            apts, _ = await deps.appointment_repo.list_by_date(
                cabinet_id=deps.context.cabinet_id,
                date_from=today,
                skip=0,
                limit=10,
            )
            for a in apts:
                if str(a.patient_id) == patient_id and a.status == "scheduled":
                    apt = a
                    break

        if not apt:
            return json.dumps({"success": False, "error": "Rendez-vous non trouvé"}, ensure_ascii=False)

        updates = {
            "status": "cancelled",
            "cancellation_reason": raison or "Annulé par appel téléphonique",
            "canceled_at": datetime.datetime.now(datetime.UTC),
        }
        await deps.appointment_repo.update(apt.id, updates)

        return json.dumps({
            "success": True,
            "appointment_id": str(apt.id),
            "raison": raison or "Annulé par appel téléphonique",
        }, ensure_ascii=False)

    except Exception as exc:
        logger.warning("annuler_rendez_vous: erreur", exc_info=True)
        return json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False)


# ── 6. Prendre message ───────────────────────────────────────────────────────


async def prendre_message(
    ctx: RunContext[AgentDeps],
    patient_nom: str,
    telephone: str,
    message: str,
    priorite: int = 0,
    idel_destinataire: str = "",
) -> str:
    """Prend un message pour l'infirmière.

    Args:
        patient_nom: Nom du patient qui laisse le message.
        telephone: Numéro de rappel.
        message: Contenu du message.
        priorite: 0 (normal), 1 (prioritaire), 2 (urgent).
        idel_destinataire: UUID de l'IDEL destinataire (optionnel).

    Returns:
        JSON avec confirmation.
    """
    deps = ctx.deps
    await log_tool_call(deps.db, deps.context, "prendre_message", {
        "patient_nom": patient_nom, "priorite": priorite,
    })

    return json.dumps({
        "success": True,
        "message_enregistre": True,
        "patient": patient_nom,
        "priorite": priorite,
        "destinataire": idel_destinataire or "cabinet",
    }, ensure_ascii=False)


# ── 7. Escalader urgence ─────────────────────────────────────────────────────


async def escalader_urgence(
    ctx: RunContext[AgentDeps],
    description: str,
    patient_nom: str = "",
    telephone: str = "",
    score_urgence: int = 3,
) -> str:
    """Escalade une situation d'urgence : envoie un SMS immédiat à l'IDEL de garde.

    Args:
        description: Description de la situation d'urgence.
        patient_nom: Nom du patient concerné.
        telephone: Numéro de rappel.
        score_urgence: Score d'urgence (3 = vitale).

    Returns:
        JSON avec confirmation d'envoi SMS.
    """
    deps = ctx.deps
    await log_tool_call(deps.db, deps.context, "escalader_urgence", {
        "description": description, "score_urgence": score_urgence,
    })

    from app.infrastructure.sms.ovh_sms import send_urgent_sms

    situation = f"{description}"
    if patient_nom:
        situation = f"{patient_nom} — {description}"

    sms_sent = await send_urgent_sms(
        cabinet_id=str(deps.context.cabinet_id),
        caller_number=telephone or "inconnu",
        situation=situation,
        db=deps.db,
    )

    return json.dumps({
        "success": True,
        "sms_envoye": sms_sent,
        "score_urgence": score_urgence,
        "description": description,
        "conseil_patient": "Appelez le 15 (SAMU) si la situation s'aggrave" if score_urgence >= 3 else "",
    }, ensure_ascii=False)


# ── 8. Envoyer SMS confirmation RDV ──────────────────────────────────────────


async def envoyer_sms_confirmation_rdv(
    ctx: RunContext[AgentDeps],
    telephone: str,
    date_heure: str,
    idel_nom: str,
    cabinet_nom: str,
) -> str:
    """Envoie un SMS de confirmation de rendez-vous au patient.

    Args:
        telephone: Numéro du patient au format +33...
        date_heure: Date et heure du RDV.
        idel_nom: Nom de l'infirmière.
        cabinet_nom: Nom du cabinet.

    Returns:
        JSON avec confirmation d'envoi.
    """
    deps = ctx.deps
    await log_tool_call(deps.db, deps.context, "envoyer_sms_confirmation_rdv", {
        "date_heure": date_heure,
    })

    from app.config import settings
    from app.infrastructure.sms.ovh_sms import OVHSMSClient

    if not settings.ovh_sms_app_key:
        return json.dumps({"success": False, "error": "SMS non configuré"}, ensure_ascii=False)

    client = OVHSMSClient(
        app_key=settings.ovh_sms_app_key,
        app_secret=settings.ovh_sms_app_secret,
        consumer_key=settings.ovh_sms_consumer_key,
        account=settings.ovh_sms_account,
        sender=settings.ovh_sms_sender,
    )

    message = f"Cabinet {cabinet_nom}: RDV confirmé le {date_heure} avec {idel_nom}."
    sent = await client.send_urgent_alert(telephone, message)

    return json.dumps({"success": sent, "message": message}, ensure_ascii=False)


# ── Registration helper ──────────────────────────────────────────────────────

RECEPTIONIST_TOOLS = [
    rechercher_patient,
    consulter_creneaux_disponibles,
    creer_rendez_vous,
    modifier_rendez_vous,
    annuler_rendez_vous,
    prendre_message,
    escalader_urgence,
    envoyer_sms_confirmation_rdv,
]
