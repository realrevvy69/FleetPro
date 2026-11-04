"""HTTP endpoints for the staged authentication foundation."""

from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    Request,
    Response,
)
from fastapi.responses import JSONResponse

from .csrf import build_csrf_dependency, verify_origin
from .schemas import (
    BootstrapCredentials,
    LoginCredentials,
    PasswordChange,
    public_user,
)
from .service import AuthError, AuthService


def _http_error(status_code: int, detail: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail=detail,
        headers={"Cache-Control": "no-store"},
    )


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
    csrf_dependency = build_csrf_dependency(service)

    @router.post("/bootstrap", status_code=201)
    async def bootstrap_admin(
        credentials: BootstrapCredentials,
        request: Request,
        response: Response,
        bootstrap_key: str | None = Header(
            default=None, alias="X-Admin-Bootstrap-Key"
        ),
    ):
        verify_origin(request, service)
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
        verify_origin(request, service)
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
        verify_origin(request, service)
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
    async def logout(
        request: Request,
        _auth_context: tuple[dict, dict] = Depends(csrf_dependency),
    ):
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

    @router.post("/rotate")
    async def rotate_session(
        request: Request,
        _auth_context: tuple[dict, dict] = Depends(csrf_dependency),
    ):
        try:
            session_id, csrf_token, user = await service.rotate_session(
                request.cookies.get(service.settings.cookie_name),
                request.headers.get("x-csrf-token"),
            )
        except AuthError as exc:
            raise _http_error(exc.status_code, exc.detail) from exc
        response = JSONResponse(
            {"user": public_user(user), "csrf_token": csrf_token},
            headers={"Cache-Control": "no-store"},
        )
        _set_session_cookie(response, session_id, service)
        return response

    @router.post("/password", status_code=204)
    async def change_password(
        password_change: PasswordChange,
        request: Request,
        auth_context: tuple[dict, dict] = Depends(csrf_dependency),
    ):
        user, _session = auth_context
        try:
            await service.change_password(
                user["id"],
                password_change.current_password,
                password_change.new_password,
            )
        except AuthError as exc:
            raise _http_error(exc.status_code, exc.detail) from exc
        response = Response(status_code=204)
        _clear_session_cookie(response, service)
        return response

    return router
