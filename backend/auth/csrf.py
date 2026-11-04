"""Reusable Origin and CSRF checks for cookie-authenticated writes."""

import hmac
from typing import Callable

from fastapi import HTTPException, Request

from .service import AuthService


def _reject(status_code: int, detail: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail=detail,
        headers={"Cache-Control": "no-store"},
    )


def verify_origin(request: Request, service: AuthService) -> None:
    """Reject an explicitly supplied Origin unless it is exact and trusted."""
    origin = request.headers.get("origin")
    if not origin:
        return
    if origin == "null":
        raise _reject(403, "Origin is not allowed")

    normalized_origin = origin.rstrip("/").lower()
    allowed_origins = {
        value.rstrip("/").lower() for value in service.settings.allowed_origins
    }
    # Do not treat the request Host header as a trust anchor: clients can
    # supply it, so comparing Origin to request.url could bless a forged host.
    if normalized_origin not in allowed_origins:
        raise _reject(403, "Origin is not allowed")


async def require_csrf(
    request: Request, service: AuthService
) -> tuple[dict, dict]:
    """Validate Origin, the current cookie session, and its synchronizer token.

    Use this dependency for cookie-authenticated POST, PUT, PATCH, and DELETE
    routes. It returns the current user and session for routes that also need
    that context.
    """
    verify_origin(request, service)
    session_id = request.cookies.get(service.settings.cookie_name)
    result = await service.current_user(session_id)
    if not result:
        raise _reject(401, "Authentication required")

    user, session = result
    supplied_token = request.headers.get("x-csrf-token")
    if not supplied_token or not hmac.compare_digest(
        session["csrf_token"].encode("utf-8"), supplied_token.encode("utf-8")
    ):
        raise _reject(403, "CSRF validation failed")
    return user, session


def build_csrf_dependency(service: AuthService) -> Callable:
    """Bind an auth service for FastAPI write-route dependencies."""

    async def csrf_dependency(request: Request) -> tuple[dict, dict]:
        return await require_csrf(request, service)

    return csrf_dependency
