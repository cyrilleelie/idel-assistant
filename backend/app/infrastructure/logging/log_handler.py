"""In-memory circular buffer log handler for application supervision."""

import logging
import threading
from collections import deque
from datetime import UTC, datetime
from typing import Any

_BUFFER_SIZE = 500


class LogEntry:
    """Single log entry stored in memory."""

    __slots__ = ("timestamp", "level", "logger", "message", "source")

    def __init__(
        self,
        timestamp: str,
        level: str,
        logger: str,
        message: str,
        source: str = "backend",
    ) -> None:
        self.timestamp = timestamp
        self.level = level
        self.logger = logger
        self.message = message
        self.source = source

    def to_dict(self) -> dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "level": self.level,
            "logger": self.logger,
            "message": self.message,
            "source": self.source,
        }


_LEVEL_ORDER: dict[str, int] = {
    "DEBUG": 0,
    "INFO": 1,
    "WARNING": 2,
    "ERROR": 3,
    "CRITICAL": 4,
}


class InMemoryLogHandler(logging.Handler):
    """Thread-safe in-memory circular buffer for recent log entries."""

    def __init__(self, maxsize: int = _BUFFER_SIZE) -> None:
        super().__init__()
        self._buffer: deque[LogEntry] = deque(maxlen=maxsize)
        self._lock = threading.Lock()

    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = record.getMessage()
            if record.exc_info:
                import traceback

                msg += "\n" + "".join(traceback.format_exception(*record.exc_info)).rstrip()
            entry = LogEntry(
                timestamp=datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
                level=record.levelname,
                logger=record.name,
                message=msg,
            )
            with self._lock:
                self._buffer.append(entry)
        except Exception:
            self.handleError(record)

    def get_entries(
        self,
        min_level: str | None = None,
        source_filter: str | None = None,
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        with self._lock:
            entries: list[LogEntry] = list(self._buffer)

        if min_level:
            min_val = _LEVEL_ORDER.get(min_level.upper(), 0)
            entries = [e for e in entries if _LEVEL_ORDER.get(e.level, 0) >= min_val]

        if source_filter and source_filter != "all":
            entries = [e for e in entries if e.source == source_filter]

        # Most recent first, limited
        recent = entries[-limit:] if len(entries) > limit else entries
        return [e.to_dict() for e in reversed(recent)]

    def add_frontend_entry(
        self,
        timestamp: str,
        level: str,
        logger: str,
        message: str,
    ) -> None:
        entry = LogEntry(
            timestamp=timestamp,
            level=level.upper(),
            logger=logger,
            message=message,
            source="frontend",
        )
        with self._lock:
            self._buffer.append(entry)

    def clear(self) -> None:
        with self._lock:
            self._buffer.clear()


# Module-level singleton
_handler: InMemoryLogHandler | None = None


def get_log_handler() -> InMemoryLogHandler:
    """Return the singleton in-memory log handler (created on first call)."""
    global _handler
    if _handler is None:
        _handler = InMemoryLogHandler()
    return _handler


def install_log_handler() -> None:
    """Install the in-memory handler on the root logger (idempotent)."""
    handler = get_log_handler()
    handler.setLevel(logging.DEBUG)

    root = logging.getLogger()
    # Idempotent: skip if already installed
    for h in root.handlers:
        if isinstance(h, InMemoryLogHandler):
            return

    root.addHandler(handler)
    # Capture INFO and above globally
    if root.level == logging.NOTSET or root.level > logging.INFO:
        root.setLevel(logging.INFO)
