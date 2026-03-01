"""Terminologie médicale NGAP pour orienter la reconnaissance vocale Whisper.

Whisper utilise un paramètre `prompt` initial pour s'orienter vers un vocabulaire
spécifique — plus efficace que les hotwords formels pour ce modèle.

Usage :
    from app.infrastructure.agent.voice.hotwords import WHISPER_MEDICAL_PROMPT

    response = await client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        prompt=WHISPER_MEDICAL_PROMPT,
        ...
    )
"""

# Prompt de contexte envoyé à Whisper pour orienter la reconnaissance
WHISPER_MEDICAL_PROMPT = (
    "Transcription d'une infirmière libérale française. Vocabulaire médical courant : "
    "AMI, AIS, BSI, BSA, BSB, BSC, IFD, IFI, AMX, MAU, MCI, MAD, IK, NGAP, "
    "pansement, injection, insuline, glycémie, escarre, perfusion, sonde, "
    "sonde urinaire, cathéter, stomie, trachéotomie, aspiration, aérosol, "
    "prise de sang, prélèvement, hémoculture, INR, anticoagulant, "
    "tension artérielle, pouls, saturation, SpO2, température, apyrétique, "
    "algique, douleur, EVA, constipation, diarrhée, oedème, "
    "Alzheimer, diabète, insuffisance cardiaque, AVC, cancer, "
    "ordonnance, prescription, renouvellement, BSI, GIR, AGGIR, "
    "cabinet, tournée, visite, patient, domicile."
)

# Termes spécifiques NGAP (référence pour les outils de traitement texte)
NGAP_HOTWORDS: list[str] = [
    # Nomenclature AMI
    "AMI 1", "AMI 2", "AMI 3", "AMI 4",
    # Nomenclature AMX (BSI)
    "AMX 1", "AMX 2", "AMX 3", "AMX 4", "AMX 6", "AMX 8",
    # Nomenclature AIS
    "AIS 1", "AIS 2", "AIS 3", "AIS 4",
    # Bilans et évaluations
    "BSA", "BSB", "BSC", "BSI",
    # Majorations et indemnités
    "IFD", "IFI", "MAU", "MCI", "MAD", "MSO", "MN", "MD",
    "IK", "NGAP",
    # Actes courants
    "pansement simple", "pansement complexe", "pansement lourd",
    "injection insuline", "injection sous-cutanée", "injection intramusculaire",
    "glycémie capillaire", "prise de sang", "prélèvement veineux",
    "perfusion", "sonde urinaire", "pose sonde", "ablation sonde",
    "aspiration bronchique", "aérosolthérapie", "nébulisation",
    "stomie", "poche stomie", "trachéotomie",
    "cicatrisation", "drainage", "fistule", "gastrostomie",
    "cathéter", "cathéter central", "ablation fils", "ablation agrafes",
    "éducation thérapeutique", "bilan infirmier",
    # Constantes vitales
    "tension artérielle", "pouls", "fréquence cardiaque",
    "saturation", "SpO2", "température", "glycémie",
    "poids", "diurèse", "saturation en oxygène",
    # Termes administratifs IDEL
    "ordonnance", "renouvellement", "BSI actif", "GIR",
    "tiers payant", "feuille de soins", "télétransmission",
    "acte non programmé", "urgence", "nuit profonde",
    # Pathologies fréquentes
    "diabète", "insuffisance cardiaque", "AVC", "Alzheimer",
    "escarre", "plaie chronique", "ulcère", "cancer",
    "anticoagulant", "Xarelto", "Eliquis", "Kardégic",
]
