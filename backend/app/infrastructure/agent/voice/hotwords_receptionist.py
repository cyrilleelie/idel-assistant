"""Vocabulaire patient pour la reconnaissance vocale du secrétaire médical.

Distinct de hotwords.py (vocabulaire NGAP technique pour IDEL).
Ici : termes utilisés par les patients au téléphone.
"""

WHISPER_RECEPTIONIST_PROMPT = (
    "Transcription d'un appel téléphonique entre un patient et le secrétaire "
    "d'un cabinet d'infirmières libérales en France. Vocabulaire courant : "
    "rendez-vous, infirmière, piqûre, prise de sang, pansement, "
    "tension, glycémie, insuline, médicament, ordonnance, "
    "docteur, médecin, pharmacie, hôpital, urgence, "
    "douleur, mal, fièvre, chute, malaise, vertige, "
    "stomie, sonde, perfusion, poche, drain, "
    "matin, après-midi, lundi, mardi, mercredi, jeudi, vendredi, samedi, "
    "annuler, reporter, déplacer, confirmer, "
    "cabinet, domicile, maison, adresse, "
    "monsieur, madame, bonjour, merci, au revoir."
)

RECEPTIONIST_HOTWORDS: list[str] = [
    # Demandes RDV
    "rendez-vous", "RDV", "créneau", "horaire", "disponibilité",
    "prendre rendez-vous", "annuler", "reporter", "déplacer", "modifier",
    "confirmer", "rappeler",
    # Soins courants (vocabulaire patient)
    "piqûre", "injection", "prise de sang", "pansement",
    "tension", "glycémie", "insuline", "perfusion",
    "sonde", "stomie", "poche", "bas de contention",
    "toilette", "soins", "nursing",
    # Urgences
    "urgence", "urgent", "douleur", "mal", "très mal",
    "chute", "tombé", "tombée", "malaise", "vertige",
    "fièvre", "température", "saigne", "hémorragie",
    "essoufflé", "respire mal", "étouffé",
    "inconscient", "ne répond plus", "SAMU", "15",
    # Temporalité
    "aujourd'hui", "demain", "après-demain",
    "matin", "après-midi", "soir",
    "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi",
    "semaine prochaine", "la semaine prochaine",
    # Personnes
    "infirmière", "infirmier", "docteur", "médecin",
    "monsieur", "madame", "mon mari", "ma femme",
    "mon père", "ma mère", "mon fils", "ma fille",
    # Administratif
    "ordonnance", "prescription", "renouvellement",
    "mutuelle", "carte vitale", "tiers payant",
    "cabinet", "domicile", "maison", "adresse",
]
