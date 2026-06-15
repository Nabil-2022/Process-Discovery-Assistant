# Secret Audit

## Scope

Searched for real database URLs, direct database URLs, PostgreSQL passwords, JWT secrets, AI keys, Azure OpenAI keys, storage access keys, storage secret keys, MinIO root password, cookies, tokens, refresh tokens, private keys and generic secrets.

## Result

- No real secret value found in tracked source files by the Lot 16 scan.
- `.env` is ignored by `.gitignore`.
- `.env.example` contains empty placeholders only.
- Public production values in `.env.example` are non-secret: `APP_URL`, `API_URL`, `FRONTEND_URL`, `CORS_ORIGIN`, cookie policy and `NODE_ENV`.
- `storage/exports` is ignored by `.gitignore`.
- `apps/api/src/generated/prisma` is ignored by `.gitignore`; generated files may exist locally but should not be committed unless the project changes that policy.

## Commands

```bash
rg -n "(DATABASE_URL|DIRECT_DATABASE_URL|JWT_ACCESS_SECRET|JWT_REFRESH_SECRET|AI_API_KEY|STORAGE_SECRET_KEY|MINIO_ROOT_PASSWORD|private key|refresh token|api key)" -g "!node_modules" -g "!apps/api/src/generated/prisma"
rg --files -g ".env*" -g "!node_modules"
```

## Decision

Secrets must remain injected through runtime environment or deployment secrets manager.
