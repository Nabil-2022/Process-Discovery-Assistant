import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'index.html',
  'src/main.tsx',
  'src/modules/health/HealthPage.tsx',
  'src/modules/tenant/TenantDashboard.tsx',
  'src/modules/tenant/TenantDirections.tsx',
  'src/modules/tenant/ProcessPages.tsx',
  'src/modules/tenant/ActivityPages.tsx',
];

await Promise.all(requiredFiles.map((file) => access(new URL(`../${file}`, import.meta.url))));

const main = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
for (const route of [
  '/tenant/dashboard',
  '/tenant/directions',
  '/tenant/directions/:id',
  '/tenant/processes',
  '/tenant/exports',
  '/tenant/notifications',
  '/tenant/notification-preferences',
  '/tenant/activity',
  '/tenant/audit',
  '/tenant/tasks',
  '/tenant/my-actions',
  '/tenant/processes/new',
  '/tenant/processes/:id/wizard',
  '/tenant/processes/:id/workshop',
  '/tenant/processes/:id/procedure',
]) {
  if (!main.includes(route)) {
    throw new Error(`missing tenant route: ${route}`);
  }
}

const dashboard = await readFile(
  new URL('../src/modules/tenant/TenantDashboard.tsx', import.meta.url),
  'utf8',
);
for (const text of ['Dashboard cartographie', 'Actions prioritaires', 'Erreur API']) {
  if (!dashboard.includes(text)) {
    throw new Error(`missing dashboard state: ${text}`);
  }
}

const activity = await readFile(
  new URL('../src/modules/tenant/ActivityPages.tsx', import.meta.url),
  'utf8',
);
for (const text of [
  'NotificationBell',
  'NotificationCenter',
  'NotificationList',
  'TaskList',
  'TaskStatusBadge',
  'Tout marquer comme lu',
  'Export CSV',
  'Mes actions',
  'Preferences notifications',
]) {
  if (!activity.includes(text)) {
    throw new Error(`missing activity state: ${text}`);
  }
}

const directions = await readFile(
  new URL('../src/modules/tenant/TenantDirections.tsx', import.meta.url),
  'utf8',
);
for (const text of ['Aucune direction disponible', 'Rechercher une direction', 'Progression']) {
  if (!directions.includes(text)) {
    throw new Error(`missing directions state: ${text}`);
  }
}

const processes = await readFile(
  new URL('../src/modules/tenant/ProcessPages.tsx', import.meta.url),
  'utf8',
);
for (const text of [
  'Nouveau processus',
  'Assistant processus',
  'Resume et soumission',
  'Conflit detecte',
  'Recalculer',
  'Checklist qualite',
  'Blocages',
  'Alertes',
  'Recommandations',
  'Atelier de Formalisation',
  "Vue d'ensemble",
  'Process Mining',
  'Procedure',
  'Copilote IA',
  "L'IA est un copilote, pas une source officielle.",
  'Toute suggestion doit etre validee humainement.',
  "Aucune suggestion n'est appliquee automatiquement.",
  'Aucune generation IA.',
  'Chargement du copilote IA...',
  'Copilote IA non active pour ce tenant',
  'Accepter',
  'Modifier',
  'Rejeter',
  'Valider',
  'Creer KPI',
  'Creer risque',
  'Creer controle',
  'Creer backlog',
  'Inserer brouillon procedure',
  'Generer brouillon IA',
  'Proposer backlog IA',
  'Proposer des KPI',
  'Proposer des risques/controles',
  'Proposer ameliorations',
  'Proposer automatisations',
  'Analyser les incoherences',
  'Procedure qualite structuree',
  'ProcedureSectionEditor',
  'ProcedureStatusBadge',
  'ProcedureValidationPanel',
  'ProcedureVersionsPanel',
  'ProcedureDiffPanel',
  'ProcedureAiDraftPanel',
  'Structure documentaire facilitant',
  'Generer procedure',
  'Soumettre en revue',
  'Demander correction',
  'Publier',
  'Brouillon genere par IA',
  'Exports officiels',
  'ExportDrawer',
  'ExportJobList',
  'ExportStatusBadge',
  'ExportFormatSelector',
  'ExportTypeSelector',
  'ExportDownloadButton',
  'Demander export',
  'Annuler',
  'Relancer',
  'Commentaires',
  'Audit',
]) {
  if (!processes.includes(text)) {
    throw new Error(`missing process wizard state: ${text}`);
  }
}

console.log('web smoke test passed');
