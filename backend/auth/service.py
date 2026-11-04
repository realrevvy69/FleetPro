"""MongoDB-backed user, session, bootstrap, and login-rate-limit services."""

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import logging
import secrets
import uuid

from pymongo.errors import DuplicateKeyError

from .config import AuthSettings
from .schemas import UserRole
from .security import (
    dummy_password_hash,
    hash_password,
    hash_session_id,
    needs_rehash,
    verify_password,
)

logger = logging.getLogger(__name__)


class AuthError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


class AuthService:
    def __init__(self, database, settings: AuthSettings, now=None):
        self.users = database["users"]
        self.sessions = database["sessions"]
        self.login_limits = database["auth_login_limits"]
        self.bootstrap_state = database["auth_bootstrap"]
        self.settings = settings
        self._now = now or (lambda: datetime.now(timezone.utc))
        self._indexes_ready = False

    async def ensure_indexes(self) -> None:
        if self._indexes_ready:
            return
        await self.users.create_index(
            "username", unique=True, name="uniq_auth_username"
        )
        await self.sessions.create_index(
            "expires_at", expireAfterSeconds=0, name="ttl_auth_sessions"
        )
        await self.login_limits.create_index(
            "expires_at", expireAfterSeconds=0, name="ttl_auth_login_limits"
        )
        self._indexes_ready = True

    async def bootstrap_admin(
        self, username: str, password: str, supplied_secret: str | None
    ) -> dict:
        await self.ensure_indexes()
        configured_secret = self.settings.bootstrap_secret
        if not configured_secret or len(configured_secret) < 32:
            raise AuthError(404, "Admin bootstrap is unavailable")
        if not supplied_secret or not hmac.compare_digest(
            supplied_secret.encode("utf-8"), configured_secret.encode("utf-8")
        ):
            raise AuthError(403, "Bootstrap authorization failed")

        if await self.bootstrap_state.find_one(
            {"_id": "initial_admin"}
        ) or await self.users.find_one(
            {"role": UserRole.ADMINISTRATOR.value}, {"_id": 1}
        ):
            raise AuthError(409, "Admin bootstrap has already been used")

        user_id = str(uuid.uuid4())
        user = {
            # The fixed key makes concurrent bootstrap calls atomic without
            # requiring multi-document transactions.
            "_id": "initial_admin",
            "id": user_id,
            "username": username,
            "password_hash": hash_password(password),
            "role": UserRole.ADMINISTRATOR.value,
            "disabled": False,
            "created_at": self._now(),
        }
        try:
            await self.users.insert_one(user)
        except DuplicateKeyError as exc:
            raise AuthError(
                409, "Admin bootstrap has already been used"
            ) from exc

        try:
            await self.bootstrap_state.insert_one(
                {
                    "_id": "initial_admin",
                    "user_id": user_id,
                    "used_at": self._now(),
                }
            )
        except DuplicateKeyError:
            # The administrator record itself permanently consumes bootstrap.
            pass

        logger.info("Initial administrator account created")
        return user

    async def _consume_login_bucket(
        self, kind: str, identity: str, now: datetime
    ) -> int:
        window = int(now.timestamp()) // self.settings.login_window_seconds
        digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()
        bucket_id = f"{kind}:{window}:{digest}"
        expires_at = datetime.fromtimestamp(
            (window + 1) * self.settings.login_window_seconds + 120,
            tz=timezone.utc,
        )
        try:
            await self.login_limits.update_one(
                {"_id": bucket_id},
                {
                    "$inc": {"attempts": 1},
                    "$setOnInsert": {"expires_at": expires_at},
                },
                upsert=True,
            )
        except DuplicateKeyError:
            # A parallel first request created the fixed-window bucket.
            await self.login_limits.update_one(
                {"_id": bucket_id}, {"$inc": {"attempts": 1}}, upsert=False
            )
        record = await self.login_limits.find_one(
            {"_id": bucket_id}, {"attempts": 1}
        )
        return int(record["attempts"])

    async def login(
        self, username: str, password: str, client_ip: str | None
    ) -> tuple[str, str, dict]:
        await self.ensure_indexes()
        now = self._now()
        client_ip = client_ip or "unknown-client"
        username_attempts = await self._consume_login_bucket(
            "username", username, now
        )
        ip_attempts = await self._consume_login_bucket("ip", client_ip, now)
        if (
            username_attempts > self.settings.username_attempt_limit
            or ip_attempts > self.settings.ip_attempt_limit
        ):
            logger.warning("Authentication rate limit exceeded")
            raise AuthError(429, "Too many login attempts")

        user = await self.users.find_one({"username": username})
        encoded_hash = user["password_hash"] if user else dummy_password_hash()
        password_valid = verify_password(password, encoded_hash)
        if not user or user.get("disabled") or not password_valid:
            raise AuthError(401, "Invalid username or password")

        if needs_rehash(encoded_hash):
            await self.users.update_one(
                {"id": user["id"]},
                {"$set": {"password_hash": hash_password(password)}},
            )

        # Reset only the account bucket after successful authentication. The IP
        # bucket remains to constrain attempts across many account names.
        window = int(now.timestamp()) // self.settings.login_window_seconds
        account_digest = hashlib.sha256(username.encode("utf-8")).hexdigest()
        await self.login_limits.delete_one(
            {"_id": f"username:{window}:{account_digest}"}
        )

        session_id = secrets.token_urlsafe(32)
        csrf_token = secrets.token_urlsafe(32)
        await self.sessions.insert_one(
            {
                "_id": hash_session_id(session_id),
                "user_id": user["id"],
                # Synchronizer tokens protect cookie-authenticated writes; they
                # do not grant a session on their own.
                "csrf_token": csrf_token,
                "created_at": now,
                "expires_at": now
                + timedelta(seconds=self.settings.session_ttl_seconds),
            }
        )
        return session_id, csrf_token, user

    async def current_user(
        self, session_id: str | None
    ) -> tuple[dict, dict] | None:
        await self.ensure_indexes()
        if not session_id:
            return None
        session = await self.sessions.find_one(
            {
                "_id": hash_session_id(session_id),
                "expires_at": {"$gt": self._now()},
            }
        )
        if not session:
            return None
        user = await self.users.find_one({"id": session["user_id"]})
        if not user or user.get("disabled"):
            await self.sessions.delete_one({"_id": session["_id"]})
            return None
        return user, session

    async def logout(
        self, session_id: str | None, csrf_token: str | None
    ) -> None:
        await self.ensure_indexes()
        if not session_id:
            return
        session_hash = hash_session_id(session_id)
        session = await self.sessions.find_one({"_id": session_hash})
        if not session:
            return
        expires_at = session.get("expires_at")
        now = self._now()
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        if expires_at and expires_at <= now:
            await self.sessions.delete_one({"_id": session_hash})
            return
        if not csrf_token or not hmac.compare_digest(
            session["csrf_token"], csrf_token
        ):
            raise AuthError(403, "CSRF validation failed")
        await self.sessions.delete_one({"_id": session_hash})
