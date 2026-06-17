const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';
const previewNow = new Date().toISOString();

export type TenantSummary = {
  directions: number;
  processes: number;
  draft_processes: number;
  submitted_processes: number;
  correction_processes: number;
  validated_processes: number;
  average_completeness: number;
  pending_validations: number;
  critical_risks: number;
  automation_opportunities: number;
};

export type DirectionProgress = {
  id: string;
  name: string;
  code: string | null;
  processes: number;
  validated_processes: number;
  average_completeness: number;
  campaign_progress: number;
  progress: number;
};

export type DistributionItem = {
  label: string;
  count: number;
};

export type PriorityAction = {
  process_id: string;
  process_name: string;
  direction_name: string;
  status: string;
  completeness_score: number;
  priority: string;
};

export type DirectionItem = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  referent: { id: string; email: string; full_name: string } | null;
  processes: number;
  validated_processes: number;
  average_completeness: number;
  progression: number;
  campaign_progress: number;
  validation: string;
  last_activity_at: string;
  pending_validations: number;
  campaign?: { id: string; name: string; status: string } | null;
  referents?: { id: string; email: string; full_name: string }[];
  process_statuses?: Record<string, number>;
  create_process_available?: boolean;
  create_process_message?: string;
};

export type DirectionListResponse = {
  page: number;
  page_size: number;
  total: number;
  items: DirectionItem[];
};

export type DirectionFilters = {
  search?: string;
  page?: number;
  campaign_id?: string;
  direction_id?: string;
  process_status?: string;
  category_id?: string;
};

export type ProcessItem = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  objective?: string | null;
  scope?: string | null;
  triggerEvent?: string | null;
  status: string;
  lockVersion: number;
  completenessScore: string | number;
  updatedAt: string;
  direction?: { id: string; name: string; code: string | null };
  category?: { id: string; name: string; code: string | null } | null;
  ownerActor?: { id: string; name: string; email: string | null } | null;
  moroccoCompliance?: MoroccoCompliance | null;
  inputs?: { id: string; name: string; description?: string | null; source?: string | null }[];
  outputs?: {
    id: string;
    name: string;
    description?: string | null;
    destination?: string | null;
  }[];
  activities?: ProcessActivity[];
  actorRoles?: ProcessResponsibility[];
  documents?: unknown[];
  applications?: unknown[];
  kpis?: unknown[];
  risks?: {
    id: string;
    description: string;
    category?: string | null;
    riskFamily?: string | null;
    inherentScore?: number | null;
    residualScore?: number | null;
    auditRelevance?: string | null;
    courtOfAccountsRelevance?: boolean;
    controls?: unknown[];
  }[];
  painPoints?: unknown[];
  automationNeeds?: unknown[];
  assessments?: {
    id: string;
    globalScore: string | number;
    qualityStatus?: string | null;
    blockingIssues?: unknown;
    warnings?: unknown;
    assessedAt: string;
  }[];
  raciAssessments?: {
    id: string;
    validationStatus: string;
    qualityScore: string | number;
    generatedAt: string;
  }[];
};

export type RaciIssue = {
  code: string;
  message: string;
  severity: 'blocking' | 'warning';
  activityId?: string;
  actorId?: string;
};

export type RaciResult = {
  ruleVersion: string;
  matrix: {
    activities: { id: string; name: string }[];
    actors: { id: string; name: string }[];
    cells: { activityId: string; actorId: string; roles: string[] }[];
  };
  blockingIssues: RaciIssue[];
  warnings: RaciIssue[];
  recommendations: string[];
  qualityScore: number;
  validationStatus: string;
  versionNumber: number;
  generatedAt: string;
  sourceHash: string;
  canValidate: boolean;
};

export type BpmnIssue = {
  code: string;
  message: string;
  severity: 'blocking' | 'warning';
  activityId?: string;
  transitionId?: string;
};

export type BpmnNode = {
  id: string;
  type: 'startEvent' | 'endEvent' | 'task' | 'userTask' | 'exclusiveGateway';
  label: string;
  sourceActivityId?: string;
  actorId?: string;
  laneId: string;
  position: { x: number; y: number };
  metadata: Record<string, unknown>;
};

export type BpmnEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  condition?: string;
  sourceTransitionId?: string;
  metadata: Record<string, unknown>;
};

export type BpmnResult = {
  ruleVersion: string;
  sourceHash: string;
  bpmnJson: {
    processId: string;
    tenantId: string;
    ruleVersion: string;
    generatedAt: string;
    generatedBy?: string;
    sourceHash: string;
    participants: { id: string; label: string }[];
    lanes: {
      id: string;
      label: string;
      actorId?: string;
      nodeIds: string[];
      bounds: { x: number; y: number; width: number; height: number };
    }[];
    nodes: BpmnNode[];
    edges: BpmnEdge[];
    gateways: BpmnNode[];
    events: BpmnNode[];
    layout: { direction: 'horizontal'; spacingX: number; spacingY: number };
    issues: BpmnIssue[];
    warnings: BpmnIssue[];
    recommendations: string[];
  };
  bpmnXml: string;
  blockingIssues: BpmnIssue[];
  warnings: BpmnIssue[];
  recommendations: string[];
  validationStatus: string;
  versionNumber: number;
  generatedAt: string;
  canValidate: boolean;
};

export type MoroccoCompliance = {
  id?: string;
  isUserFacingProcess?: boolean;
  law5519Applicable?: boolean;
  administrativeProcedureType?: string | null;
  userCategory?: string | null;
  currentChannel?: string | null;
  targetChannel?: string | null;
  simplificationPriority?: string | null;
  digitalizationPriority?: string | null;
  currentProcessingTimeDays?: number | null;
  targetProcessingTimeDays?: number | null;
  requiredDocumentsCount?: number | null;
  requestedCopiesCount?: number | null;
  physicalVisitsRequired?: number | null;
  feesRequired?: boolean | null;
  legalReference?: string | null;
  procedureOwnerEntity?: string | null;
  publicServicePortalUrl?: string | null;
  observations?: string | null;
};

export type EventLogImport = {
  id: string;
  fileName: string;
  status: string;
  rowCount: number;
  validationReport?: unknown;
  basicAnalysis?: unknown;
  createdAt: string;
  cases?: unknown[];
};

export type ProcessActivity = {
  id: string;
  name: string;
  description?: string | null;
  inputText?: string | null;
  outputText?: string | null;
  sortOrder?: number;
};

export type ProcessResponsibility = {
  activityId: string | null;
  actorId: string;
  raciRole: 'RESPONSIBLE' | 'ACCOUNTABLE' | 'CONSULTED' | 'INFORMED';
};

export type Completeness = {
  score: number;
  pointsObtained?: number;
  pointsMax?: number;
  percentage?: number;
  qualityStatus?: string;
  sections?: SectionCompleteness[];
  sectionScores: Record<string, number>;
  sectionPercentages?: Record<string, number>;
  missingFields: string[];
  blockingIssues: string[];
  blockingIssueDetails?: QualityIssue[];
  warnings: string[];
  warningDetails?: QualityIssue[];
  recommendations: string[];
  canSubmit: boolean;
  scoringRuleVersion: string;
  calculatedAt?: string;
  sourceLockVersion?: number;
};

export type WizardResponse = {
  process: ProcessItem;
  steps: string[];
  completeness: Completeness;
};

export type QualityIssue = {
  code: string;
  message: string;
  section: string;
  severity: string;
  wizardStep: number;
};

export type SectionCompleteness = {
  key: string;
  label: string;
  wizardStep: number;
  pointsObtained: number;
  pointsMax: number;
  percentage: number;
  status: 'complete' | 'incomplete' | 'warning' | 'error';
  missingFields: string[];
  blockingIssues: QualityIssue[];
  warnings: QualityIssue[];
  recommendations: string[];
};

