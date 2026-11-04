"""Password and high-entropy token handling."""

import hashlib
import secrets

from argon2 import PasswordHasher, Type
from argon2.exceptions import VerificationError, VerifyMismatchError

_PASSWORD_HASHER = PasswordHasher(
    time_cost=3,
    memory_cost=64 * 1024,
    parallelism=4,
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)

# A fixed hash keeps unknown-user login attempts close in cost to known-user
# attempts without storing or logging a real credential.
_DUMMY_PASSWORD_HASH = _PASSWORD_HASHER.hash(secrets.token_urlsafe(32))


def hash_password(password: str) -> str:
    if not password or len(password) > 128:
        raise ValueError("Password must contain between 1 and 128 characters")
    return _PASSWORD_HASHER.hash(password)


def verify_password(password: str, encoded_hash: str) -> bool:
    try:
        return _PASSWORD_HASHER.verify(encoded_hash, password)
    except (VerificationError, VerifyMismatchError):
        return False


def needs_rehash(encoded_hash: str) -> bool:
    try:
        return _PASSWORD_HASHER.check_needs_rehash(encoded_hash)
    except VerificationError:
        return True


def dummy_password_hash() -> str:
    return _DUMMY_PASSWORD_HASH


def hash_session_id(session_id: str) -> str:
    """Return the SHA-256 digest of a random opaque session ID."""
    return hashlib.sha256(session_id.encode("utf-8")).hexdigest()
