# Authentication foundation

The authentication endpoints are mounted at `/api/auth`. Existing business
routes remain available without a session in this stage.

## Configuration

- `AUTH_ADMIN_BOOTSTRAP_SECRET`: one-time initial administrator setup key. Use
  a randomly generated value of at least 32 characters, provide it through the
  deployment environment or secret manager, and remove it after bootstrap.
- `ENVIRONMENT=production`: sets the session cookie's `Secure` attribute.
- `SESSION_TTL_SECONDS`: server-side session lifetime; defaults to eight hours
  and accepts values from five minutes to thirty days.
- `SESSION_COOKIE_SAMESITE`: `lax` by default; `strict` is also supported.
- `AUTH_ALLOWED_ORIGINS`: comma-separated exact origins allowed to call
  state-changing authentication endpoints. If unset, `CORS_ORIGINS` is used.

Call `POST /api/auth/bootstrap` once with a `BootstrapCredentials` JSON body
and the key in `X-Admin-Bootstrap-Key`. The endpoint is unavailable if the key
is missing or shorter than 32 characters. The administrator record and a
separate bootstrap marker make a second setup attempt fail, even if the
environment key is configured again later. This endpoint is the only account
creation path; public registration is not provided.

Use `POST /api/auth/login`, `GET /api/auth/me`, and `POST /api/auth/logout` for
session management. Login returns a CSRF token in the response body; callers
must send it as `X-CSRF-Token` when logging out. Sessions use random opaque
cookie values, while MongoDB stores only their SHA-256 digests. Session expiry
is enforced by every lookup and cleaned up by a MongoDB TTL index.

## Tests

Install `backend/requirements-test.txt` in addition to the backend runtime
requirements to run `tests/test_auth.py`. That suite uses a fresh, in-memory
MongoDB-compatible database per test and never reads application `.env` files
or calls a hosted service.
