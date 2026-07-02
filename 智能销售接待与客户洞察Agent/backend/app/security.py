from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os

import jwt

from .config import get_settings


def hash_password(password: str, salt: str | None = None) -> str:
    real_salt = salt or os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), real_salt.encode("utf-8"), 120_000)
    return f"{real_salt}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    salt, expected = stored_hash.split("$", 1)
    actual = hash_password(password, salt).split("$", 1)[1]
    return hmac.compare_digest(actual, expected)


def create_access_token(user_id: int, role: str) -> str:
    settings = get_settings()
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=8),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, str]:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])

