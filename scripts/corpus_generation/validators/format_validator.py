"""Validateur de format ChatML pour les exemples d'entraînement.

Vérifie que la structure des messages est conforme au format
attendu par le fine-tuning Mistral (ChatML).
"""


class FormatValidator:
    """Valide le format ChatML des exemples d'entraînement."""

    VALID_ROLES = {"system", "user", "assistant", "tool"}

    def validate(self, example: dict) -> bool:
        """Vérifie qu'un exemple est au format ChatML valide.

        Contrôles :
        1. La clé 'messages' existe et est une liste non vide
        2. Chaque message a un 'role' valide
        3. Le premier message est un system prompt
        4. Il y a au moins un message user et un message assistant
        5. Les tool_calls sont bien formés
        6. Les messages tool ont un tool_call_id correspondant
        7. Les contenus ne sont pas vides (sauf assistant avec tool_calls)
        """
        messages = example.get("messages")
        if not messages or not isinstance(messages, list):
            return False

        if len(messages) < 2:
            return False

        # Premier message = system prompt
        if messages[0].get("role") != "system":
            return False

        if not messages[0].get("content"):
            return False

        has_user = False
        has_assistant = False
        tool_call_ids: set[str] = set()

        for i, msg in enumerate(messages):
            role = msg.get("role")
            if role not in self.VALID_ROLES:
                return False

            if role == "user":
                has_user = True
                if not msg.get("content"):
                    return False

            elif role == "assistant":
                has_assistant = True
                content = msg.get("content")
                tool_calls = msg.get("tool_calls")

                # Un assistant doit avoir soit du contenu soit des tool_calls
                if not content and not tool_calls:
                    return False

                # Valide les tool_calls si présents
                if tool_calls:
                    if not isinstance(tool_calls, list):
                        return False
                    for tc in tool_calls:
                        if not self._validate_tool_call(tc):
                            return False
                        tc_id = tc.get("id")
                        if tc_id:
                            tool_call_ids.add(tc_id)

            elif role == "tool":
                # Un message tool doit avoir un tool_call_id
                tc_id = msg.get("tool_call_id")
                if not tc_id:
                    return False
                # Le tool_call_id doit correspondre à un appel précédent
                if tc_id not in tool_call_ids:
                    return False
                # Le contenu peut être une string ou None
                if msg.get("content") is None and "content" not in msg:
                    return False

        return has_user and has_assistant

    def _validate_tool_call(self, tc: dict) -> bool:
        """Vérifie qu'un tool_call est bien formé."""
        if not isinstance(tc, dict):
            return False

        # Doit avoir un id
        if not tc.get("id"):
            return False

        # Doit avoir type: function
        if tc.get("type") != "function":
            return False

        # Doit avoir une function avec name
        func = tc.get("function")
        if not isinstance(func, dict):
            return False

        if not func.get("name"):
            return False

        # Arguments doivent être une string JSON ou un dict
        args = func.get("arguments")
        if args is not None and not isinstance(args, (str, dict)):
            return False

        return True
