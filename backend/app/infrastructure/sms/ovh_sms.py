"""Client SMS OVH pour les alertes urgentes du secrétaire médical IA.

Authentification HMAC-SHA1 selon l'API OVH :
https://api.ovh.com/g934.first_step_with_api

Usage :
    client = OVHSMSClient(app_key, app_secret, consumer_key, account)
    await client.send_urgent_alert("+33612345678", "Urgence : chute patient Mme Dupont")
"""

import hashlib
import logging
import time

import httpx

logger = logging.getLogger(__name__)

OVH_API_BASE = "https://eu.api.ovh.com/1.0"


class OVHSMSClient:
    """Client pour l'API SMS OVH avec authentification HMAC-SHA1."""

    def __init__(
        self,
        app_key: str,
        app_secret: str,
        consumer_key: str,
        account: str,
        sender: str = "Cabinet IDEL",
    ):
        self.app_key = app_key
        self.app_secret = app_secret
        self.consumer_key = consumer_key
        self.account = account
        self.sender = sender

    def build_auth_headers(
        self, method: str, url: str, body: str = "", timestamp: int | None = None
    ) -> dict[str, str]:
        """Construit les headers d'authentification OVH HMAC-SHA1."""
        ts = timestamp or int(time.time())
        to_sign = f"{self.app_secret}+{self.consumer_key}+{method}+{url}+{body}+{ts}"
        signature = "$1$" + hashlib.sha1(to_sign.encode()).hexdigest()
        return {
            "X-Ovh-Application": self.app_key,
            "X-Ovh-Consumer": self.consumer_key,
            "X-Ovh-Signature": signature,
            "X-Ovh-Timestamp": str(ts),
            "Content-Type": "application/json",
        }

    async def send_urgent_alert(self, to_number: str, message: str) -> bool:
        """Envoie un SMS urgent via l'API OVH.

        Args:
            to_number: Numéro de téléphone au format international (+33...).
            message: Texte du SMS (tronqué à 160 caractères).

        Returns:
            True si l'envoi a réussi.
        """
        truncated = message[:160]
        url = f"{OVH_API_BASE}/sms/{self.account}/jobs"
        body_dict = {
            "charset": "UTF-8",
            "class": "phoneDisplay",
            "coding": "7bit",
            "message": truncated,
            "noStopClause": True,
            "priority": "high",
            "receivers": [to_number],
            "sender": self.sender,
            "validityPeriod": 3600,
        }

        import json as json_mod
        body_str = json_mod.dumps(body_dict)
        headers = self.build_auth_headers("POST", url, body_str)

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, headers=headers, content=body_str)
                if resp.status_code == 200:
                    logger.info("SMS envoyé à %s (urgence)", to_number[:6] + "****")
                    return True
                logger.error("Échec envoi SMS : %s %s", resp.status_code, resp.text)
                return False
        except Exception as exc:
            logger.error("Erreur envoi SMS OVH : %s", exc)
            return False


async def send_urgent_sms(
    cabinet_id: str,
    caller_number: str,
    situation: str,
    db,
) -> bool:
    """Helper : envoie un SMS d'urgence à l'IDEL de garde.

    Trouve l'IDEL de garde via le planning du jour.
    Fallback : toutes les IDEL du cabinet.
    """
    from app.config import settings

    if not all([settings.ovh_sms_app_key, settings.ovh_sms_app_secret,
                settings.ovh_sms_consumer_key, settings.ovh_sms_account]):
        logger.warning("SMS OVH non configuré — alerte urgence ignorée")
        return False

    client = OVHSMSClient(
        app_key=settings.ovh_sms_app_key,
        app_secret=settings.ovh_sms_app_secret,
        consumer_key=settings.ovh_sms_consumer_key,
        account=settings.ovh_sms_account,
        sender=settings.ovh_sms_sender,
    )

    # Recherche IDEL de garde dans le planning du jour
    from sqlalchemy import select, and_
    from app.infrastructure.persistence.models.user_model import UserModel, CabinetMemberModel
    import datetime

    today = datetime.date.today()
    try:
        # Récupère les IDEL du cabinet avec numéro de téléphone
        stmt = (
            select(UserModel.phone, UserModel.first_name, UserModel.last_name)
            .join(CabinetMemberModel, CabinetMemberModel.user_id == UserModel.id)
            .where(
                and_(
                    CabinetMemberModel.cabinet_id == cabinet_id,
                    UserModel.phone.isnot(None),
                    UserModel.is_active.is_(True),
                )
            )
        )
        result = await db.execute(stmt)
        idels = result.all()

        if not idels:
            logger.error("Aucune IDEL trouvée pour le cabinet %s", cabinet_id)
            return False

        # Envoie à la première IDEL trouvée (TODO: logique de garde)
        phone, first_name, _ = idels[0]
        message = (
            f"URGENCE Cabinet: {situation}. "
            f"Appelant: {caller_number[:6]}****. "
            f"Rappeler immédiatement."
        )
        return await client.send_urgent_alert(phone, message)

    except Exception as exc:
        logger.error("Erreur recherche IDEL de garde : %s", exc)
        return False
