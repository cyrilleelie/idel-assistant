import datetime
from uuid import UUID, uuid4

from jose import JWTError, jwt

from app.config import settings

ALGORITHM = "HS256"


class TokenError(Exception):
    """Raised when a token is invalid or expired."""


def create_access_token(
    user_id: UUID,
    cabinet_id: UUID,
    role: str,
    expires_minutes: int | None = None,
) -> str:
    """Cree un access token JWT avec user_id, cabinet_id et role."""
    if expires_minutes is None:
        expires_minutes = settings.access_token_expire_minutes
    expire = datetime.datetime.now(datetime.UTC) + datetime.timedelta(
        minutes=expires_minutes
    )
    payload = {
        "sub": str(user_id),
        "cabinet_id": str(cabinet_id),
        "role": role,
        "type": "access",
        "jti": str(uuid4()),
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def create_refresh_token(
    user_id: UUID,
    expires_days: int | None = None,
) -> str:
    """Cree un refresh token JWT."""
    if expires_days is None:
        expires_days = settings.refresh_token_expire_days
    expire = datetime.datetime.now(datetime.UTC) + datetime.timedelta(
        days=expires_days
    )
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "jti": str(uuid4()),
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def verify_token(token: str) -> dict:
    """Verifie et decode un token JWT. Leve TokenError si invalide ou expire."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise TokenError(f"Token invalide: {e}")
