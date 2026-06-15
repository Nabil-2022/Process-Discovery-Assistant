# Architecture

Process Discovery Assistant is a TypeScript monorepo.

## Applications

- `apps/api`: NestJS REST API, Prisma, PostgreSQL schema `process_discovery`.
- `apps/web`: React/Vite frontend with tenant/admin routes and preview mode.
- `packages/*`: shared configuration, types and UI placeholders.

## Core Domains

- Auth: JWT access tokens, rotating refresh tokens, sessions, invitations and reset flows.
- Admin SaaS: tenants, templates, features, subscriptions and support grants.
- Tenant: directions, referents, processes, workflow, RACI, BPMN, workshop, procedures.
- Exports: async export jobs, backend-protected downloads and local storage fallback.
- Activity: notifications, tasks, activity feed and tenant audit views.

## Boundaries

- All business records carry `tenant_id` or are accessed through tenant-scoped relations.
- Super admin does not access tenant business data without a valid support grant.
- AI output is advisory only and must be validated by a human before official use.

## Runtime

- API default: `http://localhost:3000/api/v1`.
- Web dev default: `http://localhost:5173`.
- Web preview default: `http://localhost:4173`.