export type WorkshopOverview = {
  process: {
    id: string;
    name: string;
    code: string | null;
    description?: string | null;
    direction?: { id: string; name: string; code?: string | null };
    owner?: { id: string; name: string; email?: string | null } | null;
    status: string;
    publication_status: string;
    completeness_score: number;
    updated_at: string;
    last_submitted_snapshot_id?: string | null;
    last_submitted_version_id?: string | null;
    lock_version: number;
  };
  quality: Completeness;
  raci: { status: string; score: number; version: number; generated_at: string } | null;
  bpmn: {
    status: string;
    version: number;
    generated_at: string;
    blocking_issues: number;
    warnings: number;
  } | null;
  morocco: Record<string, unknown> | null;
  workflow: Record<string, unknown>;
  alerts: {
    blocking: QualityIssue[];
    warnings: QualityIssue[];
    recommendations: string[];
  };
  actions: Record<string, boolean>;
};

export type WorkshopProcedure = {
  status: string;
  disclaimer: string;
  sections: { key: string; title: string; content: unknown; source: string; editable: boolean }[];
};

export type ProcedureSection = {
  id: string;
  sectionKey: string;
  title: string;
  content: unknown;
  deterministicContent?: unknown;
  manualContent?: unknown;
  aiContent?: unknown;
  source: string;
  status: string;
  order: number;
  comment?: string | null;
  updatedAt?: string;
};

export type ProcedureDocument = {
  id: string;
  reference: string;
  title: string;
  status: string;
  versionNumber: number;
  ruleVersion: string;
  sourceHash: string;
  confidentialityLevel: string;
  effectiveDate?: string | null;
  reviewDate?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  sections: ProcedureSection[];
  approvals?: unknown[];
};

export type ProcedureVersion = {
  id: string;
  versionNumber: number;
  status: string;
  sourceHash: string;
  snapshot: unknown;
  createdAt: string;
};

export const exportTypes = [
  'process_sheet',
  'procedure',
  'raci_matrix',
  'bpmn_diagram',
  'risk_register',
  'kpi_register',
  'backlog',
  'direction_summary',
  'executive_summary',
  'morocco_compliance',
  'process_mining_report',
  'audit_extract',
  'full_package',
] as const;

export const exportFormats = ['pdf', 'docx', 'xlsx', 'json', 'bpmn_xml', 'zip', 'csv'] as const;

export type ExportType = (typeof exportTypes)[number];
export type ExportFormat = (typeof exportFormats)[number];

export type ExportJob = {
  id: string;
  processId?: string | null;
  directionId?: string | null;
  exportType: string;
  format: string;
  status: string;
  fileName?: string | null;
  mimeType?: string | null;
  size?: string | number | null;
  checksum?: string | null;
  errorMessage?: string | null;
  objectKey?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export type TenantNotification = {
  id: string;
  type: string;
  title: string;
  message?: string | null;
  severity: string;
  status: string;
  action_url?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  created_at: string;
  read_at?: string | null;
};

export type TenantTask = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  due_date?: string | null;
  direction_id?: string | null;
  process_id?: string | null;
  action_url?: string | null;
  created_at: string;
};

export type TenantActivity = {
  id: string;
  actor_user_id?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  result: string;
  correlation_id?: string | null;
  created_at: string;
};

export type NotificationPreferences = {
  in_app_enabled: boolean;
  email_enabled: boolean;
  frequency: string;
  language: string;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  disabled_types: string[];
};

export type MyActions = {
  tasks: TenantTask[];
  notifications: TenantNotification[];
  exports_ready: ExportJob[];
  processes_to_complete: {
    id: string;
    name: string;
    status: string;
    completenessScore: string | number;
  }[];
};

export type WorkshopBacklog = {
  items: {
    id: string;
    title: string;
    type: string;
    source: string;
    priority: string;
    impact: string;
    complexity: string;
    status: string;
    owner?: string | null;
    due_date?: string | null;
  }[];
};

export type WorkshopVersions = {
  published_versions: unknown[];
  snapshots: unknown[];
  raci_versions: unknown[];
  bpmn_versions: unknown[];
  procedure_versions: unknown[];
};

export type WorkshopComment = {
  id: string;
  body: string;
  status: string;
  resourceType?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
};

export const aiGenerationTypes = [
  'inconsistency_detection',
  'kpi_suggestions',
  'risk_suggestions',
  'control_suggestions',
  'improvement_suggestions',
  'automation_suggestions',
  'procedure_draft',
  'user_stories',
  'backlog_suggestions',
  'direction_summary',
  'executive_summary',
  'morocco_compliance_review',
  'public_audit_review',
  'process_mining_interpretation',
] as const;

export type AiGenerationType = (typeof aiGenerationTypes)[number];

export type AiGeneration = {
  id: string;
  provider: string;
  purpose: AiGenerationType;
  model?: string | null;
  output?: unknown;
  createdBy?: string | null;
  createdAt: string;
  suggestions?: AiSuggestion[];
};

export type AiSuggestion = {
  id: string;
  suggestionType: string;
  content: Record<string, unknown>;
  status: 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'MODIFIED' | 'VALIDATED' | 'ARCHIVED';
  createdAt: string;
  decidedAt?: string | null;
};

export type AiGenerateResponse = {
  generation: AiGeneration;
  suggestions: AiSuggestion[];
};

const previewDirection: DirectionItem = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Direction Finance',
  code: 'FIN',
  status: 'active',
  referent: { id: 'preview-user', email: 'referent@example.test', full_name: 'Referent Finance' },
  processes: 1,
  validated_processes: 0,
  average_completeness: 68,
  progression: 68,
  campaign_progress: 68,
  validation: 'draft',
  last_activity_at: previewNow,
  pending_validations: 0,
};

const previewProcess: ProcessItem = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Cloture comptable mensuelle',
  code: 'FIN-CLOT-001',
  description: 'Processus de formalisation de la cloture mensuelle.',
  objective: 'Produire des comptes mensuels fiables et valides.',
  scope: 'Perimetre finance siege et filiales.',
  triggerEvent: 'Fin de mois',
  status: 'DRAFT',
  lockVersion: 3,
  completenessScore: 76,
  updatedAt: previewNow,
  direction: { id: previewDirection.id, name: previewDirection.name, code: previewDirection.code },
  category: { id: '33333333-3333-4333-8333-333333333333', name: 'Metier', code: 'METIER' },
  ownerActor: {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Responsable comptable',
    email: 'owner@example.test',
  },
  moroccoCompliance: {
    id: '99999999-9999-4999-8999-999999999999',
    isUserFacingProcess: true,
    law5519Applicable: true,
    administrativeProcedureType: 'Demande administrative',
    userCategory: 'Usager entreprise',
    currentChannel: 'Physique',
    targetChannel: 'Digital',
    simplificationPriority: 'Haute',
    digitalizationPriority: 'Haute',
    currentProcessingTimeDays: 12,
    targetProcessingTimeDays: 4,
    requiredDocumentsCount: 6,
    requestedCopiesCount: 2,
    physicalVisitsRequired: 1,
    feesRequired: false,
    legalReference: 'Loi 55-19',
    procedureOwnerEntity: 'Direction Finance',
    publicServicePortalUrl: '',
    observations:
      'Cet outil facilite la structuration et la tracabilite sans garantir la conformite.',
  },
  inputs: [{ id: '55555555-5555-4555-8555-555555555555', name: 'Factures validees' }],
  outputs: [{ id: '66666666-6666-4666-8666-666666666666', name: 'Etats financiers mensuels' }],
  activities: [
    {
      id: '77777777-7777-4777-8777-777777777777',
      name: 'Collecter les justificatifs',
      outputText: 'Dossier de cloture consolide',
      sortOrder: 1,
    },
  ],
  actorRoles: [
    {
      activityId: '77777777-7777-4777-8777-777777777777',
      actorId: '44444444-4444-4444-8444-444444444444',
      raciRole: 'RESPONSIBLE',
    },
  ],
  documents: [{ id: 'preview-doc', title: 'Procedure de cloture' }],
  applications: [{ id: 'preview-app', name: 'ERP Finance' }],
  kpis: [{ id: 'preview-kpi', name: 'Delai de cloture' }],
  risks: [
    {
      id: 'preview-risk',
      description: 'Risque de delai non maitrise pour une procedure usager',
      category: 'Audit public',
      riskFamily: 'Conformite',
      inherentScore: 12,
      residualScore: 6,
      auditRelevance: 'Preparation audit interne et externe',
      courtOfAccountsRelevance: true,
      controls: [],
    },
  ],
  painPoints: [{ id: 'preview-pain', description: 'Relances manuelles' }],
  automationNeeds: [{ id: 'preview-auto', description: 'Rapprochement automatique' }],
  assessments: [
    {
      id: 'preview-assessment',
      globalScore: 76,
      qualityStatus: 'blocked',
      blockingIssues: ['missing_accountable'],
      warnings: ['missing_control', 'activity_without_duration'],
      assessedAt: previewNow,
    },
  ],
  raciAssessments: [
    {
      id: 'preview-raci-assessment',
      validationStatus: 'DRAFT',
      qualityScore: 88,
      generatedAt: previewNow,
    },
  ],
};

