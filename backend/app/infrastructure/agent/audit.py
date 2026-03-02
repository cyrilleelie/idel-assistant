"""Service d'audit immuable des appels outils agent IA.

Chaque appel d'outil est enregistré dans agent_audit_log.
La table est immuable (REVOKE UPDATE/DELETE), conformément aux exigences HDS.
"""

import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.agent.context import AgentContext


async def log_tool_call(
    db: AsyncSession,
    context: AgentContext,
    tool_name: str,
    tool_input: dict,
    tool_output: dict,
    llm_model: str,
    duration_ms: int,
) -> None:
    """Insère une entrée d'audit pour un appel d'outil.

    Utilise un SAVEPOINT (begin_nested) pour ne PAS commiter la transaction
    principale — un commit perdrait le set_config RLS et casserait les outils
    appelés ensuite dans la même requête ou les messages WebSocket suivants.
    """
    async with db.begin_nested():
        await db.execute(
            text(
                """
                INSERT INTO agent_audit_log
                    (id, cabinet_id, user_id, session_id, tool_name,
                     tool_input, tool_output, llm_model, duration_ms, created_at)
                VALUES
                    (:id, :cabinet_id, :user_id, :session_id, :tool_name,
                     :tool_input::jsonb, :tool_output::jsonb, :llm_model, :duration_ms, NOW())
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "cabinet_id": str(context.cabinet_id),
                "user_id": str(context.user_id),
                "session_id": context.session_id,
                "tool_name": tool_name,
                "tool_input": _serialize_json(tool_input),
                "tool_output": _serialize_json(tool_output),
                "llm_model": llm_model,
                "duration_ms": duration_ms,
            },
        )


def _serialize_json(data: dict) -> str:
    import json
    try:
        return json.dumps(data, default=str, ensure_ascii=False)
    except Exception:
        return "{}"
