"""HTTP endpoints for the staged authentication foundation."""

from fastapi import APIRouter, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse

from .schemas import BootstrapCredentials, LoginCredentials, public_user
from .service import AuthError, AuthService


def _http_error(status_code: int, detail: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail=detail,
        headers={"Cache-Control": "no-store"},
    )


def _check_origin(request: Request, service: AuthService) -> None:
    origin = request.headers.get("origin")
    if not origin:
        return
    if origin == "null":
        raise _http_error(403, "Origin is not allowed")
    request_origin = f"{request.url.scheme}://{request.url.netloc}".lower()
    allowed = {
        configured_origin.lower()
        for configured_origin in service.settings.allowed_origins
    }
    if (
        origin.rstrip("/").lower() not in allowed
        and origin.rstrip("/").lower() != request_origin
    ):
        raise _http_error(403, "Origin is not allowed")


def _set_session_cookie(
    response: Response, session_id: str, service: AuthService
) -> None:
    response.set_cookie(
        key=service.settings.cookie_name,
        value=session_id,
        max_age=service.settings.session_ttl_seconds,
        path="/",
        secure=service.settings.cookie_secure,
        httponly=True,
        samesite=service.settings.cookie_samesite,
    )
    response.headers["Cache-Control"] = "no-store"


def _clear_session_cookie(response: Response, service: AuthService) -> None:
    response.delete_cookie(
        key=service.settings.cookie_name,
        path="/",
        secure=service.settings.cookie_secure,
        httponly=True,
        samesite=service.settings.cookie_samesite,
    )
    response.headers["Cache-Control"] = "no-store"


def build_auth_router(service: AuthService) -> APIRouter:
    router = APIRouter(prefix="/auth", tags=["authentication"])

    @router.post("/bootstrap", status_code=201)
    async def bootstrap_admin(
        credentials: BootstrapCredentials,
        request: Request,
        response: Response,
        bootstrap_key: str | None = Header(
            default=None, alias="X-Admin-Bootstrap-Key"
        ),
    ):
        _check_origin(request, service)
        try:
            user = await service.bootstrap_admin(
                credentials.username, credentials.password, bootstrap_key
            )
        except AuthError as exc:
            raise _http_error(exc.status_code, exc.detail) from exc
        response.headers["Cache-Control"] = "no-store"
        return {"user": public_user(user)}

    @router.post("/login")
    async def login(credentials: LoginCredentials, request: Request):
        _check_origin(request, service)
        try:
            session_id, csrf_token, user = await service.login(
                credentials.username,
                credentials.password,
                request.client.host if request.client else None,
            )
        except AuthError as exc:
            raise _http_error(exc.status_code, exc.detail) from exc
        response = JSONResponse(
            {"user": public_user(user), "csrf_token": csrf_token},
            headers={"Cache-Control": "no-store"},
        )
        _set_session_cookie(response, session_id, service)
        return response

    @router.get("/me")
    async def current_user(request: Request):
        _check_origin(request, service)
        result = await service.current_user(
            request.cookies.get(service.settings.cookie_name)
        )
        if not result:
            raise _http_error(401, "Authentication required")
        user, session = result
        response = JSONResponse(
            {
                "user": public_user(user),
                "csrf_token": session["csrf_token"],
            },
            headers={"Cache-Control": "no-store"},
        )
        return response

    @router.post("/logout", status_code=204)
    async def logout(request: Request):
        _check_origin(request, service)
        try:
            await service.logout(
                request.cookies.get(service.settings.cookie_name),
                request.headers.get("x-csrf-token"),
            )
        except AuthError as exc:
            raise _http_error(exc.status_code, exc.detail) from exc
        response = Response(status_code=204)
        _clear_session_cookie(response, service)
        return response

    return router