const previewRaci: RaciResult = {
  ruleVersion: 'process-discovery-raci-v1',
  matrix: {
    activities: [
      { id: '77777777-7777-4777-8777-777777777777', name: 'Collecter les justificatifs' },
      { id: '77777777-7777-4777-8777-777777777778', name: 'Valider le dossier' },
    ],
    actors: [
      { id: '44444444-4444-4444-8444-444444444444', name: 'Responsable comptable' },
      { id: '44444444-4444-4444-8444-444444444445', name: 'Directeur Finance' },
    ],
    cells: [
      {
        activityId: '77777777-7777-4777-8777-777777777777',
        actorId: '44444444-4444-4444-8444-444444444444',
        roles: ['RESPONSIBLE'],
      },
      {
        activityId: '77777777-7777-4777-8777-777777777777',
        actorId: '44444444-4444-4444-8444-444444444445',
        roles: ['ACCOUNTABLE'],
      },
      {
        activityId: '77777777-7777-4777-8777-777777777778',
        actorId: '44444444-4444-4444-8444-444444444444',
        roles: ['RESPONSIBLE'],
      },
      {
        activityId: '77777777-7777-4777-8777-777777777778',
        actorId: '44444444-4444-4444-8444-444444444445',
        roles: ['ACCOUNTABLE'],
      },
    ],
  },
  blockingIssues: [],
  warnings: [
    {
      code: 'public_audit_responsibility_control_check',
      message: 'Risque audit public: verifier la clarte des responsabilites de controle.',
      severity: 'warning',
    },
  ],
  recommendations: ['Verifier la coherence entre le process owner et les Accountable.'],
  qualityScore: 88,
  validationStatus: 'DRAFT',
  versionNumber: 1,
  generatedAt: previewNow,
  sourceHash: 'preview-raci-hash',
  canValidate: true,
};

const previewBpmn: BpmnResult = {
  ruleVersion: 'process-discovery-bpmn-v1',
  sourceHash: 'preview-bpmn-hash',
  bpmnJson: {
    processId: previewProcess.id,
    tenantId: 'preview-tenant',
    ruleVersion: 'process-discovery-bpmn-v1',
    generatedAt: previewNow,
    sourceHash: 'preview-bpmn-hash',
    participants: [{ id: `participant_${previewProcess.id}`, label: previewProcess.name }],
    lanes: [
      {
        id: 'lane_start',
        label: 'Processus',
        nodeIds: ['event_start', 'event_end'],
        bounds: { x: 40, y: 40, width: 760, height: 110 },
      },
      {
        id: 'lane_responsable',
        label: 'Responsable comptable',
        actorId: '44444444-4444-4444-8444-444444444444',
        nodeIds: ['task_collecter', 'task_valider'],
        bounds: { x: 40, y: 150, width: 760, height: 150 },
      },
    ],
    nodes: [
      {
        id: 'event_start',
        type: 'startEvent',
        label: 'Cloture mensuelle lancee',
        laneId: 'lane_start',
        position: { x: 90, y: 82 },
        metadata: {},
      },
      {
        id: 'task_collecter',
        type: 'userTask',
        label: 'Collecter les justificatifs',
        sourceActivityId: '77777777-7777-4777-8777-777777777777',
        actorId: '44444444-4444-4444-8444-444444444444',
        laneId: 'lane_responsable',
        position: { x: 220, y: 190 },
        metadata: {},
      },
      {
        id: 'task_valider',
        type: 'userTask',
        label: 'Valider le dossier',
        sourceActivityId: '77777777-7777-4777-8777-777777777778',
        actorId: '44444444-4444-4444-8444-444444444444',
        laneId: 'lane_responsable',
        position: { x: 450, y: 190 },
        metadata: {},
      },
      {
        id: 'event_end',
        type: 'endEvent',
        label: 'Etats financiers mensuels',
        laneId: 'lane_start',
        position: { x: 700, y: 82 },
        metadata: {},
      },
    ],
    edges: [
      {
        id: 'flow_start',
        sourceNodeId: 'event_start',
        targetNodeId: 'task_collecter',
        metadata: {},
      },
      {
        id: 'flow_collecter_valider',
        sourceNodeId: 'task_collecter',
        targetNodeId: 'task_valider',
        label: 'Dossier complet',
        metadata: {},
      },
      { id: 'flow_end', sourceNodeId: 'task_valider', targetNodeId: 'event_end', metadata: {} },
    ],
    gateways: [],
    events: [],
    layout: { direction: 'horizontal', spacingX: 180, spacingY: 150 },
    issues: [],
    warnings: [
      {
        code: 'too_many_required_documents',
        message: 'Nombre eleve de documents demandes.',
        severity: 'warning',
      },
    ],
    recommendations: [
      'Verifier que le BPMN correspond au modele structure valide par les utilisateurs.',
    ],
  },
  bpmnXml: '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions></bpmn:definitions>',
  blockingIssues: [],
  warnings: [
    {
      code: 'too_many_required_documents',
      message: 'Nombre eleve de documents demandes.',
      severity: 'warning',
    },
  ],
  recommendations: [
    'Verifier que le BPMN correspond au modele structure valide par les utilisateurs.',
  ],
  validationStatus: 'DRAFT',
  versionNumber: 1,
  generatedAt: previewNow,
  canValidate: true,
};

const previewCompleteness: Completeness = {
  score: 76,
  pointsObtained: 76,
  pointsMax: 100,
  percentage: 76,
  qualityStatus: 'blocked',
  sections: [
    {
      key: 'identification',
      label: 'Identification',
      wizardStep: 1,
      pointsObtained: 10,
      pointsMax: 10,
      percentage: 100,
      status: 'complete',
      missingFields: [],
      blockingIssues: [],
      warnings: [],
      recommendations: [],
    },
    {
      key: 'objective_scope',
      label: 'Objectif et perimetre',
      wizardStep: 2,
      pointsObtained: 12,
      pointsMax: 12,
      percentage: 100,
      status: 'complete',
      missingFields: [],
      blockingIssues: [],
      warnings: [],
      recommendations: [],
    },
    {
      key: 'activities_sequence',
      label: 'Activites',
      wizardStep: 3,
      pointsObtained: 12,
      pointsMax: 16,
      percentage: 75,
      status: 'warning',
      missingFields: ['activity.duration'],
      blockingIssues: [],
      warnings: [
        {
          code: 'activity_without_duration',
          message: 'Activite sans delai indicatif.',
          section: 'activities_sequence',
          severity: 'warning',
          wizardStep: 3,
        },
      ],
      recommendations: ['Completer les delais indicatifs des activites.'],
    },
    {
      key: 'actors_responsibilities',
      label: 'Acteurs',
      wizardStep: 4,
      pointsObtained: 7,
      pointsMax: 14,
      percentage: 50,
      status: 'error',
      missingFields: ['accountable'],
      blockingIssues: [
        {
          code: 'missing_accountable',
          message: 'Une activite est sans Accountable.',
          section: 'actors_responsibilities',
          severity: 'blocking',
          wizardStep: 4,
        },
      ],
      warnings: [],
      recommendations: ["Verifier la presence d'un Accountable unique par activite."],
    },
    {
      key: 'controls',
      label: 'Controles',
      wizardStep: 8,
      pointsObtained: 0,
      pointsMax: 5,
      percentage: 0,
      status: 'warning',
      missingFields: ['controls'],
      blockingIssues: [],
      warnings: [
        {
          code: 'missing_control',
          message: 'Aucun controle declare ou risque non couvert.',
          section: 'controls',
          severity: 'warning',
          wizardStep: 8,
        },
      ],
      recommendations: ['Associer un controle aux risques critiques.'],
    },
  ],
  sectionScores: {
    identification: 10,
    objective_scope: 12,
    inputs_outputs: 10,
    activities_sequence: 12,
    actors_responsibilities: 7,
    documents: 6,
    applications: 5,
    kpi: 8,
    risks: 7,
    controls: 0,
    validation_evidence: 7,
  },
  sectionPercentages: {
    identification: 100,
    objective_scope: 100,
    inputs_outputs: 100,
    activities_sequence: 75,
    actors_responsibilities: 50,
    documents: 100,
    applications: 100,
    kpi: 100,
    risks: 100,
    controls: 0,
    validation_evidence: 100,
  },
  missingFields: ['accountable', 'controls'],
  blockingIssues: ['missing_accountable'],
  blockingIssueDetails: [
    {
      code: 'missing_accountable',
      message: 'Une activite est sans Accountable.',
      section: 'actors_responsibilities',
      severity: 'blocking',
      wizardStep: 4,
    },
  ],
  warnings: ['missing_control', 'activity_without_duration'],
  warningDetails: [
    {
      code: 'missing_control',
      message: 'Aucun controle declare ou risque non couvert.',
      section: 'controls',
      severity: 'warning',
      wizardStep: 8,
    },
    {
      code: 'activity_without_duration',
      message: 'Activite sans delai indicatif.',
      section: 'activities_sequence',
      severity: 'warning',
      wizardStep: 3,
    },
  ],
  recommendations: ['Ajouter un Accountable et lier un controle au risque principal.'],
  canSubmit: false,
  scoringRuleVersion: 'lot6-preview',
  calculatedAt: previewNow,
  sourceLockVersion: 3,
};

