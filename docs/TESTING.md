# Testing

## Automated Tests

```bash
npm run format
npm run lint
npm run test
npm run test:e2e
npm run build
```

## E2E Status

Playwright is not installed in the repository. Lot 16 adds `npm run test:e2e`, a contract-level E2E smoke test that verifies the MVP journey wiring across frontend routes, backend endpoints, RBAC tests, tenant isolation tests, export notifications and audit.

Remaining browser automation can be added later with `@playwright/test` once dependency policy is confirmed.

## Manual Tests

- `docs/MVP_MANUAL_TEST.md`
- `docs/LOT15_MANUAL_TEST.md`
- `docs/EXPORTS_MANUAL_TEST.md`
- `docs/PROCEDURE_QUALITY_MANUAL_TEST.md`
- `docs/AI_COPILOT_MANUAL_TEST.md`
- `docs/BPMN_MANUAL_TEST.md`
- `docs/RACI_MANUAL_TEST.md`

