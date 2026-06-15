# Git Push Precheck

## Commands

```bash
git status --short
git diff --stat
rg --files -g ".env*" -g "!node_modules"
rg -n "(DATABASE_URL|JWT_ACCESS_SECRET|JWT_REFRESH_SECRET|AI_API_KEY|STORAGE_SECRET_KEY|private key)" -g "!node_modules" -g "!apps/api/src/generated/prisma"
npm run format
npm run lint
npm run test
npm run test:e2e
npm run build
npm audit --workspaces
```

## Current Deployment Files

- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- `apps/web/nginx.conf`
- `docker-compose.prod.yml`
- `deploy/nginx/process.higroup.systems.conf`
- `deploy/README_DEPLOY_PROCESS_HIGROUP.md`

## Files to Verify

- `.env` absent from Git.
- `node_modules` absent from Git.
- `dist`, `build`, `.vite`, coverage and tsbuildinfo absent from Git.
- `storage/exports` absent from Git.
- Generated Prisma client follows project policy and is currently ignored.

## Suggested Branch

`feature/process-discovery-production-ready`

## Suggested Commit Strategy

1. `chore: initialize monorepo architecture`
2. `feat: add multi-tenant database and authentication`
3. `feat: add tenant administration and process discovery wizard`
4. `feat: add quality, validation, RACI and BPMN engines`
5. `feat: add Morocco compliance, AI copilot and procedure module`
6. `feat: add exports, notifications and audit center`
7. `chore: add production deployment and documentation`

Because the repository is currently entirely untracked, a single commit is safer if historical slicing cannot be reviewed cleanly:

`feat: complete process discovery assistant production-ready MVP`

## Suggested Commit Message

`feat: complete process discovery assistant production-ready MVP`

## Remaining Risks

- NPM audit still reports vulnerabilities requiring coordinated dependency upgrades.
- Full browser E2E with Playwright is not installed yet.
