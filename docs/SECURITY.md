# Security

## Implemented Controls

- Helmet enabled globally.
- CORS origin configurable through `APP_URL`.
- JSON and URL-encoded body size limited to `1mb`.
- Global `ValidationPipe` uses `whitelist`, `forbidNonWhitelisted` and `transform`.
- Refresh token cookie is HttpOnly and scoped to `/api/v1/auth/refresh`.
- Refresh tokens are hashed, rotated and have reuse detection.
- Password reset and invitation tokens are hashed.
- Login rate limiting exists through `AuthRateLimitService`.
- Tenant guard rejects inactive users, tenants and memberships.
- Support access requires an active, non-expired, non-revoked support grant.
- Audit responses redact sensitive keys such as password, token, cookie, secret, API key and DATABASE_URL.

## Required Production Settings

- Set `COOKIE_SECURE=true`.
- Use `COOKIE_SAME_SITE=strict` or `lax` depending on deployment topology.
- Set a specific `COOKIE_DOMAIN` only when required.
- Keep API behind TLS.
- Do not expose Vite dev server, Vitest, Prisma Studio or Swagger publicly without access control.
- Keep `ENABLE_SWAGGER=false` in production unless Swagger is behind an authenticated network boundary.
- Use centralized logs with secret redaction.

## Open Hardening Items

- Add global exception filter with structured correlation IDs.
- Add broader rate limiting for high-risk mutation endpoints.
- Add CSP tuning once final frontend asset hosting is known.
