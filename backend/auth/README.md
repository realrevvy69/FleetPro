# Authentication foundation

The authentication endpoints are mounted at `/api/auth`. Existing business
routes remain available without a session in this stage.

## Configuration

- `AUTH_ADMIN_BOOTSTRAP_SECRET`: one-time initial administrator setup key. Use
  a randomly generated value of at least 32 characters, provide it through the
  deployment environment or secret manager, and remove it after bootstrap.
- `ENVIRONMENT=production`: sets the session cookie's `Secure` attribute.
- `SESSION_COOKIE_SECURE`: optional local override to turn `Secure` on. It
  cannot turn it off when `ENVIRONMENT=production`.
- `SESSION_TTL_SECONDS`: server-side session lifetime; defaults to eight hours
  and accepts values from five minutes to thirty days.
- `SESSION_COOKIE_SAMESITE`: `lax` by default; `strict` is also supported.
- `CORS_ORIGINS`: comma-separated exact frontend origins. Production startup
  rejects `*`; wildcard CORS in development disables credentialed CORS.
- `AUTH_ALLOWED_ORIGINS`: optional comma-separated exact origins allowed to
  call authentication endpoints. If unset, `CORS_ORIGINS` is used.

For production, set `ENVIRONMENT=production`, a non-wildcard `CORS_ORIGINS`,
and a strong `AUTH_ADMIN_BOOTSTRAP_SECRET` through the environment or a secret
manager. Do not put credentials in the repository. Cookie-based cross-origin
requests require an exact CORS origin; wildcard CORS is never paired with
`allow_credentials=True`.

Call `POST /api/auth/bootstrap` once with a `BootstrapCredentials` JSON body
and the key in `X-Admin-Bootstrap-Key`. The endpoint is unavailable if the key
is missing or shorter than 32 characters. The administrator record and a
separate bootstrap marker make a second setup attempt fail, even if the
environment key is configured again later. This endpoint is the only account
creation path; public registration is not provided.

Use `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/rotate`,
`POST /api/auth/password`, and `POST /api/auth/logout` for session management.
Login and rotation return a CSRF token in the response body; cookie-authenticated
writes send it as `X-CSRF-Token`. The reusable `build_csrf_dependency()` can be
attached with FastAPI `Depends` to future business write routes. It requires a
valid session and a constant-time token match, and checks `Origin` when present.

Sessions use random opaque cookie values, while MongoDB stores only their
SHA-256 digests. Rotation deletes the old session before issuing a replacement.
Password changes, role changes, and account disabling increment the user's
`auth_version` and revoke all their sessions. Session lookup compares that
version, so a failed cleanup cannot make an old session valid. The version
check is also the invalidation hook for future role-management endpoints.
Session expiry is enforced by every lookup and cleaned up by a MongoDB TTL
index.

## Tests

Install `backend/requirements-test.txt` in addition to the backend runtime
requirements to run `tests/test_auth.py`. That suite uses a fresh, in-memory
MongoDB-compatible database per test and never reads application `.env` files
or calls a hosted service.
