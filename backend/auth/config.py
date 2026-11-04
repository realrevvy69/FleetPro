"""Environment-backed configuration for authentication."""

from dataclasses import dataclass
import os


@dataclass(frozen=True)
class AuthSettings:
    bootstrap_secret: str | None = None
    session_ttl_seconds: int = 8 * 60 * 60
    cookie_name: str = "fleetpro_session"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    login_window_seconds: int = 15 * 60
    username_attempt_limit: int = 5
    ip_attempt_limit: int = 30
    allowed_origins: tuple[str, ...] = ()
    cors_origins: tuple[str, ...] = ("*",)
    cors_allow_credentials: bool = False

    @classmethod
    def from_env(cls) -> "AuthSettings":
        environment = os.getenv(
            "ENVIRONMENT", os.getenv("APP_ENV", "development")
        )
        is_production = environment.strip().lower() in {"production", "prod"}
        secure_override = (
            os.getenv("SESSION_COOKIE_SECURE", "").strip().lower()
        )
        cookie_secure = is_production or secure_override in {
            "1",
            "true",
            "yes",
            "on",
        }

        ttl_raw = os.getenv("SESSION_TTL_SECONDS", str(8 * 60 * 60))
        try:
            session_ttl_seconds = int(ttl_raw)
        except ValueError as exc:
            raise ValueError("SESSION_TTL_SECONDS must be an integer") from exc
        if not 5 * 60 <= session_ttl_seconds <= 30 * 24 * 60 * 60:
            raise ValueError(
                "SESSION_TTL_SECONDS must be between 300 and 2592000"
            )

        cookie_samesite = (
            os.getenv("SESSION_COOKIE_SAMESITE", "lax").strip().lower()
        )
        if cookie_samesite not in {"lax", "strict"}:
            raise ValueError(
                "SESSION_COOKIE_SAMESITE must be 'lax' or 'strict'"
            )

        raw_cors_origins = os.getenv("CORS_ORIGINS", "*")
        cors_origins = tuple(
            origin.strip().rstrip("/")
            for origin in raw_cors_origins.split(",")
            if origin.strip()
        ) or ("*",)
        cors_allow_credentials = "*" not in cors_origins
        if is_production and not cors_allow_credentials:
            raise ValueError(
                "CORS_ORIGINS needs explicit production origins; wildcards "
                "cannot be used with credential cookies"
            )

        raw_origins = os.getenv("AUTH_ALLOWED_ORIGINS")
        if raw_origins is None:
            raw_origins = raw_cors_origins
        allowed_origins = tuple(
            origin.strip().rstrip("/").lower()
            for origin in raw_origins.split(",")
            if origin.strip() and origin.strip() != "*"
        )

        return cls(
            bootstrap_secret=os.getenv("AUTH_ADMIN_BOOTSTRAP_SECRET") or None,
            session_ttl_seconds=session_ttl_seconds,
            cookie_secure=cookie_secure,
            cookie_samesite=cookie_samesite,
            allowed_origins=allowed_origins,
            cors_origins=cors_origins,
            cors_allow_credentials=cors_allow_credentials,
        )
