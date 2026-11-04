"""Isolated tests for FleetPro's authentication foundation."""

import asyncio
from datetime import datetime, timedelta, timezone
import logging
import secrets
import uuid

from fastapi import FastAPI
import httpx
from mongomock_motor import AsyncMongoMockClient

from auth.config import AuthSettings
from auth.router import build_auth_router
from auth.security import hash_password, hash_session_id, verify_password
from auth.service import AuthService

BOOTSTRAP_SECRET = secrets.token_urlsafe(32)
ADMIN_PASSWORD = secrets.token_urlsafe(24)
BAD_PASSWORD = secrets.token_urlsafe(24)


def _run(coro):
    return asyncio.run(coro)


def _context(username_attempt_limit: int = 5):
    mongo = AsyncMongoMockClient()
    database = mongo[f"fleetpro_auth_test_{uuid.uuid4().hex}"]
    settings = AuthSettings(
        bootstrap_secret=BOOTSTRAP_SECRET,
        session_ttl_seconds=8 * 60 * 60,
        cookie_secure=True,
        cookie_samesite="lax",
        username_attempt_limit=username_attempt_limit,
        ip_attempt_limit=30,
    )
    service = AuthService(database, settings)
    app = FastAPI()
    app.include_router(build_auth_router(service), prefix="/api")
    _run(service.ensure_indexes())
    return mongo, database, service, app


async def _request(app, method, path, **kwargs):
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        cookies = kwargs.pop("cookies", None)
        if cookies:
            client.cookies.update(cookies)
        return await client.request(method, path, **kwargs)


def _bootstrap(app, secret=BOOTSTRAP_SECRET, password=ADMIN_PASSWORD):
    return _run(
        _request(
            app,
            "POST",
            "/api/auth/bootstrap",
            headers={"X-Admin-Bootstrap-Key": secret},
            json={"username": " fleetadmin ", "password": password},
        )
    )


def _login(app, username="fleetadmin", password=ADMIN_PASSWORD):
    return _run(
        _request(
            app,
            "POST",
            "/api/auth/login",
            json={"username": username, "password": password},
        )
    )


def test_argon2id_hashing_verifies_without_reusing_salt():
    encoded_a = hash_password(ADMIN_PASSWORD)
    encoded_b = hash_password(ADMIN_PASSWORD)

    assert encoded_a.startswith("$argon2id$")
    assert encoded_a != encoded_b
    assert verify_password(ADMIN_PASSWORD, encoded_a)
    assert not verify_password(secrets.token_urlsafe(24), encoded_a)


def test_production_cookie_is_secure_even_if_override_disables_it(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    monkeypatch.delenv("APP_ENV", raising=False)

    assert AuthSettings.from_env().cookie_secure is True


def test_admin_bootstrap_is_secured_and_one_time():
    mongo, _, _, app = _context()
    try:
        cross_site = _run(
            _request(
                app,
                "POST",
                "/api/auth/login",
                headers={"Origin": "https://untrusted.example"},
                json={"username": "fleetadmin", "password": ADMIN_PASSWORD},
            )
        )
        assert cross_site.status_code == 403

        bad_key = _bootstrap(app, secret=secrets.token_urlsafe(24))
        assert bad_key.status_code == 403

        first = _bootstrap(app)
        assert first.status_code == 201, first.text
        assert first.json()["user"]["role"] == "administrator"
        assert "password_hash" not in first.json()["user"]
        assert BOOTSTRAP_SECRET not in first.text

        second = _bootstrap(
            app, secret=BOOTSTRAP_SECRET, password=secrets.token_urlsafe(24)
        )
        assert second.status_code == 409
        assert (
            _run(_request(app, "POST", "/api/auth/register")).status_code
            == 404
        )
    finally:
        mongo.close()


def test_login_cookie_current_user_and_logout_revoke_session(caplog):
    mongo, database, _, app = _context()
    try:
        caplog.set_level(logging.INFO)
        assert _bootstrap(app).status_code == 201
        failed = _login(app, password=BAD_PASSWORD)
        assert failed.status_code == 401
        assert failed.json()["detail"] == "Invalid username or password"

        logged_in = _login(app)
        assert logged_in.status_code == 200
        assert logged_in.json()["user"]["username"] == "fleetadmin"
        cookie = logged_in.cookies.get("fleetpro_session")
        csrf = logged_in.json()["csrf_token"]
        assert cookie and csrf
        set_cookie = logged_in.headers["set-cookie"].lower()
        assert (
            "httponly" in set_cookie
            and "secure" in set_cookie
            and "samesite=lax" in set_cookie
        )
        assert "max-age=28800" in set_cookie

        stored_session = _run(
            database.sessions.find_one({"_id": hash_session_id(cookie)})
        )
        assert stored_session is not None
        assert cookie not in str(stored_session)
        assert "csrf_token" in stored_session

        me = _run(
            _request(
                app,
                "GET",
                "/api/auth/me",
                cookies={"fleetpro_session": cookie},
            )
        )
        assert me.status_code == 200
        assert me.json()["user"]["role"] == "administrator"
        assert me.json()["csrf_token"] == csrf

        rejected_logout = _run(
            _request(
                app,
                "POST",
                "/api/auth/logout",
                cookies={"fleetpro_session": cookie},
            )
        )
        assert rejected_logout.status_code == 403

        logged_out = _run(
            _request(
                app,
                "POST",
                "/api/auth/logout",
                cookies={"fleetpro_session": cookie},
                headers={"X-CSRF-Token": csrf},
            )
        )
        assert logged_out.status_code == 204
        assert (
            _run(
                _request(
                    app,
                    "GET",
                    "/api/auth/me",
                    cookies={"fleetpro_session": cookie},
                )
            ).status_code
            == 401
        )
        assert (
            _run(database.sessions.find_one({"_id": hash_session_id(cookie)}))
            is None
        )
        all_records = "\n".join(
            record.getMessage() for record in caplog.records
        )
        assert BOOTSTRAP_SECRET not in all_records
        assert ADMIN_PASSWORD not in all_records
        assert csrf not in all_records
        assert cookie not in all_records
    finally:
        mongo.close()


def test_expired_session_is_rejected_even_before_ttl_cleanup():
    mongo, database, _, app = _context()
    try:
        assert _bootstrap(app).status_code == 201
        logged_in = _login(app)
        cookie = logged_in.cookies.get("fleetpro_session")
        assert cookie
        _run(
            database.sessions.update_one(
                {"_id": hash_session_id(cookie)},
                {
                    "$set": {
                        "expires_at": datetime.now(timezone.utc)
                        - timedelta(seconds=1)
                    }
                },
            )
        )

        response = _run(
            _request(
                app,
                "GET",
                "/api/auth/me",
                cookies={"fleetpro_session": cookie},
            )
        )
        assert response.status_code == 401
    finally:
        mongo.close()


def test_login_throttling_and_auth_logs_do_not_contain_credentials(caplog):
    mongo, _, _, app = _context(username_attempt_limit=2)
    try:
        assert _bootstrap(app).status_code == 201
        caplog.set_level(logging.INFO)
        for _ in range(2):
            assert _login(app, password=BAD_PASSWORD).status_code == 401
        throttled = _login(app, password=BAD_PASSWORD)
        assert throttled.status_code == 429

        logged_in = _login(app)
        assert logged_in.status_code == 429
        all_records = "\n".join(
            record.getMessage() for record in caplog.records
        )
        assert BOOTSTRAP_SECRET not in all_records
        assert ADMIN_PASSWORD not in all_records
        assert BAD_PASSWORD not in all_records
    finally:
        mongo.close()
