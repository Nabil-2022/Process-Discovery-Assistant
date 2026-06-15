# Process Discovery Assistant

Process Discovery Assistant is a B2B SaaS module for process discovery, ISO 9001-oriented documentation, deterministic RACI/BPMN generation, validation workflows, immutable published versions, exports, and auditable AI suggestions.

This repository is a React/NestJS monorepo for a multi-tenant process discovery SaaS. It now includes tenant dashboards, directions, process wizard, validation workflow, Morocco compliance, RACI, BPMN, workshop, AI copilot, quality procedures, official exports, notifications, tasks, audit, and production hardening checks.

## Prerequisites

- Node.js 22+
- npm 10+
- Docker Desktop, optional for local PostgreSQL, MinIO, and Mailpit

## Install

```bash
npm install
```

## Environment

Copy `.env.example` to `.env` locally and fill values outside Git. Real secrets must never be committed.

Required API variables are validated at startup:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `APP_URL`
- `API_URL`

## Development

```bash
npm run dev
```

API healthcheck:

```bash
curl http://localhost:3000/api/v1/health
```

Web healthcheck:

```bash
curl http://localhost:5173/health
```

## Production Target

Target domain:

```text
https://process.higroup.systems
```

Production routing:

- Frontend: `https://process.higroup.systems`
- API: `https://process.higroup.systems/api/v1`
- Healthcheck: `https://process.higroup.systems/api/v1/health`

Production deployment assets:

- `docker-compose.prod.yml`
- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- `deploy/nginx/process.higroup.systems.conf`
- `deploy/README_DEPLOY_PROCESS_HIGROUP.md`

## Quality Gates

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
npm run format
```

Additional database checks:

```bash
npx prisma validate --config apps/api/prisma.config.ts
npx prisma generate --config apps/api/prisma.config.ts
npx prisma migrate status --config apps/api/prisma.config.ts
npm run db:check --workspace @pda/api
npm run db:seed-check --workspace @pda/api
npm run db:integrity --workspace @pda/api
```

## Local Services

```bash
docker compose up -d postgres minio mailpit
```

Local service defaults are for development only and are not production secrets.

## Safety Rules

- Do not commit `.env`.
- Do not hardcode `DATABASE_URL`.
- Do not run `DROP DATABASE`.
- Do not run `prisma migrate reset` on any remote database.
- Do not run `prisma db push` against production.
- Do not store binary files in PostgreSQL.
- AI suggestions are never official source data.

## Production Docs

- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/RBAC_MATRIX.md`
- `docs/DATABASE.md`
- `docs/DEPLOYMENT.md`
- `docs/TESTING.md`
- `docs/SECRET_AUDIT.md`
- `docs/SECURITY_VULNERABILITIES.md`
- `docs/PRODUCTION_CHECKLIST.md`
- `docs/STORAGE_EXPORTS.md`
- `docs/GIT_PUSH_PRECHECK.md`
- `docs/MVP_MANUAL_TEST.md`
