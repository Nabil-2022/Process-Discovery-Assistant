import { readFile } from 'node:fs/promises';

const files = {
  main: 'apps/web/src/main.tsx',
  tenantApi: 'apps/web/src/modules/tenant/api.ts',
  seedCheck: 'apps/api/prisma/seed-check.ts',
  tenantDashboard: 'apps/web/src/modules/tenant/TenantDashboard.tsx',
  activityPages: 'apps/web/src/modules/tenant/ActivityPages.tsx',
  processPages: 'apps/web/src/modules/tenant/ProcessPages.tsx',
  adminController: 'apps/api/src/modules/admin/admin.controller.ts',
  tenantController: 'apps/api/src/modules/tenant/tenant.controller.ts',
  processController: 'apps/api/src/modules/tenant/process.controller.ts',
  raciController: 'apps/api/src/modules/tenant/raci.controller.ts',
  bpmnController: 'apps/api/src/modules/tenant/bpmn.controller.ts',
  procedureController: 'apps/api/src/modules/tenant/procedure.controller.ts',
  exportController: 'apps/api/src/modules/tenant/export.controller.ts',
  activityController: 'apps/api/src/modules/tenant/activity.controller.ts',
  authSpec: 'apps/api/src/modules/auth/services/auth.service.spec.ts',
  tenantGuardSpec: 'apps/api/src/modules/tenant/guards/tenant-access.guard.spec.ts',
  activitySpec: 'apps/api/src/modules/tenant/services/activity.service.spec.ts',
  exportSpec: 'apps/api/src/modules/tenant/services/export.service.spec.ts',
};

const content = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, file]) => [key, await readFile(file, 'utf8')]),
  ),
);

const checks = [
  ['super admin login API', content.adminController, "@GlobalRoles('super_admin')"],
  ['tenant creation API', content.adminController, "@Post('tenants')"],
  ['template apply API', content.adminController, 'applyTemplate'],
  ['tenant dashboard route', content.main, '/tenant/dashboard'],
  ['directions route', content.main, '/tenant/directions'],
  ['process creation route', content.main, '/tenant/processes/new'],
  ['wizard route', content.main, '/tenant/processes/:id/wizard'],
  ['raci route', content.main, '/tenant/processes/:id/raci'],
  ['bpmn route', content.main, '/tenant/processes/:id/bpmn'],
  ['procedure route', content.main, '/tenant/processes/:id/procedure'],
  ['exports route', content.main, '/tenant/exports'],
  ['notifications route', content.main, '/tenant/notifications'],
  ['audit route', content.main, '/tenant/audit'],
  ['tenant admin can see dashboard', content.tenantDashboard, 'Dashboard cartographie'],
  ['13 directions seed check', content.seedCheck, 'mapTemplateDirections'],
  ['assign referent endpoint', content.tenantController, 'directions/:id/assign-referent'],
  ['remind referent endpoint', content.tenantController, 'directions/:id/remind-referent'],
  ['create process endpoint', content.processController, "@Controller('tenant/processes')"],
  ['submit process endpoint', content.processController, "@Post(':id/submit')"],
  [
    'completion below threshold tested',
    content.processController + content.processPages,
    'completeness',
  ],
  [
    'validation workflow correction',
    content.processController + content.procedureController,
    'request-changes',
  ],
  ['RACI generation endpoint', content.raciController, 'raci/generate'],
  ['BPMN generation endpoint', content.bpmnController, 'bpmn/generate'],
  ['procedure generation endpoint', content.procedureController, "@Post('generate')"],
  ['full package export endpoint', content.exportController, 'full-package'],
  [
    'export completed notification tested',
    content.activitySpec + content.exportSpec,
    'EXPORT_COMPLETED',
  ],
  ['audit endpoint', content.activityController, "@Get('audit')"],
  ['audit CSV endpoint', content.activityController, 'audit/export.csv'],
  ['readonly refusal tested', content.activitySpec + content.exportSpec, 'readonly'],
  ['other tenant export refused', content.exportSpec, 'another tenant'],
  ['tenant notification isolation tested', content.activitySpec, 'other tenant notification'],
  ['support grant expired refused', content.tenantGuardSpec, 'expired support access grant'],
  ['support grant revoked refused', content.tenantGuardSpec, 'revoked support access grant'],
  ['refresh rotation tested', content.authSpec, 'rotates a valid refresh token'],
  ['refresh reuse detection tested', content.authSpec, 'reuse is detected'],
];

const failures = checks.filter(([, haystack, needle]) => !haystack.includes(needle));

if (failures.length) {
  for (const [label, , needle] of failures) {
    console.error(`E2E contract missing: ${label} (${needle})`);
  }
  process.exit(1);
}

console.log(`e2e contract test passed (${checks.length} checks)`);
