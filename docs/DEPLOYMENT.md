# Deployment

## Build

```bash
npm ci
npm run format
npm run lint
npm run test
npm run test:e2e
npm run build
```

## Database

```bash
npx prisma migrate deploy --config apps/api/prisma.config.ts
```

## Environment

Required values must be injected by the platform, not committed:

- `DATABASE_URL`
- `DIRECT_DATABASE_URL` when needed
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `APP_URL`
- `API_URL`
- AI provider credentials when enabled
- storage credentials when external storage is enabled

## Runtime Notes

- API should run behind TLS and a reverse proxy.
- Web should be served as static assets.
- Vite dev server must not be exposed in production.
- Swagger should be restricted in production if public exposure is not desired.

## process.higroup.systems

The production target is:

```text
https://process.higroup.systems
```

Routing:

- `/` goes to the React frontend.
- `/api/v1` goes to the NestJS API.
- The frontend must use `VITE_API_URL=/api/v1`.

Use:

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Nginx host configuration is available at:

```text
deploy/nginx/process.higroup.systems.conf
```

Detailed DNS, Nginx and Certbot instructions are in:

```text
deploy/README_DEPLOY_PROCESS_HIGROUP.md
```

## Production Migration Procedure

1. Confirm DNS and deployment environment.
2. Back up PostgreSQL.
3. Verify `.env` on the server contains the real `DATABASE_URL` and optional `DIRECT_DATABASE_URL`.
4. Run:

```bash
npx prisma validate --config apps/api/prisma.config.ts
npx prisma migrate status --config apps/api/prisma.config.ts
npx prisma migrate deploy --config apps/api/prisma.config.ts
npm run db:check --workspace @pda/api
npm run db:seed-check --workspace @pda/api
npm run db:integrity --workspace @pda/api
```

Never run `prisma db push`, `prisma migrate reset`, or `DROP DATABASE` in production.
