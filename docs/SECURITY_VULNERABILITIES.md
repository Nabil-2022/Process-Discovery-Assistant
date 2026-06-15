# NPM Vulnerability Review

`npm audit --workspaces` currently reports 20 vulnerabilities: 14 moderate, 5 high and 1 critical.

| Package | Severity | Direct/Transitive | Runtime | Fix | Decision |
| --- | --- | --- | --- | --- | --- |
| `@hono/node-server` via Prisma dev tooling | Moderate | Transitive | Dev/build tooling | `npm audit fix --force`, downgrades/breaks Prisma path | Defer; not exposed in production runtime |
| `@nestjs/core` / `@nestjs/platform-express` | Moderate | Direct/transitive | API runtime | Force update to newer Nest major/minor path | Defer until coordinated Nest upgrade |
| `esbuild` via Vite/Vitest | High | Transitive | Dev/build only | Force Vite major upgrade | Mitigate: never expose Vite dev server; defer safe upgrade |
| `file-type` via Nest common | Moderate | Transitive | API runtime | Non-force possible depending tree | Review in dependency upgrade batch |
| `js-yaml` via Swagger | Moderate | Transitive | API docs tooling/runtime | Force Swagger upgrade | Defer; restrict Swagger exposure in production |
| `lodash` via Nest config/Swagger | High | Transitive | API runtime/tooling | Force dependency upgrades | Defer; avoid untrusted lodash templates |
| `multer` via Nest platform express | High | Transitive | API runtime | Force Nest platform upgrade | Defer; no upload endpoint uses multer directly in current MVP |
| `qs` via express/body-parser | Moderate | Transitive | API runtime | Force platform upgrade | Defer; body size limit and strict DTO validation mitigate exposure |

No `npm audit fix --force` was run.

