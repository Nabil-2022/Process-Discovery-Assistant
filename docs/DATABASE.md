# Database

## Schema

- Provider: PostgreSQL.
- Prisma schema: `apps/api/prisma/schema.prisma`.
- Logical schema: `process_discovery`.
- Current migrations: `0001` through `0011`.

## Commands

```bash
npx prisma validate --config apps/api/prisma.config.ts
npx prisma generate --config apps/api/prisma.config.ts
npx prisma migrate status --config apps/api/prisma.config.ts
npx prisma migrate deploy --config apps/api/prisma.config.ts
npm run db:check --workspace @pda/api
npm run db:seed-check --workspace @pda/api
npm run db:integrity --workspace @pda/api
```

## Interdictions

- Do not run `prisma db push` on shared or production databases.
- Do not run `prisma migrate reset`.
- Do not run `DROP DATABASE`.
- Do not remove tables or columns without a reviewed migration plan.

## Production Strategy

- Run `migrate deploy` in CI/CD after backup.
- Keep tenant-first indexes for tenant-scoped tables.
- Keep soft deletes where business history matters.
- RLS is prepared conceptually but not enabled; application guards currently enforce tenant isolation.
- Backup before every migration and test restore regularly.

## Backup / Restore

- Use managed PostgreSQL snapshots where available.
- For manual backup use `pg_dump` scoped to the database and schema.
- Restore into staging before production rollback decisions.