const previewWorkshopOverview: WorkshopOverview = {
  process: {
    id: previewProcess.id,
    name: previewProcess.name,
    code: previewProcess.code,
    description: previewProcess.description,
    direction: previewProcess.direction,
    owner: previewProcess.ownerActor,
    status: previewProcess.status,
    publication_status: 'UNPUBLISHED',
    completeness_score: Number(previewProcess.completenessScore),
    updated_at: previewProcess.updatedAt,
    lock_version: previewProcess.lockVersion,
  },
  quality: previewCompleteness,
  raci: {
    status: previewRaci.validationStatus,
    score: previewRaci.qualityScore,
    version: previewRaci.versionNumber,
    generated_at: previewRaci.generatedAt,
  },
  bpmn: {
    status: previewBpmn.validationStatus,
    version: previewBpmn.versionNumber,
    generated_at: previewBpmn.generatedAt,
    blocking_issues: previewBpmn.blockingIssues.length,
    warnings: previewBpmn.warnings.length,
  },
  morocco: {
    is_user_facing_process: true,
    law_55_19_applicable: true,
    target_channel: 'Digital',
  },
  workflow: { status: previewProcess.status, current_published_version: null },
  alerts: {
    blocking: previewCompleteness.blockingIssueDetails ?? [],
    warnings: previewCompleteness.warningDetails ?? [],
    recommendations: previewCompleteness.recommendations,
  },
  actions: {
    open_wizard: true,
    submit: false,
    open_review: true,
    generate_bpmn: true,
    generate_raci: true,
    recalculate_quality: true,
    export_available: true,
    back_to_list: true,
  },
};

const previewWorkshopProcedure: WorkshopProcedure = {
  status: 'draft_deterministic',
  disclaimer: 'Structure deterministe a valider humainement avant toute procedure officielle.',
  sections: [
    {
      key: 'objet',
      title: 'Objet',
      content: previewProcess.objective,
      source: 'deterministic',
      editable: false,
    },
    {
      key: 'perimetre',
      title: 'Perimetre',
      content: previewProcess.scope,
      source: 'deterministic',
      editable: false,
    },
    {
      key: 'activites',
      title: 'Description des activites',
      content: previewProcess.activities,
      source: 'deterministic',
      editable: false,
    },
    {
      key: 'kpi',
      title: 'KPI',
      content: previewProcess.kpis,
      source: 'deterministic',
      editable: false,
    },
    {
      key: 'risques',
      title: 'Risques',
      content: previewProcess.risks,
      source: 'deterministic',
      editable: false,
    },
    {
      key: 'enregistrements',
      title: 'Enregistrements',
      content: [],
      source: 'editable',
      editable: true,
    },
  ],
};

const previewProcedure: ProcedureDocument = {
  id: 'preview-procedure',
  reference: 'PROC-FIN-CLOT-V1',
  title: 'Procedure - Cloture comptable mensuelle',
  status: 'draft',
  versionNumber: 1,
  ruleVersion: 'process-discovery-procedure-v1',
  sourceHash: 'preview-procedure-hash',
  confidentialityLevel: 'internal',
  sections: [
    {
      id: 'proc-sec-identification',
      sectionKey: 'identification',
      title: 'Identification documentaire',
      content: { procedure_reference: 'PROC-FIN-CLOT-V1' },
      source: 'deterministic',
      status: 'draft',
      order: 1,
    },
    {
      id: 'proc-sec-objet',
      sectionKey: 'objet',
      title: 'Objet',
      content: previewProcess.objective,
      source: 'deterministic',
      status: 'draft',
      order: 2,
    },
    {
      id: 'proc-sec-perimetre',
      sectionKey: 'perimetre',
      title: 'Perimetre',
      content: previewProcess.scope,
      source: 'deterministic',
      status: 'draft',
      order: 3,
    },
    {
      id: 'proc-sec-resp',
      sectionKey: 'responsabilites',
      title: 'Responsabilites',
      content: previewProcess.actorRoles,
      source: 'deterministic',
      status: 'draft',
      order: 6,
    },
    {
      id: 'proc-sec-activites',
      sectionKey: 'activites',
      title: 'Description des activites',
      content: previewProcess.activities,
      source: 'deterministic',
      status: 'draft',
      order: 9,
    },
    {
      id: 'proc-sec-kpi',
      sectionKey: 'kpi',
      title: 'KPI',
      content: previewProcess.kpis,
      source: 'deterministic',
      status: 'draft',
      order: 12,
    },
    {
      id: 'proc-sec-risk',
      sectionKey: 'risques_controles',
      title: 'Risques et controles',
      content: previewProcess.risks,
      source: 'deterministic',
      status: 'draft',
      order: 13,
    },
    {
      id: 'proc-sec-maroc',
      sectionKey: 'conformite_maroc',
      title: 'Exigences administratives et conformite Maroc',
      content: previewProcess.moroccoCompliance,
      source: 'deterministic',
      status: 'draft',
      order: 14,
    },
    {
      id: 'proc-sec-preuves',
      sectionKey: 'preuves',
      title: 'Enregistrements et preuves',
      content: [],
      source: 'manual',
      status: 'draft',
      order: 16,
    },
  ],
  approvals: [],
};

const previewProcedureVersions: ProcedureVersion[] = [
  {
    id: 'preview-procedure-version',
    versionNumber: 1,
    status: 'published',
    sourceHash: 'preview-procedure-hash',
    snapshot: previewProcedure,
    createdAt: previewNow,
  },
];

const previewExportJobs: ExportJob[] = [
  {
    id: 'preview-export-completed',
    processId: previewProcess.id,
    exportType: 'process_sheet',
    format: 'PDF',
    status: 'COMPLETED',
    fileName: 'process_sheet-preview.pdf',
    size: 2048,
    checksum: 'preview-checksum',
    createdAt: previewNow,
    completedAt: previewNow,
  },
  {
    id: 'preview-export-pending',
    processId: previewProcess.id,
    exportType: 'procedure',
    format: 'DOCX',
    status: 'PENDING',
    fileName: null,
    createdAt: previewNow,
  },
];

