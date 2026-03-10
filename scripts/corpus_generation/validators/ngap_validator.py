"""Validateur de cohérence NGAP pour les exemples de cotation.

Vérifie que les exemples générés respectent les règles NGAP.
Un exemple invalide dans les données d'entraînement dégraderait
la qualité du modèle fine-tuné.
"""

import json
import re

from config import TARIFS_NGAP


class NGAPValidator:
    """Valide la cohérence des exemples de cotation NGAP."""

    # Codes d'actes NGAP reconnus (pattern)
    ACTES_PATTERN = re.compile(
        r"^(AMI|AMX|AIS)\s*[1-4]$|^(BSA|BSB|BSC)$|^(MAU|MCI|MAD|MSO)$|^(IFD|IFI)$|^IK"
    )

    # Majorations incompatibles entre elles
    MAJORATIONS_INCOMPATIBLES = [
        {"MAU", "MCI"},   # Ne se cumulent jamais
        {"MAU", "MAD"},   # MAD remplace MAU si nuit profonde
        {"MCI", "MAD"},   # MAD et MCI ne se cumulent pas non plus
    ]

    def validate(self, example: dict) -> bool:
        """Vérifie la cohérence d'un exemple de cotation.

        Contrôles :
        1. Format des tool_calls correct
        2. Les actes NGAP cités existent
        3. Les majorations incompatibles ne sont pas combinées
        4. Cohérence BSI (AMX au lieu de AMI)
        """
        messages = example.get("messages", [])

        for msg in messages:
            if msg.get("role") != "assistant":
                continue
            tool_calls = msg.get("tool_calls")
            if not tool_calls:
                continue

            for tc in tool_calls:
                func = tc.get("function", {})
                if func.get("name") != "analyser_et_coter":
                    continue

                args_str = func.get("arguments", "")
                if isinstance(args_str, str):
                    try:
                        json.loads(args_str)
                    except json.JSONDecodeError:
                        return False
                elif not isinstance(args_str, dict):
                    return False

                # Les arguments contiennent des descriptions en langage naturel,
                # pas des codes NGAP — on ne valide que le format JSON.
                # Les codes NGAP sont validés dans les résultats d'outils ci-dessous.

        # Vérifie aussi le résultat de l'outil (role: tool)
        for msg in messages:
            if msg.get("role") != "tool":
                continue
            content = msg.get("content", "")
            if isinstance(content, str):
                try:
                    result = json.loads(content)
                except json.JSONDecodeError:
                    continue
            elif isinstance(content, dict):
                result = content
            else:
                continue

            actes = self._extract_actes(result)
            if actes and not self._validate_actes(actes):
                return False

        return True

    def _extract_actes(self, data: dict) -> list[str]:
        """Extrait les codes d'actes depuis les arguments ou résultats."""
        actes = []

        def _append_if_str(value):
            if isinstance(value, str):
                actes.append(value)
            elif isinstance(value, list):
                for v in value:
                    _append_if_str(v)

        # Format possible : {"actes": ["AMI 4", "MAU"]} ou {"actes": [{"code": "AMI 4"}, ...]}
        if "actes" in data:
            raw = data["actes"]
            if isinstance(raw, list):
                for item in raw:
                    if isinstance(item, str):
                        actes.append(item)
                    elif isinstance(item, dict) and "code" in item:
                        _append_if_str(item["code"])
                    elif isinstance(item, list):
                        _append_if_str(item)
            elif isinstance(raw, str):
                actes.append(raw)

        # Format possible : {"lignes": [{"code": "AMI 4"}, ...]}
        if "lignes" in data:
            for ligne in data.get("lignes", []):
                if isinstance(ligne, dict) and "code" in ligne:
                    _append_if_str(ligne["code"])

        # Format possible : {"code_ngap": "AMI 4"}
        if "code_ngap" in data:
            _append_if_str(data["code_ngap"])

        return actes

    def _validate_actes(self, actes: list[str]) -> bool:
        """Vérifie les actes : existence et compatibilité des majorations."""
        majorations_presentes: set[str] = set()
        has_ami = False
        has_amx = False

        for acte in actes:
            acte = acte.strip()

            # IK est variable, on ne le valide pas en détail
            if acte.startswith("IK"):
                continue

            # Vérifie que l'acte existe dans la nomenclature
            if acte not in TARIFS_NGAP and not self.ACTES_PATTERN.match(acte):
                return False

            if acte in ("MAU", "MCI", "MAD"):
                majorations_presentes.add(acte)

            if acte.startswith("AMI"):
                has_ami = True
            if acte.startswith("AMX"):
                has_amx = True

        # Vérifie les incompatibilités de majorations
        for incompatible_set in self.MAJORATIONS_INCOMPATIBLES:
            if incompatible_set.issubset(majorations_presentes):
                return False

        # AMI et AMX ne devraient pas coexister (BSI remplace AMI par AMX)
        if has_ami and has_amx:
            return False

        return True
