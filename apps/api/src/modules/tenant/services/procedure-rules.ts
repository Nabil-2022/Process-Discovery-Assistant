import { createHash } from 'crypto';

import { Prisma } from '../../../generated/prisma';
import { ProcedureDeterministicResult, ProcedureSectionDefinition } from './procedure.types';

export const PROCEDURE_RULE_VERSION = 'process-discovery-procedure-v1';
export const ISO_9001_NOTICE =
  "Structure documentaire facilitant l'alignement avec un systeme de management de la qualite.";
export const MOROCCO_LEGAL_NOTICE =
  'Cette section facilite la structuration et la tracabilite. Elle ne constitue pas un avis juridique et ne garantit pas a elle seule la conformite reglementaire.';

type ProcedureProcess = Prisma.ProcessGetPayload<{
  include: {
    direction: true;
    ownerActor: true;
    inputs: true;
    outputs: true;
    activities: true;
    actorRoles: { include: { actor: true } };
    documents: { include: { document: true } };
    applications: { include: { application: true } };
    kpis: true;
    risks: { include: { controls: { include: { control: true } } } };
    moroccoCompliance: true;
    eventLogImports: true;
    bpmnModels: true;
    bpmnVersions: true;
    raciAssessments: true;
    raciVersions: true;
    versions: true;
    validations: true;
  };
}>;

export function buildDeterministicProcedure(
  process: ProcedureProcess,
): ProcedureDeterministicResult {
  const reference = `PROC-${process.code ?? process.id.slice(0, 8)}-V${nextVersionLabel(process)}`;
  const sections: ProcedureSectionDefinition[] = [
    section('identification', 'Identification documentaire', 1, {
      procedure_reference: reference,
      procedure_title: `Procedure - ${process.name}`,
      process_id: process.id,
      tenant_id: process.tenantId,
      direction: process.direction?.name,
      process_owner: process.ownerActor?.name,
      document_owner: process.ownerActor?.name,
      confidentiality_level: 'internal',
      document_status: 'draft',
      version_number: nextVersionLabel(process),
    }),
    section('objet', 'Objet', 2, process.objective ?? process.description ?? process.name),
    section('perimetre', 'Perimetre', 3, process.scope ?? ''),
    section('references', 'References', 4, {
      documents: process.documents.map((item) => item.document),
      bpmn_rule: process.bpmnModels[0]?.ruleVersion,
      raci_rule: process.raciAssessments[0]?.ruleVersion,
      procedure_rule: PROCEDURE_RULE_VERSION,
    }),
    section('definitions', 'Definitions', 5, []),
    section(
      'responsabilites',
      'Responsabilites',
      6,
      process.actorRoles.map((role) => ({
        activity_id: role.activityId,
        activity: process.activities.find((activity) => activity.id === role.activityId)?.name,
        actor: role.actor.name,
        role: role.raciRole,
      })),
    ),
    section('entrees', 'Entrees', 7, process.inputs),
    section('sorties', 'Sorties', 8, process.outputs),
    section('activites', 'Description des activites', 9, process.activities),
    section(
      'documents',
      'Documents associes',
      10,
      process.documents.map((item) => item.document),
    ),
    section(
      'applications',
      'Applications utilisees',
      11,
      process.applications.map((item) => item.application),
    ),
    section('kpi', 'KPI', 12, process.kpis),
    section('risques_controles', 'Risques et controles', 13, process.risks),
    section(
      'conformite_maroc',
      'Exigences administratives et conformite Maroc',
      14,
      moroccoContent(process),
    ),
    section('process_mining', 'Process Mining', 15, {
      available: process.eventLogImports.length > 0,
      imports: process.eventLogImports.map((item) => ({
        id: item.id,
        status: item.status,
        rows: item.rowCount,
      })),
    }),
    section('preuves', 'Enregistrements et preuves', 16, []),
    section('versions', 'Versions', 17, {
      process_versions: process.versions,
      bpmn_versions: process.bpmnVersions,
      raci_versions: process.raciVersions,
    }),
    section('approbations', 'Approbations', 18, process.validations),
    section('historique', 'Historique des modifications', 19, []),
    section('annexes', 'Annexes', 20, []),
  ];
  const payload = stableJson({
    ruleVersion: PROCEDURE_RULE_VERSION,
    process: process.id,
    lockVersion: process.lockVersion,
    sections: sections.map(({ key, content }) => ({ key, content })),
  });
  return {
    reference,
    title: `Procedure - ${process.name}`,
    ruleVersion: PROCEDURE_RULE_VERSION,
    sourceHash: createHash('sha256').update(payload).digest('hex'),
    isoNotice: ISO_9001_NOTICE,
    sections,
    backlog: deterministicBacklog(process),
  };
}

function section(
  key: string,
  title: string,
  order: number,
  content: unknown,
): ProcedureSectionDefinition {
  return {
    key,
    title,
    order,
    content: content as Prisma.InputJsonValue,
    source: 'deterministic',
    status: 'draft',
  };
}

function moroccoContent(process: ProcedureProcess) {
  const compliance = process.moroccoCompliance;
  if (!compliance?.isUserFacingProcess && !compliance?.law5519Applicable) {
    return { applicable: false, notice: MOROCCO_LEGAL_NOTICE };
  }
  return {
    applicable: true,
    current_channel: compliance.currentChannel,
    target_channel: compliance.targetChannel,
    simplification_priority: compliance.simplificationPriority,
    digitalization_priority: compliance.digitalizationPriority,
    required_documents_count: compliance.requiredDocumentsCount,
    current_processing_time_days: compliance.currentProcessingTimeDays,
    target_processing_time_days: compliance.targetProcessingTimeDays,
    legal_reference: compliance.legalReference,
    public_service_portal_url: compliance.publicServicePortalUrl,
    audit_public_risks: process.risks.filter(
      (risk) => risk.courtOfAccountsRelevance || risk.auditRelevance,
    ),
    notice: MOROCCO_LEGAL_NOTICE,
  };
}

function deterministicBacklog(process: ProcedureProcess) {
  const items = [];
  if (!process.actorRoles.some((role) => role.raciRole === 'ACCOUNTABLE')) {
    items.push({
      title: 'Responsabilite Accountable manquante.',
      type: 'responsibility',
      priority: 'HIGH',
      source: 'procedure',
    });
  }
  if (!process.kpis.length)
    items.push({
      title: 'KPI manquant dans la procedure.',
      type: 'kpi',
      priority: 'MEDIUM',
      source: 'procedure',
    });
  for (const risk of process.risks) {
    if (!risk.controls.length)
      items.push({
        title: 'Risque sans controle associe.',
        type: 'risk_control',
        priority: 'HIGH',
        source: 'procedure',
      });
  }
  for (const item of process.documents) {
    if (!item.document.version)
      items.push({
        title: 'Document sans version a clarifier.',
        type: 'document',
        priority: 'MEDIUM',
        source: 'procedure',
      });
  }
  if (process.moroccoCompliance?.law5519Applicable) {
    items.push({
      title: 'Exigence Loi 55-19 a clarifier avant publication.',
      type: 'morocco',
      priority: 'HIGH',
      source: 'procedure',
    });
  }
  return items;
}

function nextVersionLabel(process: ProcedureProcess) {
  return Math.max(1, process.versions.length || 1);
}

function stableJson(value: unknown) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortValue(item)]),
  );
}