const previewNotifications: TenantNotification[] = [
  {
    id: 'preview-notification-export',
    type: 'export_completed',
    title: 'Export pret',
    message: 'Le dossier documentaire du processus est disponible.',
    severity: 'success',
    status: 'unread',
    action_url: '/tenant/exports',
    resource_type: 'export_jobs',
    resource_id: 'preview-export-completed',
    created_at: previewNow,
  },
  {
    id: 'preview-notification-quality',
    type: 'quality_blocking_issue',
    title: 'Point qualite bloquant',
    message: 'Une responsabilite RACI reste a clarifier avant validation.',
    severity: 'warning',
    status: 'unread',
    action_url: `/tenant/processes/${previewProcess.id}/workshop`,
    resource_type: 'processes',
    resource_id: previewProcess.id,
    created_at: previewNow,
  },
];

const previewTasks: TenantTask[] = [
  {
    id: 'preview-task-complete',
    title: 'Completer les justificatifs de cloture',
    description: 'Ajouter les pieces manquantes et verifier le circuit de validation.',
    status: 'open',
    priority: 'high',
    due_date: previewNow,
    process_id: previewProcess.id,
    action_url: `/tenant/processes/${previewProcess.id}/wizard`,
    created_at: previewNow,
  },
];

const previewActivity: TenantActivity[] = [
  {
    id: 'preview-activity-submit',
    actor_user_id: 'preview-user',
    action: 'process_submitted',
    resource_type: 'processes',
    resource_id: previewProcess.id,
    result: 'success',
    created_at: previewNow,
  },
  {
    id: 'preview-activity-export',
    actor_user_id: 'preview-user',
    action: 'export_completed',
    resource_type: 'export_jobs',
    resource_id: 'preview-export-completed',
    result: 'success',
    created_at: previewNow,
  },
];

const previewPreferences: NotificationPreferences = {
  in_app_enabled: true,
  email_enabled: false,
  frequency: 'immediate',
  language: 'fr',
  quiet_hours_start: '19:00',
  quiet_hours_end: '08:00',
  disabled_types: [],
};

const previewWorkshopBacklog: WorkshopBacklog = {
  items: [
    {
      id: 'quality-missing-accountable',
      title: 'Ajouter un Accountable sur les activites incompletes.',
      type: 'quality',
      source: 'Controle qualite',
      priority: 'HIGH',
      impact: 'Eleve',
      complexity: 'Faible',
      status: 'OPEN',
    },
    {
      id: 'automation-reconciliation',
      title: 'Rapprochement automatique',
      type: 'automation',
      source: 'Besoins automatisation',
      priority: 'MEDIUM',
      impact: 'Moyen',
      complexity: 'Moyenne',
      status: 'OPEN',
    },
  ],
};

const previewWorkshopVersions: WorkshopVersions = {
  published_versions: [],
  snapshots: [{ id: 'preview-snapshot', snapshotHash: 'preview-hash', createdAt: previewNow }],
  raci_versions: [{ id: 'preview-raci-version', versionNumber: 1, createdAt: previewNow }],
  bpmn_versions: [{ id: 'preview-bpmn-version', versionNumber: 1, createdAt: previewNow }],
  procedure_versions: [],
};

const previewWorkshopComments: WorkshopComment[] = [
  {
    id: 'preview-comment',
    body: 'Verifier les responsabilites avant soumission.',
    status: 'open',
    createdAt: previewNow,
  },
];

const previewAiSuggestions: AiSuggestion[] = [
  {
    id: 'preview-ai-suggestion-kpi',
    suggestionType: 'kpi',
    status: 'PROPOSED',
    createdAt: previewNow,
    content: {
      category: 'kpi_suggestions',
      title: 'Delai moyen de cloture',
      description: 'Suivre le nombre de jours entre la fin de mois et la validation comptable.',
      targetEntity: 'kpi',
      priority: 'medium',
      rationale: 'Le delai est un indicateur lisible pour piloter la performance du processus.',
      requiresHumanValidation: true,
    },
  },
  {
    id: 'preview-ai-suggestion-risk',
    suggestionType: 'risk',
    status: 'ACCEPTED',
    createdAt: previewNow,
    content: {
      category: 'risk_suggestions',
      title: 'Risque de justificatifs incomplets',
      description: 'Prevoir un controle humain avant consolidation du dossier de cloture.',
      targetEntity: 'risk',
      priority: 'high',
      rationale: 'Les donnees manquantes peuvent retarder ou fragiliser la validation.',
      requiresHumanValidation: true,
    },
  },
];

const previewAiGenerations: AiGeneration[] = [
  {
    id: 'preview-ai-generation',
    provider: 'mock-ai',
    purpose: 'kpi_suggestions',
    model: 'mock-deterministic-v1',
    output: { summary: 'Suggestions IA mock a valider humainement.' },
    createdAt: previewNow,
    suggestions: previewAiSuggestions,
  },
];

function authHeaders() {
  const token = localStorage.getItem('pda_access_token');
  const grantId = localStorage.getItem('pda_support_grant_id');
  return {
    ...(isUsableAccessToken(token) ? { Authorization: `Bearer ${token}` } : {}),
    ...(grantId ? { 'x-support-grant-id': grantId } : {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  for (const [key, value] of Object.entries(authHeaders())) headers.set(key, value);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
  if (!response.ok) throw new Error(await response.text());
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function requestBlob(path: string): Promise<{ blob: Blob; filename?: string }> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(authHeaders())) headers.set(key, value);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers,
  });
  if (!response.ok) throw new Error(await response.text());
  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(response.headers.get('content-disposition')),
  };
}

function filenameFromDisposition(value: string | null) {
  const match = value?.match(/filename="?([^"]+)"?/i);
  return match?.[1];
}

export async function downloadBlobFile(
  download: Promise<{ blob: Blob; filename?: string }>,
  fallbackFilename: string,
) {
  const { blob, filename } = await download;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename ?? fallbackFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function params(filters: DirectionFilters) {
  const search = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) search.set(key, String(value));
  });
  return search.toString();
}

