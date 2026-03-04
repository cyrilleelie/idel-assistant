#!/usr/bin/env python3
"""Pont audio Asterisk ↔ FastAPI WebSocket (script AGI).

Ce script est exécuté par Asterisk via AGI (Asterisk Gateway Interface).
Il établit une connexion WebSocket vers le backend FastAPI et fait transiter
l'audio bidirectionnellement :
  - Asterisk → WebSocket : audio PCM du canal SIP (appel entrant)
  - WebSocket → Asterisk : audio TTS de l'agent IA

Protocole WebSocket :
  - Binaire (bytes) : frames audio PCM 16-bit mono 16kHz
  - JSON : messages de contrôle (hangup, metadata)

Configuration (variables d'environnement) :
  RECEPTIONIST_WS_URL   — URL du WebSocket backend (ex: ws://10.0.0.1:8000/api/v1/receptionist/call)
  CABINET_SERVICE_TOKEN  — Bearer token pour l'authentification service
  AUDIO_FORMAT           — Format audio (défaut: slin16 = PCM 16-bit 16kHz)

Usage dans extensions.conf :
  [receptionist]
  exten => s,1,Answer()
  same => n,AGI(receptionist_bridge.py)
  same => n,Hangup()
"""

import asyncio
import json
import logging
import os
import signal
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s [AGI] %(message)s")
logger = logging.getLogger("receptionist_bridge")

WS_URL = os.environ.get(
    "RECEPTIONIST_WS_URL", "ws://127.0.0.1:8000/api/v1/receptionist/call"
)
SERVICE_TOKEN = os.environ.get("CABINET_SERVICE_TOKEN", "")
CHUNK_SIZE = 640  # 20ms @ 16kHz, 16-bit mono = 640 bytes


class AGIInterface:
    """Interface simplifiée pour le protocole AGI Asterisk."""

    def __init__(self, stdin=sys.stdin, stdout=sys.stdout):
        self._in = stdin
        self._out = stdout
        self.env: dict[str, str] = {}

    def read_env(self) -> None:
        """Lit les variables d'environnement AGI au démarrage."""
        for line in self._in:
            line = line.strip()
            if not line:
                break
            if ": " in line:
                key, value = line.split(": ", 1)
                self.env[key] = value

    def send_command(self, cmd: str) -> str:
        """Envoie une commande AGI et retourne la réponse."""
        self._out.write(f"{cmd}\n")
        self._out.flush()
        return self._in.readline().strip()

    def set_variable(self, name: str, value: str) -> None:
        self.send_command(f'SET VARIABLE {name} "{value}"')

    def verbose(self, message: str, level: int = 1) -> None:
        self.send_command(f'VERBOSE "{message}" {level}')


async def bridge_call(agi: AGIInterface) -> None:
    """Pont audio principal : Asterisk ↔ WebSocket."""
    try:
        import websockets
    except ImportError:
        logger.error("websockets not installed — pip install websockets")
        return

    caller_id = agi.env.get("agi_callerid", "unknown")
    logger.info("Appel entrant de %s", caller_id)

    headers = {
        "Authorization": f"Bearer {SERVICE_TOKEN}",
        "X-Caller-Id": caller_id,
    }

    try:
        async with websockets.connect(WS_URL, additional_headers=headers) as ws:
            agi.verbose(f"Connexion WS établie pour {caller_id}")
            stop = asyncio.Event()

            async def recv_audio() -> None:
                """Reçoit l'audio TTS du backend et l'envoie vers Asterisk."""
                try:
                    async for message in ws:
                        if isinstance(message, bytes):
                            # Audio PCM → écrire sur stdout (canal Asterisk)
                            sys.stdout.buffer.write(message)
                            sys.stdout.buffer.flush()
                        else:
                            data = json.loads(message)
                            if data.get("type") == "hangup":
                                logger.info("Hangup reçu du backend")
                                stop.set()
                                return
                except Exception as exc:
                    logger.error("Erreur recv: %s", exc)
                    stop.set()

            async def send_audio() -> None:
                """Lit l'audio du canal Asterisk et l'envoie vers le backend."""
                try:
                    loop = asyncio.get_event_loop()
                    while not stop.is_set():
                        chunk = await loop.run_in_executor(
                            None, sys.stdin.buffer.read, CHUNK_SIZE
                        )
                        if not chunk:
                            break
                        await ws.send(chunk)
                except Exception as exc:
                    logger.error("Erreur send: %s", exc)
                    stop.set()

            await asyncio.gather(recv_audio(), send_audio())

    except Exception as exc:
        logger.error("Erreur connexion WS: %s", exc)
        agi.verbose(f"Erreur WS: {exc}")


def main() -> None:
    agi = AGIInterface()
    agi.read_env()
    agi.verbose("Démarrage du pont secrétaire IA")

    def handle_signal(signum, frame):
        logger.info("Signal %s reçu, arrêt", signum)
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGHUP, handle_signal)

    asyncio.run(bridge_call(agi))
    agi.verbose("Fin du pont secrétaire IA")


if __name__ == "__main__":
    main()
