"""Token blacklist service backed by Redis.

Allows revoking JWT tokens on logout. Blacklisted token IDs (jti) are stored
with a TTL matching the token's remaining lifetime so they auto-expire.
"""

import redis.asyncio as redis

from app.config import settings

_redis_client: redis.Redis | None = None

# Key prefix to namespace blacklist entries
_PREFIX = "token_blacklist:"


async def get_redis() -> redis.Redis:
    """Lazy-init and return the async Redis client."""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.redis_url, decode_responses=True
        )
    return _redis_client


async def blacklist_token(jti: str, ttl_seconds: int) -> None:
    """Add a token's jti to the blacklist with a TTL.

    Args:
        jti: The unique token identifier (JWT "jti" claim).
        ttl_seconds: Time-to-live in seconds (remaining token lifetime).
    """
    r = await get_redis()
    await r.setex(f"{_PREFIX}{jti}", ttl_seconds, "1")


async def is_token_blacklisted(jti: str) -> bool:
    """Check whether a token has been revoked."""
    r = await get_redis()
    result = await r.get(f"{_PREFIX}{jti}")
    return result is not None


async def close_redis() -> None:
    """Close the Redis connection (call on app shutdown)."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