export const tenantApi = {
  summary: (filters: DirectionFilters) =>
    isUiPreviewMode()
      ? Promise.resolve({
          directions: 1,
          processes: 1,
          draft_processes: previewProcess.status === 'DRAFT' ? 1 : 0,
          submitted_processes: 0,
          correction_processes: 0,
          validated_processes: 0,
          average_completeness: Number(previewProcess.completenessScore),
          pending_validations: 0,
          critical_risks: 1,
          automation_opportunities: 1,
        })
      : request<TenantSummary>(`/tenant/dashboard/summary?${params(filters)}`),
  progressByDirection: (filters: DirectionFilters) =>
    isUiPreviewMode()
      ? Promise.resolve([
          {
            id: previewDirection.id,
            name: previewDirection.name,
            code: previewDirection.code,
            processes: previewDirection.processes,
            validated_processes: previewDirection.validated_processes,
            average_completeness: previewDirection.average_completeness,
            campaign_progress: previewDirection.campaign_progress,
            progress: previewDirection.progression,
          },
        ])
      : request<DirectionProgress[]>(`/tenant/dashboard/progress-by-direction?${params(filters)}`),
  statusDistribution: (filters: DirectionFilters) =>
    isUiPreviewMode()
      ? Promise.resolve([{ label: previewProcess.status, count: 1 }])
      : request<DistributionItem[]>(
          `/tenant/dashboard/process-status-distribution?${params(filters)}`,
        ),
  categoryDistribution: (filters: DirectionFilters) =>
    isUiPreviewMode()
      ? Promise.resolve([{ label: previewProcess.category?.name ?? 'Metier', count: 1 }])
      : request<DistributionItem[]>(
          `/tenant/dashboard/process-category-distribution?${params(filters)}`,
        ),
  risksByCriticality: () =>
    isUiPreviewMode()
      ? Promise.resolve([{ label: 'Critique', count: 1 }])
      : request<DistributionItem[]>('/tenant/dashboard/risks-by-criticality'),
  maturityOverview: (filters: DirectionFilters) =>
    isUiPreviewMode()
      ? Promise.resolve([{ label: 'Brouillon', count: Number(previewProcess.completenessScore) }])
      : request<DistributionItem[]>(`/tenant/dashboard/maturity-overview?${params(filters)}`),
  actionsPriority: (filters: DirectionFilters) =>
    isUiPreviewMode()
      ? Promise.resolve([
          {
            process_id: previewProcess.id,
            process_name: previewProcess.name,
            direction_name: previewDirection.name,
            status: previewProcess.status,
            completeness_score: Number(previewProcess.completenessScore),
            priority: 'Haute',
          },
        ])
      : request<PriorityAction[]>(`/tenant/dashboard/actions-priority?${params(filters)}`),
  directions: (filters: DirectionFilters) =>
    isUiPreviewMode()
      ? Promise.resolve({
          page: filters.page ?? 1,
          page_size: 20,
          total: 1,
          items: [previewDirection],
        })
      : request<DirectionListResponse>(`/tenant/directions?${params(filters)}`),
  direction: (id: string) => request<DirectionItem>(`/tenant/directions/${id}`),
  createDirection: (payload: Record<string, unknown>) =>
    request('/tenant/directions', { method: 'POST', body: JSON.stringify(payload) }),
  updateDirection: (id: string, payload: Record<string, unknown>) =>
    request(`/tenant/directions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteDirection: (id: string) => request(`/tenant/directions/${id}`, { method: 'DELETE' }),
  assignReferent: (id: string, userId: string) =>
    request(`/tenant/directions/${id}/assign-referent`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
  removeReferent: (id: string, userId: string) =>
    request(`/tenant/directions/${id}/remove-referent`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
  remindReferent: (id: string, message?: string) =>
    request(`/tenant/directions/${id}/remind-referent`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  directionActivity: (id: string) =>
    request<{ id: string; action: string; created_at: string }[]>(
      `/tenant/directions/${id}/activity`,
    ),
  directionProcesses: (id: string) =>
    request<
      { id: string; name: string; status: string; completenessScore: string; updatedAt: string }[]
    >(`/tenant/directions/${id}/processes`),
  downloadDirectionsCsv: () => requestBlob('/tenant/directions/export.csv'),
  processes: (filters: {
    search?: string;
    status?: string;
    direction_id?: string;
    is_user_facing_process?: string;
    law_55_19_applicable?: string;
    simplification_priority?: string;
    digitalization_priority?: string;
  }) =>
    isUiPreviewMode()
      ? Promise.resolve(
          previewProcess.name.toLowerCase().includes((filters.search ?? '').toLowerCase()) &&
            (!filters.is_user_facing_process ||
              String(previewProcess.moroccoCompliance?.isUserFacingProcess) ===
                filters.is_user_facing_process) &&
            (!filters.law_55_19_applicable ||
              String(previewProcess.moroccoCompliance?.law5519Applicable) ===
                filters.law_55_19_applicable)
            ? [previewProcess]
            : [],
        )
      : request<ProcessItem[]>(`/tenant/processes?${params(filters)}`),
  process: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewProcess, id })
      : request<ProcessItem>(`/tenant/processes/${id}`),
  createProcess: (payload: Record<string, unknown>) =>
    request<ProcessItem>('/tenant/processes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProcess: (id: string, payload: Record<string, unknown>) =>
    request<ProcessItem>(`/tenant/processes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  moroccoCompliance: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve(previewProcess.moroccoCompliance ?? null)
      : request<MoroccoCompliance | null>(`/tenant/processes/${id}/morocco-compliance`),
  updateMoroccoCompliance: (id: string, payload: Record<string, unknown>) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewProcess.moroccoCompliance, ...payload })
      : request<MoroccoCompliance>(`/tenant/processes/${id}/morocco-compliance`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        }),
  createPublicAuditRisk: (id: string, payload: Record<string, unknown>) =>
    request(`/tenant/processes/${id}/public-audit-risks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  eventLogs: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve<EventLogImport[]>([
          {
            id: 'preview-import',
            fileName: 'journal-usager.csv',
            status: 'ANALYZED',
            rowCount: 4,
            createdAt: previewNow,
            basicAnalysis: {
              cases: 2,
              events: 4,
              distinct_activities: 3,
              average_case_duration_seconds: 14400,
            },
          },
        ])
      : request<EventLogImport[]>(`/tenant/processes/${id}/event-logs`),
  importEventLogCsv: (id: string, payload: Record<string, unknown>) =>
    isUiPreviewMode()
      ? Promise.resolve<EventLogImport>({
          id: 'preview-import',
          fileName: String(payload.file_name ?? 'event-log.csv'),
          status: 'VALIDATED',
          rowCount: 3,
          createdAt: new Date().toISOString(),
        })
      : request<EventLogImport>(`/tenant/processes/${id}/event-logs/import-csv`, {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
  analyzeEventLogBasic: (id: string, importId: string) =>
    isUiPreviewMode()
      ? Promise.resolve({
          cases: 2,
          events: 4,
          distinct_activities: 3,
          average_case_duration_seconds: 14400,
          median_case_duration_seconds: 14400,
          most_frequent_activity: { name: 'Depot dossier', count: 2 },
          paths: [{ path: 'Depot dossier > Instruction > Decision', count: 2 }],
          loops: 0,
          bottlenecks: [{ transition: 'Instruction -> Decision', average_duration_seconds: 10800 }],
          advanced_worker_message: 'Analyse avancee par worker Python optionnel a venir',
          bpmn_export_format: 'BPMN_2_0',
          compatibility: ['Camunda', 'Bizagi', 'Signavio'],
        })
      : request(`/tenant/processes/${id}/event-logs/${importId}/analyze-basic`, {
          method: 'POST',
        }),
  raci: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve(previewRaci)
      : request<RaciResult>(`/tenant/processes/${id}/raci`),
  generateRaci: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve(previewRaci)
      : request<RaciResult>(`/tenant/processes/${id}/raci/generate`, { method: 'POST' }),
  recalculateRaci: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewRaci, generatedAt: new Date().toISOString() })
      : request<RaciResult>(`/tenant/processes/${id}/raci/recalculate`, { method: 'POST' }),
  updateRaciResponsibilities: (id: string, payload: Record<string, unknown>) =>
    request<RaciResult>(`/tenant/processes/${id}/raci/responsibilities`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  validateRaci: (id: string, comment?: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewRaci, validationStatus: 'VALIDATED' })
      : request<RaciResult>(`/tenant/processes/${id}/raci/validate`, {
          method: 'POST',
          body: JSON.stringify({ comment }),
        }),
  invalidateRaci: (id: string, comment?: string) =>
    request<RaciResult>(`/tenant/processes/${id}/raci/invalidate`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    }),
  raciHistory: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve([
          { id: 'preview-history', action: 'raci_generated', createdAt: previewNow },
        ])
      : request<{ id: string; action: string; createdAt: string }[]>(
          `/tenant/processes/${id}/raci/history`,
        ),
  raciVersions: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve([{ id: 'preview-version', versionNumber: 1, createdAt: previewNow }])
      : request<{ id: string; versionNumber: number; createdAt: string }[]>(
          `/tenant/processes/${id}/raci/versions`,
        ),
  downloadRaciCsv: (id: string) => requestBlob(`/tenant/processes/${id}/raci/export.csv`),
  bpmn: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve(previewBpmn)
      : request<BpmnResult>(`/tenant/processes/${id}/bpmn`),
  generateBpmn: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve(previewBpmn)
      : request<BpmnResult>(`/tenant/processes/${id}/bpmn/generate`, { method: 'POST' }),
  recalculateBpmn: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewBpmn, generatedAt: new Date().toISOString() })
      : request<BpmnResult>(`/tenant/processes/${id}/bpmn/recalculate`, { method: 'POST' }),
  validateBpmn: (id: string, comment?: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewBpmn, validationStatus: 'VALIDATED' })
      : request<BpmnResult>(`/tenant/processes/${id}/bpmn/validate`, {
          method: 'POST',
          body: JSON.stringify({ comment }),
        }),
  invalidateBpmn: (id: string, comment?: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewBpmn, validationStatus: 'INVALIDATED' })
      : request<BpmnResult>(`/tenant/processes/${id}/bpmn/invalidate`, {
          method: 'POST',
          body: JSON.stringify({ comment }),
        }),
  bpmnHistory: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve([
          { id: 'preview-bpmn-history', action: 'bpmn_generated', createdAt: previewNow },
        ])
      : request<{ id: string; action: string; createdAt: string }[]>(
          `/tenant/processes/${id}/bpmn/history`,
        ),
  bpmnVersions: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve([{ id: 'preview-bpmn-version', versionNumber: 1, createdAt: previewNow }])
      : request<{ id: string; versionNumber: number; createdAt: string }[]>(
          `/tenant/processes/${id}/bpmn/versions`,
        ),
  downloadBpmnXml: (id: string) => requestBlob(`/tenant/processes/${id}/bpmn/export.xml`),
  downloadBpmnJson: (id: string) => requestBlob(`/tenant/processes/${id}/bpmn/export.json`),
  workshopOverview: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve({
          ...previewWorkshopOverview,
          process: { ...previewWorkshopOverview.process, id },
        })
      : request<WorkshopOverview>(`/tenant/processes/${id}/workshop/overview`),
  workshopQuality: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve(previewCompleteness)
      : request<Completeness>(`/tenant/processes/${id}/workshop/quality`),
  workshopProcedure: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve(previewWorkshopProcedure)
      : request<WorkshopProcedure>(`/tenant/processes/${id}/workshop/procedure`),
  procedure: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve(previewProcedure)
      : request<ProcedureDocument | null>(`/tenant/processes/${id}/procedure`),
  generateProcedure: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve(previewProcedure)
      : request<ProcedureDocument>(`/tenant/processes/${id}/procedure/generate`, {
          method: 'POST',
        }),
  updateProcedure: (id: string, payload: Record<string, unknown>) =>
    request<ProcedureDocument>(`/tenant/processes/${id}/procedure`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  updateProcedureSection: (id: string, sectionId: string, payload: Record<string, unknown>) =>
    isUiPreviewMode()
      ? Promise.resolve({
          ...previewProcedure.sections[0],
          id: sectionId,
          source: 'manual',
          content: payload.content,
        })
      : request<ProcedureSection>(`/tenant/processes/${id}/procedure/sections/${sectionId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }),
  submitProcedureReview: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewProcedure, status: 'in_review' })
      : request<ProcedureDocument>(`/tenant/processes/${id}/procedure/submit-review`, {
          method: 'POST',
        }),
  requestProcedureChanges: (id: string, comment: string) =>
    request<ProcedureDocument>(`/tenant/processes/${id}/procedure/request-changes`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    }),
  approveProcedure: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewProcedure, status: 'approved' })
      : request<ProcedureDocument>(`/tenant/processes/${id}/procedure/approve`, {
          method: 'POST',
          body: JSON.stringify({}),
        }),
  publishProcedure: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewProcedure, status: 'published', publishedAt: previewNow })
      : request<ProcedureDocument>(`/tenant/processes/${id}/procedure/publish`, {
          method: 'POST',
          body: JSON.stringify({}),
        }),
  archiveProcedure: (id: string, comment: string) =>
    request<ProcedureDocument>(`/tenant/processes/${id}/procedure/archive`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    }),
  procedureVersions: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve(previewProcedureVersions)
      : request<ProcedureVersion[]>(`/tenant/processes/${id}/procedure/versions`),
  procedureDiff: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ current_status: previewProcedure.status, changed: false })
      : request<Record<string, unknown>>(`/tenant/processes/${id}/procedure/diff`),
  generateProcedureAiDraft: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ id: 'preview-ai-procedure-draft', suggestionType: 'procedure_draft' })
      : request(`/tenant/processes/${id}/procedure/generate-ai-draft`, { method: 'POST' }),
  exports: () =>
    isUiPreviewMode()
      ? Promise.resolve(previewExportJobs)
      : request<ExportJob[]>('/tenant/exports'),
  createExport: (payload: {
    export_type: ExportType;
    export_format: ExportFormat;
    process_id?: string;
    direction_id?: string;
  }) =>
    isUiPreviewMode()
      ? Promise.resolve<ExportJob>({
          ...previewExportJobs[0],
          id: `preview-export-${Date.now()}`,
          exportType: payload.export_type,
          format: payload.export_format.toUpperCase(),
          status: 'COMPLETED',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        })
      : request<ExportJob>('/tenant/exports', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
  exportJob: (id: string) => request<ExportJob>(`/tenant/exports/${id}`),
  cancelExport: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewExportJobs[1], id, status: 'CANCELLED' })
      : request<ExportJob>(`/tenant/exports/${id}/cancel`, { method: 'POST' }),
  retryExport: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewExportJobs[0], id, status: 'COMPLETED' })
      : request<ExportJob>(`/tenant/exports/${id}/retry`, { method: 'POST' }),
  exportDownloadUrl: (id: string) => `${API_BASE_URL}/tenant/exports/${id}/download`,
  downloadExport: (id: string) => requestBlob(`/tenant/exports/${id}/download`),
  notifications: () =>
    isUiPreviewMode()
      ? Promise.resolve({
          page: 1,
          page_size: 20,
          total: previewNotifications.length,
          items: previewNotifications,
        })
      : request<{ page: number; page_size: number; total: number; items: TenantNotification[] }>(
          '/tenant/notifications',
        ),
  unreadNotifications: () =>
    isUiPreviewMode()
      ? Promise.resolve({
          unread_count: previewNotifications.filter((item) => item.status === 'unread').length,
        })
      : request<{ unread_count: number }>('/tenant/notifications/unread-count'),
  readNotification: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve<TenantNotification>({
          ...previewNotifications[0]!,
          id,
          status: 'read',
          read_at: new Date().toISOString(),
        })
      : request<TenantNotification>(`/tenant/notifications/${id}/read`, { method: 'POST' }),
  readAllNotifications: () =>
    isUiPreviewMode()
      ? Promise.resolve({ updated: previewNotifications.length })
      : request<{ updated: number }>('/tenant/notifications/read-all', { method: 'POST' }),
  notificationPreferences: () =>
    isUiPreviewMode()
      ? Promise.resolve(previewPreferences)
      : request<NotificationPreferences>('/tenant/notification-preferences'),
  updateNotificationPreferences: (payload: Partial<NotificationPreferences>) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewPreferences, ...payload })
      : request<NotificationPreferences>('/tenant/notification-preferences', {
          method: 'PUT',
          body: JSON.stringify(payload),
        }),
  activity: (filters: Record<string, string> = {}) =>
    isUiPreviewMode()
      ? Promise.resolve(previewActivity)
      : request<TenantActivity[]>(`/tenant/activity?${params(filters)}`),
  audit: (filters: Record<string, string> = {}) =>
    isUiPreviewMode()
      ? Promise.resolve(previewActivity)
      : request<TenantActivity[]>(`/tenant/audit?${params(filters)}`),
  downloadAuditCsv: () => requestBlob('/tenant/audit/export.csv'),
  tasks: (filters: Record<string, string> = {}) =>
    isUiPreviewMode()
      ? Promise.resolve(previewTasks)
      : request<TenantTask[]>(`/tenant/tasks?${params(filters)}`),
  createTask: (payload: Record<string, unknown>) =>
    isUiPreviewMode()
      ? Promise.resolve<TenantTask>({
          ...previewTasks[0]!,
          id: `preview-task-${Date.now()}`,
          title: String(payload.title ?? previewTasks[0]!.title),
          created_at: new Date().toISOString(),
        })
      : request<TenantTask>('/tenant/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  completeTask: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewTasks[0], id, status: 'completed' })
      : request<TenantTask>(`/tenant/tasks/${id}/complete`, { method: 'POST' }),
  myActions: () =>
    isUiPreviewMode()
      ? Promise.resolve<MyActions>({
          tasks: previewTasks,
          notifications: previewNotifications,
          exports_ready: previewExportJobs.filter((job) => job.status === 'COMPLETED'),
          processes_to_complete: [
            {
              id: previewProcess.id,
              name: previewProcess.name,
              status: previewProcess.status,
              completenessScore: previewProcess.completenessScore,
            },
          ],
        })
      : request<MyActions>('/tenant/my-actions'),
  workshopBacklog: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve(previewWorkshopBacklog)
      : request<WorkshopBacklog>(`/tenant/processes/${id}/workshop/backlog`),
  workshopVersions: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve(previewWorkshopVersions)
      : request<WorkshopVersions>(`/tenant/processes/${id}/workshop/versions`),
  workshopAudit: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve([{ id: 'preview-audit', action: 'workshop_viewed', createdAt: previewNow }])
      : request<{ id: string; action: string; createdAt: string }[]>(
          `/tenant/processes/${id}/workshop/audit`,
        ),
  comments: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve(previewWorkshopComments)
      : request<WorkshopComment[]>(`/tenant/processes/${id}/comments`),
  createComment: (id: string, body: string, section?: string) =>
    isUiPreviewMode()
      ? Promise.resolve<WorkshopComment>({
          id: `preview-comment-${Date.now()}`,
          body,
          status: 'open',
          resourceType: section ?? null,
          createdAt: new Date().toISOString(),
        })
      : request<WorkshopComment>(`/tenant/processes/${id}/comments`, {
          method: 'POST',
          body: JSON.stringify({ body, section }),
        }),
  resolveComment: (id: string, commentId: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewWorkshopComments[0], id: commentId, status: 'resolved' })
      : request<WorkshopComment>(`/tenant/processes/${id}/comments/${commentId}/resolve`, {
          method: 'POST',
        }),
  generateAi: (id: string, generationType: AiGenerationType): Promise<AiGenerateResponse> =>
    isUiPreviewMode()
      ? Promise.resolve({
          generation: { ...previewAiGenerations[0], purpose: generationType },
          suggestions: previewAiSuggestions.map((suggestion) => ({
            ...suggestion,
            content: { ...suggestion.content, category: generationType },
          })),
        } as AiGenerateResponse)
      : request<AiGenerateResponse>(`/tenant/processes/${id}/ai/generate`, {
          method: 'POST',
          body: JSON.stringify({ generation_type: generationType }),
        }),
  aiGenerations: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve(previewAiGenerations)
      : request<AiGeneration[]>(`/tenant/processes/${id}/ai/generations`),
  aiGeneration: (id: string, generationId: string) =>
    request<AiGeneration>(`/tenant/processes/${id}/ai/generations/${generationId}`),
  aiSuggestions: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve(previewAiSuggestions)
      : request<AiSuggestion[]>(`/tenant/processes/${id}/ai/suggestions`),
  acceptAiSuggestion: (id: string, suggestionId: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewAiSuggestions[0], id: suggestionId, status: 'ACCEPTED' })
      : request<AiSuggestion>(`/tenant/processes/${id}/ai/suggestions/${suggestionId}/accept`, {
          method: 'POST',
        }),
  rejectAiSuggestion: (id: string, suggestionId: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewAiSuggestions[0], id: suggestionId, status: 'REJECTED' })
      : request<AiSuggestion>(`/tenant/processes/${id}/ai/suggestions/${suggestionId}/reject`, {
          method: 'POST',
        }),
  modifyAiSuggestion: (id: string, suggestionId: string, content: Record<string, unknown>) =>
    isUiPreviewMode()
      ? Promise.resolve({
          ...previewAiSuggestions[0],
          id: suggestionId,
          content,
          status: 'MODIFIED',
        })
      : request<AiSuggestion>(`/tenant/processes/${id}/ai/suggestions/${suggestionId}/modify`, {
          method: 'POST',
          body: JSON.stringify({ content }),
        }),
  validateAiSuggestion: (id: string, suggestionId: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewAiSuggestions[0], id: suggestionId, status: 'VALIDATED' })
      : request<AiSuggestion>(`/tenant/processes/${id}/ai/suggestions/${suggestionId}/validate`, {
          method: 'POST',
        }),
  createKpiFromAiSuggestion: (id: string, suggestionId: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ id: `preview-kpi-${suggestionId}` })
      : request(`/tenant/processes/${id}/ai/suggestions/${suggestionId}/create-kpi`, {
          method: 'POST',
          body: JSON.stringify({}),
        }),
  createRiskFromAiSuggestion: (id: string, suggestionId: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ id: `preview-risk-${suggestionId}` })
      : request(`/tenant/processes/${id}/ai/suggestions/${suggestionId}/create-risk`, {
          method: 'POST',
        }),
  createControlFromAiSuggestion: (id: string, suggestionId: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ id: `preview-control-${suggestionId}` })
      : request(`/tenant/processes/${id}/ai/suggestions/${suggestionId}/create-control`, {
          method: 'POST',
        }),
  createBacklogFromAiSuggestion: (id: string, suggestionId: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ id: `preview-backlog-${suggestionId}` })
      : request(`/tenant/processes/${id}/ai/suggestions/${suggestionId}/create-backlog-item`, {
          method: 'POST',
        }),
  insertProcedureDraftFromAiSuggestion: (id: string, suggestionId: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ id: `preview-procedure-${suggestionId}` })
      : request(`/tenant/processes/${id}/ai/suggestions/${suggestionId}/insert-procedure-draft`, {
          method: 'POST',
        }),
  deleteProcess: (id: string) => request(`/tenant/processes/${id}`, { method: 'DELETE' }),
  wizard: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve({
          process: { ...previewProcess, id },
          steps: [
            'Identification',
            'Description',
            'Activites',
            'Acteurs et responsabilites',
            'Documents',
            'Applications',
            'KPI',
            'Risques et controles',
            'Points de douleur',
            "Besoins d'automatisation",
            'Resume et soumission',
          ],
          completeness: previewCompleteness,
        })
      : request<WizardResponse>(`/tenant/processes/${id}/wizard`),
  saveWizardStep: (
    id: string,
    step: number,
    payload: Record<string, unknown>,
    lockVersion?: number,
  ) =>
    request<{ lock_version: number; saved_at: string; completeness: Completeness }>(
      `/tenant/processes/${id}/wizard/${step}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ lock_version: lockVersion, payload }),
      },
    ),
  recalculateCompleteness: (id: string) =>
    isUiPreviewMode()
      ? Promise.resolve({ ...previewCompleteness, calculatedAt: new Date().toISOString() })
      : request<Completeness>(`/tenant/processes/${id}/completeness/recalculate`, {
          method: 'POST',
        }),
  submitProcess: (id: string, lockVersion?: number, comment?: string) =>
    isUiPreviewMode()
      ? Promise.resolve({
          ...previewProcess,
          id,
          status: 'SUBMITTED',
          lockVersion: lockVersion ?? 4,
        })
      : request<ProcessItem>(`/tenant/processes/${id}/submit`, {
          method: 'POST',
          body: JSON.stringify({ lock_version: lockVersion, comment }),
        }),
};

export function hasTenantAccess() {
  if (isDemoAuthBypassEnabled()) return true;
  const token = localStorage.getItem('pda_access_token');
  if (!token && isUiPreviewMode()) return true;
  return Boolean(isUsableAccessToken(token) || localStorage.getItem('pda_support_grant_id'));
}

export function canManageDirections() {
  return hasAnyPermission(['manage_directions', 'manage_users']);
}

export function canCreateProcess() {
  if (isUiPreviewMode()) return true;
  return hasAnyPermission(['create_process', 'update_process_working_copy', 'manage_directions']);
}

export function canManageAiSuggestions() {
  if (isUiPreviewMode()) return true;
  return hasAnyPermission(['manage_ai_suggestions']);
}

function hasAnyPermission(codes: string[]) {
  if (isDemoAuthBypassEnabled()) return true;
  const token = localStorage.getItem('pda_access_token');
  if (!token && isUiPreviewMode()) return true;
  if (!token) return false;
  try {
    const [, payload] = token.split('.');
    if (!payload) return false;
    const parsed = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      permissions?: string[];
    };
    return parsed.permissions?.some((permission) => codes.includes(permission)) ?? false;
  } catch {
    return false;
  }
}

function isUiPreviewMode() {
  return false;
}

function isDemoAuthBypassEnabled() {
  return import.meta.env.VITE_DEMO_AUTH_BYPASS === 'true';
}

function isUsableAccessToken(token: string | null) {
  if (!token) return false;
  try {
    const [, payload] = token.split('.');
    if (!payload) return false;
    const parsed = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      active_tenant_id?: string;
      exp?: number;
      token_type?: string;
    };
    if (parsed.token_type && parsed.token_type !== 'access') return false;
    if (!parsed.active_tenant_id) return false;
    if (parsed.exp && parsed.exp * 1000 <= Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}
