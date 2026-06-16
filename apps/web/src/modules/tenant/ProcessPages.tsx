import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { DndContext } from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';

import { BrandLogo } from '../../components/brand/BrandLogo';
import {
  AiGeneration,
  AiGenerationType,
  AiSuggestion,
  aiGenerationTypes,
  BpmnResult,
  canCreateProcess,
  canManageAiSuggestions,
  Completeness,
  EventLogImport,
  ExportFormat,
  ExportJob,
  exportFormats,
  ExportType,
  exportTypes,
  hasTenantAccess,
  ProcessItem,
  ProcedureDocument,
  ProcedureSection,
  ProcedureVersion,
  RaciResult,
  SectionCompleteness,
  tenantApi,
  WorkshopBacklog,
  WorkshopOverview,
  WorkshopProcedure,
  WorkshopVersions,
} from './api';
import { TenantHeader } from './TenantDashboard';
import { PremiumBpmnViewer } from './bpmn-flow/PremiumBpmnViewer';

const processSchema = z.object({
  name: z.string().min(2),
  direction_id: z.string().min(1),
  code: z.string().optional(),
  description: z.string().optional(),
});

const wizardSchema = z.object({
  name: z.string().optional(),
  code: z.string().optional(),
  description: z.string().optional(),
  objective: z.string().optional(),
  scope: z.string().optional(),
  trigger_event: z.string().optional(),
  input_name: z.string().optional(),
  output_name: z.string().optional(),
  activity_name: z.string().optional(),
  activity_output: z.string().optional(),
  responsible_actor_id: z.string().optional(),
  accountable_actor_id: z.string().optional(),
  document_title: z.string().optional(),
  application_name: z.string().optional(),
  kpi_name: z.string().optional(),
  risk_description: z.string().optional(),
  pain_point: z.string().optional(),
  automation_need: z.string().optional(),
});

type WizardForm = z.infer<typeof wizardSchema>;

const stepTitles = [
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
];

export function TenantProcessesPage() {
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    is_user_facing_process: '',
    law_55_19_applicable: '',
  });
  const allowed = hasTenantAccess();
  const query = useQuery({
    queryKey: ['processes', filters],
    queryFn: () => tenantApi.processes(filters),
    enabled: allowed,
  });

  if (!allowed) return <AccessDenied />;

  return (
    <main className="tenant-shell">
      <TenantHeader />
      <section className="tenant-grid">
        <div className="admin-toolbar">
          <input
            placeholder="Rechercher un processus"
            value={filters.search}
            onChange={(event) => setFilters((value) => ({ ...value, search: event.target.value }))}
          />
          <select
            value={filters.status}
            onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value }))}
          >
            <option value="">Tous statuts</option>
            <option value="DRAFT">Brouillon</option>
            <option value="SUBMITTED">Soumis</option>
            <option value="APPROVED">Valide</option>
          </select>
          <select
            value={filters.is_user_facing_process}
            onChange={(event) =>
              setFilters((value) => ({ ...value, is_user_facing_process: event.target.value }))
            }
          >
            <option value="">Tous parcours</option>
            <option value="true">Processus usager</option>
            <option value="false">Interne</option>
          </select>
          <select
            value={filters.law_55_19_applicable}
            onChange={(event) =>
              setFilters((value) => ({ ...value, law_55_19_applicable: event.target.value }))
            }
          >
            <option value="">Loi 55-19</option>
            <option value="true">Applicable</option>
            <option value="false">Non applicable</option>
          </select>
          <Link className="button-link" to="/tenant/processes/new">
            Nouveau processus
          </Link>
        </div>
        <section className="admin-panel wide">
          <h2>Processus</h2>
          {query.isLoading ? <p className="empty-inline">Chargement...</p> : null}
          {query.error ? <p className="error-text">{query.error.message}</p> : null}
          {query.data?.length ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Direction</th>
                    <th>Statut</th>
                    <th>Completude</th>
                    <th>Usager</th>
                    <th>Digitalisation</th>
                    <th>Qualite</th>
                    <th>Blocages</th>
                    <th>Mis a jour</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.map((process) => (
                    <tr key={process.id}>
                      <td>
                        <Link to={`/tenant/processes/${process.id}`}>{process.name}</Link>
                      </td>
                      <td>{process.direction?.name ?? '-'}</td>
                      <td>
                        <span className="status-badge">{process.status}</span>
                      </td>
                      <td>{Number(process.completenessScore).toFixed(0)}%</td>
                      <td>{process.moroccoCompliance?.isUserFacingProcess ? 'Oui' : 'Non'}</td>
                      <td>{process.moroccoCompliance?.digitalizationPriority ?? '-'}</td>
                      <td>{process.assessments?.[0]?.qualityStatus ?? 'non evalue'}</td>
                      <td>{countJsonItems(process.assessments?.[0]?.blockingIssues)}</td>
                      <td>{new Date(process.updatedAt).toLocaleString()}</td>
                      <td>
                        <div className="table-actions">
                          <Link to={`/tenant/processes/${process.id}/workshop`}>Atelier</Link>
                          <Link to={`/tenant/processes/${process.id}/wizard`}>Wizard</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !query.isLoading && <p className="empty-inline">Aucun processus.</p>
          )}
        </section>
      </section>
    </main>
  );
}

export function NewProcessPage() {
  const navigate = useNavigate();
  const directions = useQuery({
    queryKey: ['directions-for-process'],
    queryFn: () => tenantApi.directions({ page: 1 }),
    enabled: hasTenantAccess(),
  });
  const form = useForm<z.infer<typeof processSchema>>({
    resolver: zodResolver(processSchema),
    defaultValues: { name: '', direction_id: '', code: '', description: '' },
  });
  const mutation = useMutation({
    mutationFn: tenantApi.createProcess,
    onSuccess: (process) => navigate(`/tenant/processes/${process.id}/wizard`),
  });

  return (
    <main className="tenant-shell">
      <TenantHeader />
      <section className="admin-empty process-new">
        <p className="eyebrow">Formalisation</p>
        <h1>Nouveau processus</h1>
        <form
          className="stack-form"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <input placeholder="Nom du processus" {...form.register('name')} />
          <select {...form.register('direction_id')}>
            <option value="">Direction</option>
            {directions.data?.items.map((direction) => (
              <option value={direction.id} key={direction.id}>
                {direction.name}
              </option>
            ))}
          </select>
          <input placeholder="Code" {...form.register('code')} />
          <textarea placeholder="Description courte" {...form.register('description')} />
          {form.formState.errors.name || form.formState.errors.direction_id ? (
            <p className="error-text">Nom et direction sont obligatoires.</p>
          ) : null}
          {mutation.error ? <p className="error-text">{mutation.error.message}</p> : null}
          <button type="submit" disabled={mutation.isPending || !canCreateProcess()}>
            Creer le brouillon
          </button>
        </form>
      </section>
    </main>
  );
}

export function ProcessDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['process', id], queryFn: () => tenantApi.process(id) });
  const compliance = useQuery({
    queryKey: ['morocco-compliance', id],
    queryFn: () => tenantApi.moroccoCompliance(id),
  });
  const eventLogs = useQuery({
    queryKey: ['event-logs', id],
    queryFn: () => tenantApi.eventLogs(id),
  });
  const [moroccoForm, setMoroccoForm] = useState<Record<string, string | boolean | number>>({});
  const [csvContent, setCsvContent] = useState(
    'case_id,activity_name,event_timestamp,resource,department,channel,status\nC-001,Depot dossier,2026-06-01T09:00:00Z,Agent A,Front office,Physique,done\nC-001,Instruction,2026-06-01T11:00:00Z,Agent B,Back office,Interne,done\nC-001,Decision,2026-06-01T14:00:00Z,Agent C,Direction,Digital,done',
  );
  const [analysis, setAnalysis] = useState<unknown>(null);

  useEffect(() => {
    if (!compliance.data) return;
    setMoroccoForm({
      is_user_facing_process: Boolean(compliance.data.isUserFacingProcess),
      law_55_19_applicable: Boolean(compliance.data.law5519Applicable),
      administrative_procedure_type: compliance.data.administrativeProcedureType ?? '',
      user_category: compliance.data.userCategory ?? '',
      current_channel: compliance.data.currentChannel ?? '',
      target_channel: compliance.data.targetChannel ?? '',
      simplification_priority: compliance.data.simplificationPriority ?? '',
      digitalization_priority: compliance.data.digitalizationPriority ?? '',
      current_processing_time_days: compliance.data.currentProcessingTimeDays ?? 0,
      target_processing_time_days: compliance.data.targetProcessingTimeDays ?? 0,
      required_documents_count: compliance.data.requiredDocumentsCount ?? 0,
      requested_copies_count: compliance.data.requestedCopiesCount ?? 0,
      physical_visits_required: compliance.data.physicalVisitsRequired ?? 0,
      legal_reference: compliance.data.legalReference ?? '',
      procedure_owner_entity: compliance.data.procedureOwnerEntity ?? '',
      public_service_portal_url: compliance.data.publicServicePortalUrl ?? '',
      observations: compliance.data.observations ?? '',
    });
  }, [compliance.data]);

  const saveCompliance = useMutation({
    mutationFn: () => tenantApi.updateMoroccoCompliance(id, moroccoForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['morocco-compliance', id] });
      queryClient.invalidateQueries({ queryKey: ['process', id] });
    },
  });
  const importLog = useMutation({
    mutationFn: () =>
      tenantApi.importEventLogCsv(id, {
        file_name: 'event-log.csv',
        content: csvContent,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-logs', id] }),
  });
  const analyzeLog = useMutation({
    mutationFn: (importId: string) => tenantApi.analyzeEventLogBasic(id, importId),
    onSuccess: (result) => setAnalysis(result),
  });

  const process = query.data;
  return (
    <main className="tenant-shell">
      <TenantHeader />
      <section className="tenant-grid">
        <article className="admin-panel wide process-summary">
          {process ? (
            <>
              <p className="eyebrow">{process.code ?? process.status}</p>
              <h1>{process.name}</h1>
              <p>{process.description ?? 'Description non renseignee.'}</p>
              <div className="metric-grid small">
                <Metric
                  label="Completude"
                  value={`${Number(process.completenessScore).toFixed(0)}%`}
                />
                <Metric label="Direction" value={process.direction?.name ?? '-'} />
                <Metric label="Responsable" value={process.ownerActor?.name ?? '-'} />
                <Metric label="Version" value={process.lockVersion} />
              </div>
              <Link className="button-link" to={`/tenant/processes/${id}/wizard`}>
                Ouvrir le wizard
              </Link>
              <Link className="button-link" to={`/tenant/processes/${id}/workshop`}>
                Atelier de Formalisation
              </Link>
              <Link className="button-link" to={`/tenant/processes/${id}/raci`}>
                Ouvrir la matrice RACI
              </Link>
              <Link className="button-link" to={`/tenant/processes/${id}/bpmn`}>
                Ouvrir BPMN
              </Link>
            </>
          ) : (
            <p className="empty-inline">Chargement...</p>
          )}
        </article>
        <MoroccoCompliancePanel
          form={moroccoForm}
          onChange={setMoroccoForm}
          onSave={() => saveCompliance.mutate()}
          saving={saveCompliance.isPending}
        />
        <PublicAuditRiskPanel process={process} />
        <ProcessMiningPanel
          logs={eventLogs.data ?? []}
          csvContent={csvContent}
          onCsvChange={setCsvContent}
          onImport={() => importLog.mutate()}
          importing={importLog.isPending}
          onAnalyze={(importId) => analyzeLog.mutate(importId)}
          analyzing={analyzeLog.isPending}
          analysis={analysis}
        />
      </section>
    </main>
  );
}

function MoroccoCompliancePanel({
  form,
  onChange,
  onSave,
  saving,
}: {
  form: Record<string, string | boolean | number>;
  onChange: (value: Record<string, string | boolean | number>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const setField = (key: string, value: string | boolean | number) =>
    onChange({ ...form, [key]: value });
  return (
    <article className="admin-panel wide detail-panel">
      <p className="eyebrow">Loi 55-19</p>
      <h2>Conformite Maroc</h2>
      <p className="empty-inline">
        Cet outil facilite la structuration, la documentation et la tracabilite. Il ne constitue pas
        un avis juridique et ne garantit pas a lui seul la conformite reglementaire.
      </p>
      <div className="tenant-form compact">
        <label className="check-row">
          <input
            checked={Boolean(form.is_user_facing_process)}
            onChange={(event) => setField('is_user_facing_process', event.target.checked)}
            type="checkbox"
          />
          Processus usager
        </label>
        <label className="check-row">
          <input
            checked={Boolean(form.law_55_19_applicable)}
            onChange={(event) => setField('law_55_19_applicable', event.target.checked)}
            type="checkbox"
          />
          Loi 55-19 applicable
        </label>
        <input
          placeholder="Type de procedure"
          value={String(form.administrative_procedure_type ?? '')}
          onChange={(event) => setField('administrative_procedure_type', event.target.value)}
        />
        <input
          placeholder="Categorie usager"
          value={String(form.user_category ?? '')}
          onChange={(event) => setField('user_category', event.target.value)}
        />
        <input
          placeholder="Canal actuel"
          value={String(form.current_channel ?? '')}
          onChange={(event) => setField('current_channel', event.target.value)}
        />
        <input
          placeholder="Canal cible"
          value={String(form.target_channel ?? '')}
          onChange={(event) => setField('target_channel', event.target.value)}
        />
        <input
          placeholder="Priorite simplification"
          value={String(form.simplification_priority ?? '')}
          onChange={(event) => setField('simplification_priority', event.target.value)}
        />
        <input
          placeholder="Priorite digitalisation"
          value={String(form.digitalization_priority ?? '')}
          onChange={(event) => setField('digitalization_priority', event.target.value)}
        />
        <input
          min="0"
          placeholder="Delai actuel jours"
          type="number"
          value={Number(form.current_processing_time_days ?? 0)}
          onChange={(event) => setField('current_processing_time_days', Number(event.target.value))}
        />
        <input
          min="0"
          placeholder="Delai cible jours"
          type="number"
          value={Number(form.target_processing_time_days ?? 0)}
          onChange={(event) => setField('target_processing_time_days', Number(event.target.value))}
        />
        <input
          min="0"
          placeholder="Documents requis"
          type="number"
          value={Number(form.required_documents_count ?? 0)}
          onChange={(event) => setField('required_documents_count', Number(event.target.value))}
        />
        <input
          min="0"
          placeholder="Visites physiques"
          type="number"
          value={Number(form.physical_visits_required ?? 0)}
          onChange={(event) => setField('physical_visits_required', Number(event.target.value))}
        />
        <input
          placeholder="Reference legale"
          value={String(form.legal_reference ?? '')}
          onChange={(event) => setField('legal_reference', event.target.value)}
        />
        <input
          placeholder="Entite proprietaire"
          value={String(form.procedure_owner_entity ?? '')}
          onChange={(event) => setField('procedure_owner_entity', event.target.value)}
        />
        <textarea
          placeholder="Observations"
          value={String(form.observations ?? '')}
          onChange={(event) => setField('observations', event.target.value)}
        />
      </div>
      <button type="button" onClick={onSave} disabled={saving}>
        Enregistrer conformite
      </button>
    </article>
  );
}

function PublicAuditRiskPanel({ process }: { process?: ProcessItem }) {
  return (
    <article className="admin-panel wide detail-panel">
      <p className="eyebrow">Audit public</p>
      <h2>Risques Audit Public</h2>
      {process?.risks?.length ? (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Famille</th>
                <th>Risque</th>
                <th>Score brut</th>
                <th>Score residuel</th>
                <th>Cour des comptes</th>
              </tr>
            </thead>
            <tbody>
              {process.risks.map((risk) => (
                <tr key={risk.id}>
                  <td>{risk.riskFamily ?? risk.category ?? '-'}</td>
                  <td>{risk.description}</td>
                  <td>{risk.inherentScore ?? '-'}</td>
                  <td>{risk.residualScore ?? '-'}</td>
                  <td>{risk.courtOfAccountsRelevance ? 'Oui' : 'Non'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-inline">Aucun risque public qualifie pour ce processus.</p>
      )}
    </article>
  );
}

function ProcessMiningPanel({
  logs,
  csvContent,
  onCsvChange,
  onImport,
  importing,
  onAnalyze,
  analyzing,
  analysis,
}: {
  logs: EventLogImport[];
  csvContent: string;
  onCsvChange: (value: string) => void;
  onImport: () => void;
  importing: boolean;
  onAnalyze: (importId: string) => void;
  analyzing: boolean;
  analysis: unknown;
}) {
  return (
    <article className="admin-panel wide detail-panel">
      <p className="eyebrow">Readiness</p>
      <h2>Process Mining</h2>
      <p className="empty-inline">Analyse avancee par worker Python optionnel a venir.</p>
      <textarea
        className="event-log-input"
        value={csvContent}
        onChange={(event) => onCsvChange(event.target.value)}
      />
      <button type="button" onClick={onImport} disabled={importing}>
        Importer CSV event log
      </button>
      {logs.length ? (
        <div className="quality-checklist">
          {logs.map((log) => (
            <button
              key={log.id}
              type="button"
              onClick={() => onAnalyze(log.id)}
              disabled={analyzing}
            >
              <span>{log.status}</span>
              <strong>
                {log.fileName} - {log.rowCount} lignes
              </strong>
              <span>Analyser</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="empty-inline">Aucun journal importe.</p>
      )}
      {analysis ? <pre className="analysis-output">{JSON.stringify(analysis, null, 2)}</pre> : null}
    </article>
  );
}

export function ProcessRaciPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const raci = useQuery({ queryKey: ['raci', id], queryFn: () => tenantApi.raci(id) });
  const history = useQuery({
    queryKey: ['raci-history', id],
    queryFn: () => tenantApi.raciHistory(id),
  });
  const versions = useQuery({
    queryKey: ['raci-versions', id],
    queryFn: () => tenantApi.raciVersions(id),
  });
  const generate = useMutation({
    mutationFn: () => tenantApi.generateRaci(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['raci', id] }),
  });
  const recalculate = useMutation({
    mutationFn: () => tenantApi.recalculateRaci(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['raci', id] }),
  });
  const validate = useMutation({
    mutationFn: () => tenantApi.validateRaci(id, 'Validation humaine depuis UI'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['raci', id] }),
  });
  const invalidate = useMutation({
    mutationFn: () => tenantApi.invalidateRaci(id, 'Invalidation humaine depuis UI'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['raci', id] }),
  });

  return (
    <main className="tenant-shell">
      <TenantHeader />
      <section className="tenant-grid">
        <article className="admin-panel wide detail-panel">
          <p className="eyebrow">Responsabilites</p>
          <h1>Matrice RACI</h1>
          <RaciToolbar
            raci={raci.data}
            onGenerate={() => generate.mutate()}
            onRecalculate={() => recalculate.mutate()}
            onValidate={() => validate.mutate()}
            onInvalidate={() => invalidate.mutate()}
            busy={
              generate.isPending ||
              recalculate.isPending ||
              validate.isPending ||
              invalidate.isPending
            }
            processId={id}
          />
          {raci.isLoading ? <p className="empty-inline">Chargement de la matrice...</p> : null}
          {raci.error ? <p className="error-text">{raci.error.message}</p> : null}
          {raci.data ? <RaciMatrix raci={raci.data} /> : null}
        </article>
        {raci.data ? (
          <>
            <RaciIssuesPanel raci={raci.data} />
            <RaciRecommendationsPanel raci={raci.data} />
          </>
        ) : null}
        <RaciHistoryPanel history={history.data ?? []} versions={versions.data ?? []} />
      </section>
    </main>
  );
}

function RaciToolbar({
  raci,
  onGenerate,
  onRecalculate,
  onValidate,
  onInvalidate,
  busy,
  processId,
}: {
  raci?: RaciResult;
  onGenerate: () => void;
  onRecalculate: () => void;
  onValidate: () => void;
  onInvalidate: () => void;
  busy: boolean;
  processId: string;
}) {
  return (
    <div className="raci-toolbar">
      <div className="raci-toolbar-metrics">
        <Metric label="Score RACI" value={raci ? `${raci.qualityScore}%` : '-'} />
        <Metric label="Statut" value={raci?.validationStatus ?? 'DRAFT'} />
        <Metric label="Version" value={raci?.versionNumber ?? '-'} />
      </div>
      <div className="raci-toolbar-actions">
        <button type="button" onClick={onGenerate} disabled={busy}>
          Generer
        </button>
        <button type="button" onClick={onRecalculate} disabled={busy}>
          Recalculer
        </button>
        <button type="button" onClick={onValidate} disabled={busy || !raci?.canValidate}>
          Valider
        </button>
        <button type="button" onClick={onInvalidate} disabled={busy || !raci}>
          Invalider
        </button>
        <a className="button-link" href={`/api/v1/tenant/processes/${processId}/raci/export.csv`}>
          CSV
        </a>
        <Link className="button-link" to={`/tenant/processes/${processId}/wizard`}>
          Wizard
        </Link>
        <Link className="button-link" to={`/tenant/processes/${processId}/workshop`}>
          Atelier
        </Link>
      </div>
    </div>
  );
}

function RaciMatrix({ raci }: { raci: RaciResult }) {
  if (!raci.matrix.activities.length || !raci.matrix.actors.length) {
    return (
      <p className="empty-inline">Aucune activite ou aucun acteur pour construire la matrice.</p>
    );
  }
  return (
    <div className="data-table-wrap raci-matrix">
      <RaciLegend />
      <table className="data-table">
        <thead>
          <tr>
            <th>Activite</th>
            {raci.matrix.actors.map((actor) => (
              <th key={actor.id}>
                <span className="raci-actor-name">{actor.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {raci.matrix.activities.map((activity) => (
            <tr key={activity.id}>
              <td>{activity.name}</td>
              {raci.matrix.actors.map((actor) => {
                const cell = raci.matrix.cells.find(
                  (item) => item.activityId === activity.id && item.actorId === actor.id,
                );
                return (
                  <td key={actor.id}>
                    <div className="raci-cell-group">
                      {cell?.roles.length ? (
                        cell.roles.map((role) => (
                          <span className={`raci-cell ${raciRoleClass(role)}`} key={role}>
                            {role[0]}
                          </span>
                        ))
                      ) : (
                        <span className="raci-cell empty">-</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RaciLegend() {
  return (
    <div className="raci-legend" aria-label="Legende RACI">
      <span>
        <strong className="raci-cell responsible">R</strong> Realise
      </span>
      <span>
        <strong className="raci-cell accountable">A</strong> Approuve
      </span>
      <span>
        <strong className="raci-cell consulted">C</strong> Consulte
      </span>
      <span>
        <strong className="raci-cell informed">I</strong> Informe
      </span>
    </div>
  );
}

function raciRoleClass(role: string) {
  const key = role.toLowerCase();
  if (key.includes('responsible')) return 'responsible';
  if (key.includes('accountable')) return 'accountable';
  if (key.includes('consulted')) return 'consulted';
  if (key.includes('informed')) return 'informed';
  return 'informed';
}

function RaciIssuesPanel({ raci }: { raci: RaciResult }) {
  return (
    <article className="admin-panel detail-panel">
      <h2>Blocages et warnings</h2>
      <IssueList title="Blocages" items={raci.blockingIssues.map((item) => item.message)} />
      <IssueList title="Warnings" items={raci.warnings.map((item) => item.message)} />
    </article>
  );
}

function RaciRecommendationsPanel({ raci }: { raci: RaciResult }) {
  return (
    <article className="admin-panel detail-panel">
      <h2>Recommandations</h2>
      <IssueList title="Actions" items={raci.recommendations} />
      <p className="empty-inline">Hash source: {raci.sourceHash.slice(0, 16)}</p>
    </article>
  );
}

function RaciHistoryPanel({
  history,
  versions,
}: {
  history: { id: string; action: string; createdAt: string }[];
  versions: { id: string; versionNumber: number; createdAt: string }[];
}) {
  return (
    <article className="admin-panel wide detail-panel">
      <h2>Historique RACI</h2>
      <div className="metric-grid small">
        <Metric label="Versions" value={versions.length} />
        <Metric label="Actions audit" value={history.length} />
      </div>
      <IssueList
        title="Dernieres actions"
        items={history.map(
          (item) => `${item.action} - ${new Date(item.createdAt).toLocaleString()}`,
        )}
      />
    </article>
  );
}

export function ProcessBpmnPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'premium' | 'xml'>('premium');
  const bpmn = useQuery({ queryKey: ['bpmn', id], queryFn: () => tenantApi.bpmn(id) });
  const history = useQuery({
    queryKey: ['bpmn-history', id],
    queryFn: () => tenantApi.bpmnHistory(id),
  });
  const versions = useQuery({
    queryKey: ['bpmn-versions', id],
    queryFn: () => tenantApi.bpmnVersions(id),
  });
  const generate = useMutation({
    mutationFn: () => tenantApi.generateBpmn(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bpmn', id] }),
  });
  const recalculate = useMutation({
    mutationFn: () => tenantApi.recalculateBpmn(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bpmn', id] }),
  });
  const validate = useMutation({
    mutationFn: () => tenantApi.validateBpmn(id, 'Validation humaine depuis UI'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bpmn', id] }),
  });
  const invalidate = useMutation({
    mutationFn: () => tenantApi.invalidateBpmn(id, 'Invalidation humaine depuis UI'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bpmn', id] }),
  });

  return (
    <main className="tenant-shell">
      <TenantHeader />
      <section className="tenant-grid">
        <article className="admin-panel wide detail-panel">
          <p className="eyebrow">BPMN 2.0</p>
          <h1>Modele BPMN deterministe</h1>
          <BpmnToolbar
            bpmn={bpmn.data}
            processId={id}
            onGenerate={() => generate.mutate()}
            onRecalculate={() => recalculate.mutate()}
            onValidate={() => validate.mutate()}
            onInvalidate={() => invalidate.mutate()}
            busy={
              generate.isPending ||
              recalculate.isPending ||
              validate.isPending ||
              invalidate.isPending
            }
          />
          {bpmn.isLoading ? <p className="empty-inline">Chargement du BPMN...</p> : null}
          {bpmn.error ? <p className="error-text">{bpmn.error.message}</p> : null}
          {bpmn.data ? <BpmnViewTabs value={view} onChange={setView} /> : null}
          {bpmn.data && view === 'premium' ? <PremiumBpmnViewer bpmn={bpmn.data} /> : null}
          {bpmn.data && view === 'xml' ? <BpmnViewer bpmn={bpmn.data} /> : null}
        </article>
        {bpmn.data ? (
          <>
            <BpmnIssuesPanel bpmn={bpmn.data} />
            <BpmnWarningsPanel bpmn={bpmn.data} />
            <BpmnRecommendationsPanel bpmn={bpmn.data} />
          </>
        ) : null}
        <BpmnHistoryPanel history={history.data ?? []} versions={versions.data ?? []} />
      </section>
    </main>
  );
}

function BpmnViewTabs({
  value,
  onChange,
}: {
  value: 'premium' | 'xml';
  onChange: (value: 'premium' | 'xml') => void;
}) {
  return (
    <div className="bpmn-view-toggle" aria-label="Mode d'affichage BPMN">
      <button
        className={value === 'premium' ? 'active' : ''}
        type="button"
        onClick={() => onChange('premium')}
      >
        Vue premium
      </button>
      <button
        className={value === 'xml' ? 'active' : ''}
        type="button"
        onClick={() => onChange('xml')}
      >
        Vue XML BPMN
      </button>
    </div>
  );
}

function BpmnToolbar({
  bpmn,
  processId,
  onGenerate,
  onRecalculate,
  onValidate,
  onInvalidate,
  busy,
}: {
  bpmn?: BpmnResult;
  processId: string;
  onGenerate: () => void;
  onRecalculate: () => void;
  onValidate: () => void;
  onInvalidate: () => void;
  busy: boolean;
}) {
  return (
    <div className="raci-toolbar bpmn-toolbar">
      <div className="raci-toolbar-metrics">
        <Metric label="Statut BPMN" value={bpmn?.validationStatus ?? 'DRAFT'} />
        <Metric label="Version" value={bpmn?.versionNumber ?? '-'} />
        <Metric label="Blocages" value={bpmn?.blockingIssues.length ?? 0} />
        <Metric label="Warnings" value={bpmn?.warnings.length ?? 0} />
      </div>
      <div className="raci-toolbar-actions">
        <button type="button" onClick={onGenerate} disabled={busy}>
          Generer
        </button>
        <button type="button" onClick={onRecalculate} disabled={busy}>
          Recalculer
        </button>
        <button type="button" onClick={onValidate} disabled={busy || !bpmn?.canValidate}>
          Valider
        </button>
        <button type="button" onClick={onInvalidate} disabled={busy || !bpmn}>
          Invalider
        </button>
        <a className="button-link" href={`/api/v1/tenant/processes/${processId}/bpmn/export.xml`}>
          XML
        </a>
        <a className="button-link" href={`/api/v1/tenant/processes/${processId}/bpmn/export.json`}>
          JSON
        </a>
        <Link className="button-link" to={`/tenant/processes/${processId}/wizard`}>
          Wizard
        </Link>
        <Link className="button-link" to={`/tenant/processes/${processId}/workshop`}>
          Atelier
        </Link>
      </div>
    </div>
  );
}

function BpmnViewer({ bpmn }: { bpmn: BpmnResult }) {
  const nodesById = new Map(bpmn.bpmnJson.nodes.map((node) => [node.id, node]));
  const width =
    Math.max(...bpmn.bpmnJson.lanes.map((lane) => lane.bounds.x + lane.bounds.width), 900) + 40;
  const height =
    Math.max(...bpmn.bpmnJson.lanes.map((lane) => lane.bounds.y + lane.bounds.height), 360) + 40;
  return (
    <div className="bpmn-viewer" aria-label="Visualisation BPMN">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <defs>
          <marker
            id="bpmn-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>
        {bpmn.bpmnJson.lanes.map((lane) => (
          <g key={lane.id}>
            <rect className="bpmn-lane" {...lane.bounds} />
            <text className="bpmn-lane-label" x={lane.bounds.x + 16} y={lane.bounds.y + 28}>
              {lane.label}
            </text>
          </g>
        ))}
        {bpmn.bpmnJson.edges.map((edge) => {
          const source = nodesById.get(edge.sourceNodeId);
          const target = nodesById.get(edge.targetNodeId);
          if (!source || !target) return null;
          const sourceCenter = centerOf(source);
          const targetCenter = centerOf(target);
          return (
            <g key={edge.id}>
              <path
                className="bpmn-edge"
                d={bpmnConnectorPath(sourceCenter, targetCenter)}
                markerEnd="url(#bpmn-arrow)"
              />
              {edge.label ? (
                <text
                  className="bpmn-edge-label"
                  x={(sourceCenter.x + targetCenter.x) / 2}
                  y={(sourceCenter.y + targetCenter.y) / 2 - 8}
                >
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}
        {bpmn.bpmnJson.nodes.map((node) => (
          <BpmnNodeShape node={node} key={node.id} />
        ))}
      </svg>
    </div>
  );
}

function BpmnNodeShape({ node }: { node: BpmnResult['bpmnJson']['nodes'][number] }) {
  if (node.type === 'startEvent' || node.type === 'endEvent') {
    return (
      <g>
        <circle
          className={`bpmn-event ${node.type === 'endEvent' ? 'end' : ''}`}
          cx={node.position.x + 25}
          cy={node.position.y + 25}
          r="24"
        />
        <text className="bpmn-node-label" x={node.position.x + 25} y={node.position.y + 64}>
          {node.label}
        </text>
      </g>
    );
  }
  if (node.type === 'exclusiveGateway') {
    return (
      <g>
        <rect
          className="bpmn-gateway"
          x={node.position.x}
          y={node.position.y}
          width="58"
          height="58"
          transform={`rotate(45 ${node.position.x + 29} ${node.position.y + 29})`}
        />
        <text className="bpmn-node-label" x={node.position.x + 29} y={node.position.y + 82}>
          {node.label}
        </text>
      </g>
    );
  }
  return (
    <g>
      <rect
        className={`bpmn-task ${node.type === 'userTask' ? 'user' : ''}`}
        x={node.position.x}
        y={node.position.y}
        width="156"
        height="70"
        rx="12"
      />
      <foreignObject x={node.position.x + 12} y={node.position.y + 10} width="132" height="50">
        <div className="bpmn-task-label">{node.label}</div>
      </foreignObject>
    </g>
  );
}

function bpmnConnectorPath(source: { x: number; y: number }, target: { x: number; y: number }) {
  const midX = source.x + (target.x - source.x) / 2;
  if (Math.abs(source.y - target.y) < 10) {
    return `M ${source.x} ${source.y} H ${target.x}`;
  }
  return `M ${source.x} ${source.y} H ${midX} V ${target.y} H ${target.x}`;
}

function centerOf(node: BpmnResult['bpmnJson']['nodes'][number]) {
  if (node.type === 'startEvent' || node.type === 'endEvent')
    return { x: node.position.x + 25, y: node.position.y + 25 };
  if (node.type === 'exclusiveGateway') return { x: node.position.x + 29, y: node.position.y + 29 };
  return { x: node.position.x + 78, y: node.position.y + 35 };
}

function BpmnIssuesPanel({ bpmn }: { bpmn: BpmnResult }) {
  return (
    <article className="admin-panel detail-panel">
      <h2>Blocages BPMN</h2>
      <IssueList title="Blocages" items={bpmn.blockingIssues.map((item) => item.message)} />
    </article>
  );
}

function BpmnWarningsPanel({ bpmn }: { bpmn: BpmnResult }) {
  return (
    <article className="admin-panel detail-panel">
      <h2>Warnings BPMN</h2>
      <IssueList title="Warnings" items={bpmn.warnings.map((item) => item.message)} />
    </article>
  );
}

function BpmnRecommendationsPanel({ bpmn }: { bpmn: BpmnResult }) {
  return (
    <article className="admin-panel detail-panel">
      <h2>Recommandations</h2>
      <IssueList title="Actions" items={bpmn.recommendations} />
      <p className="empty-inline">Hash source: {bpmn.sourceHash.slice(0, 16)}</p>
    </article>
  );
}

function BpmnHistoryPanel({
  history,
  versions,
}: {
  history: { id: string; action: string; createdAt: string }[];
  versions: { id: string; versionNumber: number; createdAt: string }[];
}) {
  return (
    <article className="admin-panel wide detail-panel">
      <h2>Historique BPMN</h2>
      <div className="metric-grid small">
        <Metric label="Versions" value={versions.length} />
        <Metric label="Actions audit" value={history.length} />
      </div>
      <IssueList
        title="Dernieres actions"
        items={history.map(
          (item) => `${item.action} - ${new Date(item.createdAt).toLocaleString()}`,
        )}
      />
    </article>
  );
}

const workshopTabs = [
  "Vue d'ensemble",
  'BPMN',
  'RACI',
  'Workflow',
  'KPI',
  'Risques et controles',
  'Controle Qualite',
  'Conformite Maroc',
  'Process Mining',
  'Procedure',
  'Backlog',
  'Copilote IA',
  'Versions',
  'Commentaires',
  'Audit',
] as const;

type WorkshopTab = (typeof workshopTabs)[number];

export function ProcessWorkshopPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<WorkshopTab>("Vue d'ensemble");
  const [commentBody, setCommentBody] = useState('');
  const [aiType, setAiType] = useState<AiGenerationType>('inconsistency_detection');
  const [aiModifyId, setAiModifyId] = useState('');
  const [aiModifyText, setAiModifyText] = useState('');
  const overview = useQuery({
    queryKey: ['workshop-overview', id],
    queryFn: () => tenantApi.workshopOverview(id),
  });
  const bpmn = useQuery({ queryKey: ['bpmn', id], queryFn: () => tenantApi.bpmn(id) });
  const raci = useQuery({ queryKey: ['raci', id], queryFn: () => tenantApi.raci(id) });
  const eventLogs = useQuery({
    queryKey: ['event-logs', id],
    queryFn: () => tenantApi.eventLogs(id),
  });
  const procedure = useQuery({
    queryKey: ['workshop-procedure', id],
    queryFn: () => tenantApi.workshopProcedure(id),
  });
  const backlog = useQuery({
    queryKey: ['workshop-backlog', id],
    queryFn: () => tenantApi.workshopBacklog(id),
  });
  const versions = useQuery({
    queryKey: ['workshop-versions', id],
    queryFn: () => tenantApi.workshopVersions(id),
  });
  const audit = useQuery({
    queryKey: ['workshop-audit', id],
    queryFn: () => tenantApi.workshopAudit(id),
  });
  const comments = useQuery({
    queryKey: ['comments', id],
    queryFn: () => tenantApi.comments(id),
  });
  const aiGenerations = useQuery({
    queryKey: ['ai-generations', id],
    queryFn: () => tenantApi.aiGenerations(id),
    enabled: activeTab === 'Copilote IA',
  });
  const aiSuggestions = useQuery({
    queryKey: ['ai-suggestions', id],
    queryFn: () => tenantApi.aiSuggestions(id),
    enabled: activeTab === 'Copilote IA',
  });
  const generateBpmn = useMutation({
    mutationFn: () => tenantApi.generateBpmn(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bpmn', id] }),
  });
  const generateRaci = useMutation({
    mutationFn: () => tenantApi.generateRaci(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['raci', id] }),
  });
  const recalculateQuality = useMutation({
    mutationFn: () => tenantApi.recalculateCompleteness(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workshop-overview', id] }),
  });
  const validateBpmn = useMutation({
    mutationFn: () => tenantApi.validateBpmn(id, 'Validation depuis atelier'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bpmn', id] }),
  });
  const invalidateBpmn = useMutation({
    mutationFn: () => tenantApi.invalidateBpmn(id, 'Invalidation depuis atelier'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bpmn', id] }),
  });
  const validateRaci = useMutation({
    mutationFn: () => tenantApi.validateRaci(id, 'Validation depuis atelier'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['raci', id] }),
  });
  const invalidateRaci = useMutation({
    mutationFn: () => tenantApi.invalidateRaci(id, 'Invalidation depuis atelier'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['raci', id] }),
  });
  const createComment = useMutation({
    mutationFn: () => tenantApi.createComment(id, commentBody, activeTab),
    onSuccess: () => {
      setCommentBody('');
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
    },
  });
  const resolveComment = useMutation({
    mutationFn: (commentId: string) => tenantApi.resolveComment(id, commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', id] }),
  });
  const refreshAi = () => {
    queryClient.invalidateQueries({ queryKey: ['ai-generations', id] });
    queryClient.invalidateQueries({ queryKey: ['ai-suggestions', id] });
  };
  const generateAi = useMutation({
    mutationFn: () => tenantApi.generateAi(id, aiType),
    onSuccess: refreshAi,
  });
  const acceptAi = useMutation({
    mutationFn: (sid: string) => tenantApi.acceptAiSuggestion(id, sid),
    onSuccess: refreshAi,
  });
  const rejectAi = useMutation({
    mutationFn: (sid: string) => tenantApi.rejectAiSuggestion(id, sid),
    onSuccess: refreshAi,
  });
  const validateAi = useMutation({
    mutationFn: (sid: string) => tenantApi.validateAiSuggestion(id, sid),
    onSuccess: refreshAi,
  });
  const modifyAi = useMutation({
    mutationFn: (sid: string) =>
      tenantApi.modifyAiSuggestion(id, sid, parseAiModification(aiModifyText)),
    onSuccess: () => {
      setAiModifyId('');
      setAiModifyText('');
      refreshAi();
    },
  });
  const createKpiAi = useMutation({
    mutationFn: (sid: string) => tenantApi.createKpiFromAiSuggestion(id, sid),
    onSuccess: refreshAi,
  });
  const createRiskAi = useMutation({
    mutationFn: (sid: string) => tenantApi.createRiskFromAiSuggestion(id, sid),
    onSuccess: refreshAi,
  });
  const createControlAi = useMutation({
    mutationFn: (sid: string) => tenantApi.createControlFromAiSuggestion(id, sid),
    onSuccess: refreshAi,
  });
  const createBacklogAi = useMutation({
    mutationFn: (sid: string) => tenantApi.createBacklogFromAiSuggestion(id, sid),
    onSuccess: refreshAi,
  });
  const insertProcedureAi = useMutation({
    mutationFn: (sid: string) => tenantApi.insertProcedureDraftFromAiSuggestion(id, sid),
    onSuccess: refreshAi,
  });

  if (!hasTenantAccess()) return <AccessDenied />;

  return (
    <main className="tenant-shell">
      <TenantHeader />
      <section className="workshop-shell">
        <header className="workshop-header">
          <div>
            <p className="eyebrow">Atelier de Formalisation</p>
            <h1>{overview.data?.process.name ?? 'Processus'}</h1>
            <p>{overview.data?.process.description ?? 'Chargement des livrables du processus.'}</p>
          </div>
          <div className="workshop-actions">
            <Link className="button-link" to="/tenant/processes">
              Liste
            </Link>
            <Link className="button-link" to="/tenant/exports">
              Exports
            </Link>
            <Link className="button-link" to={`/tenant/processes/${id}/wizard`}>
              Wizard
            </Link>
            <button type="button" onClick={() => generateBpmn.mutate()}>
              Generer BPMN
            </button>
            <button type="button" onClick={() => generateRaci.mutate()}>
              Generer RACI
            </button>
            <button type="button" onClick={() => recalculateQuality.mutate()}>
              Recalculer qualite
            </button>
          </div>
        </header>
        <div className="workshop-status">
          <Metric label="Workflow" value={overview.data?.process.status ?? '-'} />
          <Metric label="Completude" value={`${overview.data?.quality.score ?? 0}%`} />
          <Metric label="RACI" value={overview.data?.raci?.status ?? 'Non genere'} />
          <Metric label="BPMN" value={overview.data?.bpmn?.status ?? 'Non genere'} />
          <Metric label="Blocages" value={overview.data?.alerts.blocking.length ?? 0} />
          <Metric label="Warnings" value={overview.data?.alerts.warnings.length ?? 0} />
        </div>
        <div className="workshop-tabs">
          {workshopTabs.map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? 'active' : ''}
              type="button"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <section className="workshop-content">
          <WorkshopPanelState loading={overview.isLoading} error={overview.error} />
          {activeTab === "Vue d'ensemble" && overview.data ? (
            <WorkshopOverviewTab overview={overview.data} processId={id} />
          ) : null}
          {activeTab === 'BPMN' ? (
            <WorkshopBpmnTab
              bpmn={bpmn.data}
              loading={bpmn.isLoading}
              error={bpmn.error}
              processId={id}
              onGenerate={() => generateBpmn.mutate()}
              onValidate={() => validateBpmn.mutate()}
              onInvalidate={() => invalidateBpmn.mutate()}
            />
          ) : null}
          {activeTab === 'RACI' ? (
            <WorkshopRaciTab
              raci={raci.data}
              loading={raci.isLoading}
              error={raci.error}
              processId={id}
              onGenerate={() => generateRaci.mutate()}
              onValidate={() => validateRaci.mutate()}
              onInvalidate={() => invalidateRaci.mutate()}
            />
          ) : null}
          {activeTab === 'Workflow' && overview.data ? (
            <WorkflowTab overview={overview.data} />
          ) : null}
          {activeTab === 'KPI' && overview.data ? <KpiTab process={overview.data.process} /> : null}
          {activeTab === 'Risques et controles' && overview.data ? (
            <RiskTab processId={id} />
          ) : null}
          {activeTab === 'Controle Qualite' && overview.data ? (
            <QualityTab quality={overview.data.quality} processId={id} />
          ) : null}
          {activeTab === 'Conformite Maroc' && overview.data ? (
            <MoroccoTab processId={id} overview={overview.data} />
          ) : null}
          {activeTab === 'Process Mining' ? (
            <ProcessMiningWorkshopTab logs={eventLogs.data ?? []} loading={eventLogs.isLoading} />
          ) : null}
          {activeTab === 'Procedure' ? (
            <ProcedureTab
              procedure={procedure.data}
              loading={procedure.isLoading}
              error={procedure.error}
              processId={id}
              onOpenAi={() => {
                setAiType('procedure_draft');
                setActiveTab('Copilote IA');
              }}
            />
          ) : null}
          {activeTab === 'Backlog' ? (
            <BacklogTab
              backlog={backlog.data}
              loading={backlog.isLoading}
              error={backlog.error}
              onOpenAi={() => {
                setAiType('backlog_suggestions');
                setActiveTab('Copilote IA');
              }}
            />
          ) : null}
          {activeTab === 'Copilote IA' ? (
            <AiCopilotTab
              aiType={aiType}
              onAiTypeChange={setAiType}
              generations={aiGenerations.data ?? []}
              suggestions={aiSuggestions.data ?? []}
              loading={aiGenerations.isLoading || aiSuggestions.isLoading}
              error={generateAi.error ?? aiGenerations.error ?? aiSuggestions.error}
              generating={generateAi.isPending}
              onGenerate={() => generateAi.mutate()}
              onAccept={(sid) => acceptAi.mutate(sid)}
              onReject={(sid) => rejectAi.mutate(sid)}
              onValidate={(sid) => validateAi.mutate(sid)}
              onCreateKpi={(sid) => createKpiAi.mutate(sid)}
              onCreateRisk={(sid) => createRiskAi.mutate(sid)}
              onCreateControl={(sid) => createControlAi.mutate(sid)}
              onCreateBacklog={(sid) => createBacklogAi.mutate(sid)}
              onInsertProcedure={(sid) => insertProcedureAi.mutate(sid)}
              modifyId={aiModifyId}
              modifyText={aiModifyText}
              onStartModify={(suggestion) => {
                setAiModifyId(suggestion.id);
                setAiModifyText(JSON.stringify(suggestion.content, null, 2));
              }}
              onModifyTextChange={setAiModifyText}
              onCancelModify={() => {
                setAiModifyId('');
                setAiModifyText('');
              }}
              onSaveModify={(sid) => modifyAi.mutate(sid)}
              busy={
                acceptAi.isPending ||
                rejectAi.isPending ||
                validateAi.isPending ||
                modifyAi.isPending ||
                createKpiAi.isPending ||
                createRiskAi.isPending ||
                createControlAi.isPending ||
                createBacklogAi.isPending ||
                insertProcedureAi.isPending
              }
            />
          ) : null}
          {activeTab === 'Versions' ? (
            <VersionsTab
              versions={versions.data}
              loading={versions.isLoading}
              error={versions.error}
            />
          ) : null}
          {activeTab === 'Commentaires' ? (
            <CommentsTab
              comments={comments.data ?? []}
              loading={comments.isLoading}
              error={comments.error}
              body={commentBody}
              onBodyChange={setCommentBody}
              onCreate={() => createComment.mutate()}
              onResolve={(commentId) => resolveComment.mutate(commentId)}
              creating={createComment.isPending}
            />
          ) : null}
          {activeTab === 'Audit' ? (
            <AuditTab logs={audit.data ?? []} loading={audit.isLoading} error={audit.error} />
          ) : null}
        </section>
      </section>
    </main>
  );
}

export function TenantExportsPage() {
  const [exportType, setExportType] = useState<ExportType>('process_sheet');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [processId, setProcessId] = useState('preview-process-cloture');
  const queryClient = useQueryClient();
  const jobs = useQuery({ queryKey: ['exports'], queryFn: () => tenantApi.exports() });
  const create = useMutation({
    mutationFn: () =>
      tenantApi.createExport({
        export_type: exportType,
        export_format: exportFormat,
        process_id: processId || undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exports'] }),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => tenantApi.cancelExport(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exports'] }),
  });
  const retry = useMutation({
    mutationFn: (id: string) => tenantApi.retryExport(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exports'] }),
  });

  if (!hasTenantAccess()) return <AccessDenied />;

  return (
    <main className="tenant-shell">
      <TenantHeader />
      <section className="workshop-shell">
        <header className="workshop-header">
          <div>
            <p className="eyebrow">Exports officiels</p>
            <h1>Exports PDF, Word, Excel, JSON, BPMN XML et dossier documentaire</h1>
            <p>Les exports officiels proviennent des donnees structurees et validees.</p>
          </div>
          <div className="workshop-actions">
            <Link className="button-link" to={`/tenant/processes/${processId}/workshop`}>
              Atelier
            </Link>
          </div>
        </header>
        <div className="workshop-grid">
          <ExportDrawer
            exportType={exportType}
            exportFormat={exportFormat}
            processId={processId}
            onTypeChange={setExportType}
            onFormatChange={setExportFormat}
            onProcessChange={setProcessId}
            onCreate={() => create.mutate()}
            creating={create.isPending}
            error={create.error}
          />
          <ExportJobList
            jobs={jobs.data ?? []}
            loading={jobs.isLoading}
            error={jobs.error}
            onCancel={(id) => cancel.mutate(id)}
            onRetry={(id) => retry.mutate(id)}
          />
        </div>
      </section>
    </main>
  );
}

function ExportDrawer({
  exportType,
  exportFormat,
  processId,
  creating,
  error,
  onTypeChange,
  onFormatChange,
  onProcessChange,
  onCreate,
}: {
  exportType: ExportType;
  exportFormat: ExportFormat;
  processId: string;
  creating: boolean;
  error: Error | null;
  onTypeChange: (value: ExportType) => void;
  onFormatChange: (value: ExportFormat) => void;
  onProcessChange: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <article className="admin-panel detail-panel">
      <h2>Demander un export officiel</h2>
      <ExportTypeSelector value={exportType} onChange={onTypeChange} />
      <ExportFormatSelector value={exportFormat} onChange={onFormatChange} />
      <input
        value={processId}
        onChange={(event) => onProcessChange(event.target.value)}
        placeholder="Process ID"
      />
      <button type="button" onClick={onCreate} disabled={creating}>
        Demander export
      </button>
      {error ? <p className="error-text">{error.message}</p> : null}
    </article>
  );
}

function ExportTypeSelector({
  value,
  onChange,
}: {
  value: ExportType;
  onChange: (value: ExportType) => void;
}) {
  return (
    <label>
      Type export
      <select value={value} onChange={(event) => onChange(event.target.value as ExportType)}>
        {exportTypes.map((type) => (
          <option key={type} value={type}>
            {exportTypeLabel(type)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ExportFormatSelector({
  value,
  onChange,
}: {
  value: ExportFormat;
  onChange: (value: ExportFormat) => void;
}) {
  return (
    <label>
      Format
      <select value={value} onChange={(event) => onChange(event.target.value as ExportFormat)}>
        {exportFormats.map((format) => (
          <option key={format} value={format}>
            {formatLabel(format)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ExportJobList({
  jobs,
  loading,
  error,
  onCancel,
  onRetry,
}: {
  jobs: ExportJob[];
  loading: boolean;
  error: Error | null;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  return (
    <article className="admin-panel wide detail-panel">
      <h2>Historique des exports</h2>
      {loading ? <p className="empty-inline">Chargement exports...</p> : null}
      {error ? <p className="error-text">{error.message}</p> : null}
      {jobs.length ? (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Format</th>
                <th>Statut</th>
                <th>Fichier</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{exportTypeLabel(job.exportType as ExportType)}</td>
                  <td>{formatLabel(job.format as ExportFormat)}</td>
                  <td>
                    <ExportStatusBadge status={job.status} />
                  </td>
                  <td>{job.fileName ?? '-'}</td>
                  <td>
                    <ExportDownloadButton job={job} />
                    {job.status === 'PENDING' ? (
                      <button type="button" onClick={() => onCancel(job.id)}>
                        Annuler
                      </button>
                    ) : null}
                    {job.status === 'FAILED' ? (
                      <button type="button" onClick={() => onRetry(job.id)}>
                        Relancer
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-inline">Aucun export.</p>
      )}
    </article>
  );
}

function ExportStatusBadge({ status }: { status: string }) {
  return <span className="status-badge">{status}</span>;
}

function exportTypeLabel(type: ExportType) {
  const labels: Record<ExportType, string> = {
    process_sheet: 'Fiche processus',
    procedure: 'Procedure',
    raci_matrix: 'Matrice RACI',
    bpmn_diagram: 'Diagramme BPMN',
    risk_register: 'Registre des risques',
    kpi_register: 'Registre KPI',
    backlog: 'Backlog',
    direction_summary: 'Synthese direction',
    executive_summary: 'Synthese executive',
    morocco_compliance: 'Conformite Maroc',
    process_mining_report: 'Rapport process mining',
    audit_extract: 'Extrait audit',
    full_package: 'Dossier complet',
  };
  return labels[type] ?? type;
}

function formatLabel(format: ExportFormat) {
  const labels: Record<ExportFormat, string> = {
    pdf: 'PDF',
    docx: 'Word',
    xlsx: 'Excel',
    json: 'JSON',
    bpmn_xml: 'BPMN XML',
    zip: 'ZIP',
    csv: 'CSV',
  };
  return labels[format] ?? format;
}

function ExportDownloadButton({ job }: { job: ExportJob }) {
  if (job.status !== 'COMPLETED')
    return <span className="empty-inline">Telechargement indisponible</span>;
  return (
    <a className="button-link" href={tenantApi.exportDownloadUrl(job.id)}>
      Telecharger
    </a>
  );
}

function WorkshopPanelState({ loading, error }: { loading: boolean; error: Error | null }) {
  if (loading) return <p className="empty-inline">Chargement...</p>;
  if (error) return <p className="error-text">{error.message}</p>;
  return null;
}

function WorkshopOverviewTab({
  overview,
  processId,
}: {
  overview: WorkshopOverview;
  processId: string;
}) {
  return (
    <div className="workshop-grid">
      <article className="admin-panel detail-panel">
        <h2>Etat du processus</h2>
        <KeyValue label="Code" value={overview.process.code ?? '-'} />
        <KeyValue label="Direction" value={overview.process.direction?.name ?? '-'} />
        <KeyValue label="Proprietaire" value={overview.process.owner?.name ?? '-'} />
        <KeyValue label="Publication" value={overview.process.publication_status} />
        <KeyValue
          label="Derniere modification"
          value={new Date(overview.process.updated_at).toLocaleString()}
        />
      </article>
      <article className="admin-panel detail-panel">
        <h2>Alertes principales</h2>
        <IssueList title="Blocages" items={overview.alerts.blocking.map((item) => item.message)} />
        <IssueList title="Warnings" items={overview.alerts.warnings.map((item) => item.message)} />
      </article>
      <article className="admin-panel detail-panel">
        <h2>Actions</h2>
        <Link className="button-link" to={`/tenant/processes/${processId}/wizard`}>
          Corriger dans le wizard
        </Link>
        <Link className="button-link" to={`/tenant/processes/${processId}/bpmn`}>
          BPMN detaille
        </Link>
        <Link className="button-link" to={`/tenant/processes/${processId}/raci`}>
          RACI detaille
        </Link>
        <IssueList title="Recommandations" items={overview.alerts.recommendations} />
      </article>
    </div>
  );
}

function WorkshopBpmnTab({
  bpmn,
  loading,
  error,
  processId,
  onGenerate,
  onValidate,
  onInvalidate,
}: {
  bpmn?: BpmnResult;
  loading: boolean;
  error: Error | null;
  processId: string;
  onGenerate: () => void;
  onValidate: () => void;
  onInvalidate: () => void;
}) {
  const [view, setView] = useState<'premium' | 'xml'>('premium');
  return (
    <article className="detail-panel">
      <WorkshopPanelState loading={loading} error={error} />
      {bpmn ? (
        <>
          <BpmnToolbar
            bpmn={bpmn}
            processId={processId}
            onGenerate={onGenerate}
            onRecalculate={onGenerate}
            onValidate={onValidate}
            onInvalidate={onInvalidate}
            busy={false}
          />
          <BpmnViewTabs value={view} onChange={setView} />
          {view === 'premium' ? <PremiumBpmnViewer bpmn={bpmn} /> : <BpmnViewer bpmn={bpmn} />}
          <BpmnIssuesPanel bpmn={bpmn} />
          <BpmnWarningsPanel bpmn={bpmn} />
          <BpmnRecommendationsPanel bpmn={bpmn} />
        </>
      ) : !loading ? (
        <p className="empty-inline">BPMN non genere.</p>
      ) : null}
    </article>
  );
}

function WorkshopRaciTab({
  raci,
  loading,
  error,
  processId,
  onGenerate,
  onValidate,
  onInvalidate,
}: {
  raci?: RaciResult;
  loading: boolean;
  error: Error | null;
  processId: string;
  onGenerate: () => void;
  onValidate: () => void;
  onInvalidate: () => void;
}) {
  return (
    <article className="detail-panel">
      <WorkshopPanelState loading={loading} error={error} />
      {raci ? (
        <>
          <RaciToolbar
            raci={raci}
            processId={processId}
            onGenerate={onGenerate}
            onRecalculate={onGenerate}
            onValidate={onValidate}
            onInvalidate={onInvalidate}
            busy={false}
          />
          <RaciMatrix raci={raci} />
          <RaciIssuesPanel raci={raci} />
          <RaciRecommendationsPanel raci={raci} />
        </>
      ) : !loading ? (
        <p className="empty-inline">RACI non generee.</p>
      ) : null}
    </article>
  );
}

function WorkflowTab({ overview }: { overview: WorkshopOverview }) {
  return (
    <article className="admin-panel wide detail-panel">
      <h2>Workflow</h2>
      <KeyValue label="Statut actuel" value={overview.process.status} />
      <KeyValue label="Publication" value={overview.process.publication_status} />
      <JsonBlock value={overview.workflow} />
    </article>
  );
}

function KpiTab({ process }: { process: WorkshopOverview['process'] }) {
  return (
    <article className="admin-panel wide detail-panel">
      <h2>KPI</h2>
      <p className="empty-inline">KPI du processus et warnings qualite associes.</p>
      <Link className="button-link" to={`/tenant/processes/${process.id}/wizard`}>
        Retour etape KPI
      </Link>
    </article>
  );
}

function RiskTab({ processId }: { processId: string }) {
  return (
    <article className="admin-panel wide detail-panel">
      <h2>Risques et controles</h2>
      <p className="empty-inline">
        Cartographie simple des risques, controles et preuves attendues.
      </p>
      <Link className="button-link" to={`/tenant/processes/${processId}/wizard`}>
        Retour etape Risques
      </Link>
    </article>
  );
}

function QualityTab({ quality, processId }: { quality: Completeness; processId: string }) {
  return (
    <article className="admin-panel wide detail-panel">
      <h2>Controle Qualite</h2>
      <Score completeness={quality} />
      <SectionScoreList sections={quality.sections} onSelectStep={() => {}} />
      <IssueList
        title="Blocages"
        items={quality.blockingIssueDetails?.map((item) => item.message) ?? []}
      />
      <IssueList
        title="Warnings"
        items={quality.warningDetails?.map((item) => item.message) ?? []}
      />
      <Link className="button-link" to={`/tenant/processes/${processId}/wizard`}>
        Aller vers correction
      </Link>
    </article>
  );
}

function MoroccoTab({ overview, processId }: { overview: WorkshopOverview; processId: string }) {
  return (
    <article className="admin-panel wide detail-panel">
      <h2>Conformite Maroc</h2>
      <p className="empty-inline">
        Cet outil facilite la structuration, la documentation et la tracabilite. Il ne constitue pas
        un avis juridique et ne garantit pas a lui seul la conformite reglementaire.
      </p>
      <JsonBlock value={overview.morocco ?? {}} />
      <Link className="button-link" to={`/tenant/processes/${processId}`}>
        Fiche processus
      </Link>
    </article>
  );
}

function ProcessMiningWorkshopTab({ logs, loading }: { logs: EventLogImport[]; loading: boolean }) {
  return (
    <article className="admin-panel wide detail-panel">
      <h2>Process Mining</h2>
      <p className="empty-inline">Analyse avancee par worker Python optionnel a venir.</p>
      {loading ? <p className="empty-inline">Chargement...</p> : null}
      {logs.length ? <JsonBlock value={logs} /> : <p className="empty-inline">Aucun event log.</p>}
    </article>
  );
}

function ProcedureTab({
  procedure,
  loading,
  error,
  processId,
  onOpenAi,
}: {
  procedure?: WorkshopProcedure;
  loading: boolean;
  error: Error | null;
  processId: string;
  onOpenAi: () => void;
}) {
  return (
    <article className="admin-panel wide detail-panel">
      <h2>Procedure</h2>
      <button className="button-link" type="button" onClick={onOpenAi}>
        Generer brouillon IA
      </button>
      <Link className="button-link" to={`/tenant/processes/${processId}/procedure`}>
        Procedure qualite structuree
      </Link>
      <WorkshopPanelState loading={loading} error={error} />
      {procedure ? (
        <>
          <p className="empty-inline">{procedure.disclaimer}</p>
          <div className="procedure-sections">
            {procedure.sections.map((section) => (
              <section key={section.key}>
                <h3>{section.title}</h3>
                <span className="status-badge">{section.source}</span>
                <JsonBlock value={section.content} />
              </section>
            ))}
          </div>
        </>
      ) : null}
    </article>
  );
}

function BacklogTab({
  backlog,
  loading,
  error,
  onOpenAi,
}: {
  backlog?: WorkshopBacklog;
  loading: boolean;
  error: Error | null;
  onOpenAi: () => void;
}) {
  return (
    <article className="admin-panel wide detail-panel">
      <h2>Backlog</h2>
      <button className="button-link" type="button" onClick={onOpenAi}>
        Proposer backlog IA
      </button>
      <WorkshopPanelState loading={loading} error={error} />
      {backlog?.items.length ? (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Titre</th>
                <th>Type</th>
                <th>Source</th>
                <th>Priorite</th>
                <th>Impact</th>
                <th>Complexite</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {backlog.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.type}</td>
                  <td>{item.source}</td>
                  <td>{item.priority}</td>
                  <td>{item.impact}</td>
                  <td>{item.complexity}</td>
                  <td>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading ? (
        <p className="empty-inline">Backlog vide.</p>
      ) : null}
    </article>
  );
}

function AiCopilotTab({
  aiType,
  onAiTypeChange,
  generations,
  suggestions,
  loading,
  error,
  generating,
  busy,
  modifyId,
  modifyText,
  onGenerate,
  onAccept,
  onReject,
  onValidate,
  onCreateKpi,
  onCreateRisk,
  onCreateControl,
  onCreateBacklog,
  onInsertProcedure,
  onStartModify,
  onModifyTextChange,
  onCancelModify,
  onSaveModify,
}: {
  aiType: AiGenerationType;
  onAiTypeChange: (type: AiGenerationType) => void;
  generations: AiGeneration[];
  suggestions: AiSuggestion[];
  loading: boolean;
  error: Error | null;
  generating: boolean;
  busy: boolean;
  modifyId: string;
  modifyText: string;
  onGenerate: () => void;
  onAccept: (suggestionId: string) => void;
  onReject: (suggestionId: string) => void;
  onValidate: (suggestionId: string) => void;
  onCreateKpi: (suggestionId: string) => void;
  onCreateRisk: (suggestionId: string) => void;
  onCreateControl: (suggestionId: string) => void;
  onCreateBacklog: (suggestionId: string) => void;
  onInsertProcedure: (suggestionId: string) => void;
  onStartModify: (suggestion: AiSuggestion) => void;
  onModifyTextChange: (value: string) => void;
  onCancelModify: () => void;
  onSaveModify: (suggestionId: string) => void;
}) {
  const readonly = !canManageAiSuggestions();
  return (
    <div className="workshop-grid">
      <article className="admin-panel wide detail-panel">
        <h2>Copilote IA</h2>
        <div className="quality-messages">
          <p className="empty-inline">L'IA est un copilote, pas une source officielle.</p>
          <p className="empty-inline">Toute suggestion doit etre validee humainement.</p>
          <p className="empty-inline">Aucune suggestion n'est appliquee automatiquement.</p>
        </div>
        {error?.message.includes('Copilote IA non') ? (
          <p className="error-text">Copilote IA non active pour ce tenant</p>
        ) : null}
        <div className="wizard-actions">
          <select
            value={aiType}
            onChange={(event) => onAiTypeChange(event.target.value as AiGenerationType)}
          >
            {aiGenerationTypes.map((type) => (
              <option key={type} value={type}>
                {aiTypeLabel(type)}
              </option>
            ))}
          </select>
          <button type="button" onClick={onGenerate} disabled={generating || readonly}>
            {generating ? 'Generation...' : 'Generer'}
          </button>
        </div>
        {loading ? <p className="empty-inline">Chargement du copilote IA...</p> : null}
        {error && !error.message.includes('Copilote IA non') ? (
          <p className="error-text">{error.message}</p>
        ) : null}
      </article>

      <article className="admin-panel detail-panel">
        <h2>Historique</h2>
        {generations.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Provider</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {generations.map((generation) => (
                  <tr key={generation.id}>
                    <td>{aiTypeLabel(generation.purpose as AiGenerationType)}</td>
                    <td>{generation.provider}</td>
                    <td>{new Date(generation.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !loading ? (
          <p className="empty-inline">Aucune generation IA.</p>
        ) : null}
      </article>

      <article className="admin-panel wide detail-panel">
        <h2>Suggestions</h2>
        {!suggestions.length && !loading ? (
          <p className="empty-inline">Aucune suggestion IA.</p>
        ) : null}
        <div className="procedure-sections">
          {suggestions.map((suggestion) => (
            <section key={suggestion.id}>
              <h3>{String(suggestion.content.title ?? suggestion.suggestionType)}</h3>
              <span className="status-badge">{suggestion.status}</span>
              <p className="empty-inline">{String(suggestion.content.description ?? '')}</p>
              <KeyValue label="Type" value={suggestion.suggestionType} />
              <KeyValue label="Priorite" value={String(suggestion.content.priority ?? '-')} />
              <KeyValue label="Provider" value="Voir historique generation" />
              <KeyValue label="Date" value={new Date(suggestion.createdAt).toLocaleString()} />
              {modifyId === suggestion.id ? (
                <div className="wizard-fields">
                  <textarea
                    value={modifyText}
                    onChange={(event) => onModifyTextChange(event.target.value)}
                  />
                  <div className="wizard-actions">
                    <button
                      type="button"
                      onClick={() => onSaveModify(suggestion.id)}
                      disabled={busy}
                    >
                      Enregistrer modification
                    </button>
                    <button type="button" onClick={onCancelModify}>
                      Annuler
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="wizard-actions">
                <button
                  type="button"
                  onClick={() => onAccept(suggestion.id)}
                  disabled={busy || readonly}
                >
                  Accepter
                </button>
                <button
                  type="button"
                  onClick={() => onStartModify(suggestion)}
                  disabled={busy || readonly}
                >
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => onReject(suggestion.id)}
                  disabled={busy || readonly}
                >
                  Rejeter
                </button>
                <button
                  type="button"
                  onClick={() => onValidate(suggestion.id)}
                  disabled={busy || readonly}
                >
                  Valider
                </button>
                <button
                  type="button"
                  onClick={() => onCreateKpi(suggestion.id)}
                  disabled={busy || readonly}
                >
                  Creer KPI
                </button>
                <button
                  type="button"
                  onClick={() => onCreateRisk(suggestion.id)}
                  disabled={busy || readonly}
                >
                  Creer risque
                </button>
                <button
                  type="button"
                  onClick={() => onCreateControl(suggestion.id)}
                  disabled={busy || readonly}
                >
                  Creer controle
                </button>
                <button
                  type="button"
                  onClick={() => onCreateBacklog(suggestion.id)}
                  disabled={busy || readonly}
                >
                  Creer backlog
                </button>
                <button
                  type="button"
                  onClick={() => onInsertProcedure(suggestion.id)}
                  disabled={busy || readonly}
                >
                  Inserer brouillon procedure
                </button>
              </div>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}

function parseAiModification(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {
      title: 'Suggestion modifiee',
      description: value,
      requiresHumanValidation: true,
    };
  }
}

function aiTypeLabel(type: AiGenerationType) {
  return type.replace(/_/g, ' ');
}

export function ProcedurePage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [activeSectionId, setActiveSectionId] = useState('');
  const [sectionText, setSectionText] = useState('');
  const [comment, setComment] = useState('');
  const procedure = useQuery({
    queryKey: ['procedure', id],
    queryFn: () => tenantApi.procedure(id),
  });
  const versions = useQuery({
    queryKey: ['procedure-versions', id],
    queryFn: () => tenantApi.procedureVersions(id),
  });
  const diff = useQuery({
    queryKey: ['procedure-diff', id],
    queryFn: () => tenantApi.procedureDiff(id),
  });
  const selected =
    procedure.data?.sections.find((section) => section.id === activeSectionId) ??
    procedure.data?.sections[0];

  useEffect(() => {
    if (!selected) return;
    setActiveSectionId(selected.id);
    setSectionText(
      typeof selected.content === 'string'
        ? selected.content
        : JSON.stringify(selected.content, null, 2),
    );
  }, [selected?.id]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['procedure', id] });
    queryClient.invalidateQueries({ queryKey: ['procedure-versions', id] });
    queryClient.invalidateQueries({ queryKey: ['procedure-diff', id] });
  };
  const generate = useMutation({
    mutationFn: () => tenantApi.generateProcedure(id),
    onSuccess: refresh,
  });
  const saveSection = useMutation({
    mutationFn: () =>
      selected
        ? tenantApi.updateProcedureSection(id, selected.id, {
            content: parseProcedureContent(sectionText),
            status: 'ready',
            comment,
          })
        : Promise.reject(new Error('Section manquante')),
    onSuccess: refresh,
  });
  const submit = useMutation({
    mutationFn: () => tenantApi.submitProcedureReview(id),
    onSuccess: refresh,
  });
  const requestChanges = useMutation({
    mutationFn: () => tenantApi.requestProcedureChanges(id, comment),
    onSuccess: refresh,
  });
  const approve = useMutation({
    mutationFn: () => tenantApi.approveProcedure(id),
    onSuccess: refresh,
  });
  const publish = useMutation({
    mutationFn: () => tenantApi.publishProcedure(id),
    onSuccess: refresh,
  });
  const archive = useMutation({
    mutationFn: () => tenantApi.archiveProcedure(id, comment),
    onSuccess: refresh,
  });
  const aiDraft = useMutation({
    mutationFn: () => tenantApi.generateProcedureAiDraft(id),
    onSuccess: refresh,
  });

  if (!hasTenantAccess()) return <AccessDenied />;

  return (
    <main className="tenant-shell">
      <TenantHeader />
      <section className="workshop-shell">
        <ProcedureHeader
          procedure={procedure.data ?? undefined}
          loading={procedure.isLoading}
          onGenerate={() => generate.mutate()}
        />
        <div className="workshop-tabs">
          <Link className="button-link" to={`/tenant/processes/${id}/workshop`}>
            Retour Atelier
          </Link>
        </div>
        <section className="workshop-content">
          {procedure.error ? <p className="error-text">{procedure.error.message}</p> : null}
          <div className="quality-messages">
            <p className="empty-inline">
              Structure documentaire facilitant l'alignement avec un systeme de management de la
              qualite.
            </p>
            <p className="empty-inline">
              Cette procedure ne certifie pas automatiquement ISO 9001.
            </p>
            <p className="empty-inline">Une publication officielle exige une validation humaine.</p>
          </div>
          {!procedure.data && !procedure.isLoading ? (
            <article className="admin-panel wide detail-panel">
              <h2>Procedure</h2>
              <p className="empty-inline">Aucune procedure structuree generee.</p>
              <button type="button" onClick={() => generate.mutate()} disabled={generate.isPending}>
                Generer procedure
              </button>
            </article>
          ) : null}
          {procedure.data ? (
            <div className="workshop-grid">
              <ProcedureSectionEditor
                procedure={procedure.data}
                selected={selected}
                sectionText={sectionText}
                comment={comment}
                onSelect={(section) => setActiveSectionId(section.id)}
                onTextChange={setSectionText}
                onCommentChange={setComment}
                onSave={() => saveSection.mutate()}
                saving={saveSection.isPending}
              />
              <ProcedureValidationPanel
                procedure={procedure.data}
                comment={comment}
                onCommentChange={setComment}
                onSubmit={() => submit.mutate()}
                onRequestChanges={() => requestChanges.mutate()}
                onApprove={() => approve.mutate()}
                onPublish={() => publish.mutate()}
                onArchive={() => archive.mutate()}
              />
              <ProcedureAiDraftPanel
                onGenerate={() => aiDraft.mutate()}
                loading={aiDraft.isPending}
              />
              <ProcedureVersionsPanel versions={versions.data ?? []} loading={versions.isLoading} />
              <ProcedureDiffPanel diff={diff.data ?? {}} />
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function ProcedureHeader({
  procedure,
  loading,
  onGenerate,
}: {
  procedure?: ProcedureDocument;
  loading: boolean;
  onGenerate: () => void;
}) {
  return (
    <header className="workshop-header">
      <div>
        <p className="eyebrow">Procedure qualite structuree</p>
        <h1>{procedure?.title ?? 'Procedure'}</h1>
        <p>{loading ? 'Chargement...' : 'Documentation ISO 9001 a validation humaine.'}</p>
      </div>
      <div className="workshop-actions">
        <ProcedureStatusBadge status={procedure?.status ?? 'none'} />
        <button type="button" onClick={onGenerate}>
          Generer procedure
        </button>
      </div>
    </header>
  );
}

function ProcedureStatusBadge({ status }: { status: string }) {
  return <span className="status-badge">{status}</span>;
}

function ProcedureSectionEditor({
  procedure,
  selected,
  sectionText,
  comment,
  onSelect,
  onTextChange,
  onCommentChange,
  onSave,
  saving,
}: {
  procedure: ProcedureDocument;
  selected?: ProcedureSection;
  sectionText: string;
  comment: string;
  onSelect: (section: ProcedureSection) => void;
  onTextChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const readonly = procedure.status === 'published' || !canManageAiSuggestions();
  return (
    <article className="admin-panel wide detail-panel">
      <h2>Structure</h2>
      <div className="section-score-list">
        {procedure.sections.map((section) => (
          <button type="button" key={section.id} onClick={() => onSelect(section)}>
            <span
              className={`section-dot ${section.status === 'approved' ? 'complete' : 'warning'}`}
            />
            <span>{section.title}</span>
            <strong>{section.source}</strong>
          </button>
        ))}
      </div>
      {selected ? (
        <div className="wizard-fields">
          <h3>{selected.title}</h3>
          <KeyValue
            label="Source deterministe"
            value={selected.deterministicContent ? 'oui' : selected.source}
          />
          <KeyValue label="Source manuelle" value={selected.manualContent ? 'oui' : '-'} />
          <KeyValue label="Source IA" value={selected.aiContent ? 'oui' : '-'} />
          <KeyValue label="Statut" value={selected.status} />
          <textarea
            value={sectionText}
            onChange={(event) => onTextChange(event.target.value)}
            disabled={readonly}
          />
          <input
            placeholder="Commentaire section"
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
          />
          <button type="button" onClick={onSave} disabled={saving || readonly}>
            Sauvegarder
          </button>
        </div>
      ) : null}
    </article>
  );
}

function ProcedureValidationPanel({
  procedure,
  comment,
  onCommentChange,
  onSubmit,
  onRequestChanges,
  onApprove,
  onPublish,
  onArchive,
}: {
  procedure: ProcedureDocument;
  comment: string;
  onCommentChange: (value: string) => void;
  onSubmit: () => void;
  onRequestChanges: () => void;
  onApprove: () => void;
  onPublish: () => void;
  onArchive: () => void;
}) {
  return (
    <article className="admin-panel detail-panel">
      <h2>Validation</h2>
      <KeyValue label="Reference" value={procedure.reference} />
      <KeyValue label="Version" value={String(procedure.versionNumber)} />
      <KeyValue label="Regle" value={procedure.ruleVersion} />
      <KeyValue label="Confidentialite" value={procedure.confidentialityLevel} />
      <input
        placeholder="Commentaire obligatoire correction/archive"
        value={comment}
        onChange={(event) => onCommentChange(event.target.value)}
      />
      <div className="wizard-actions">
        <button type="button" onClick={onSubmit}>
          Soumettre en revue
        </button>
        <button type="button" onClick={onRequestChanges}>
          Demander correction
        </button>
        <button type="button" onClick={onApprove}>
          Approuver
        </button>
        <button type="button" onClick={onPublish}>
          Publier
        </button>
        <button type="button" onClick={onArchive}>
          Archiver
        </button>
      </div>
    </article>
  );
}

function ProcedureVersionsPanel({
  versions,
  loading,
}: {
  versions: ProcedureVersion[];
  loading: boolean;
}) {
  return (
    <article className="admin-panel detail-panel">
      <h2>Versions</h2>
      {loading ? <p className="empty-inline">Chargement...</p> : null}
      {versions.length ? (
        versions.map((version) => (
          <KeyValue
            key={version.id}
            label={`Version ${version.versionNumber}`}
            value={version.status}
          />
        ))
      ) : (
        <p className="empty-inline">Aucune version publiee.</p>
      )}
    </article>
  );
}

function ProcedureDiffPanel({ diff }: { diff: Record<string, unknown> }) {
  return (
    <article className="admin-panel detail-panel">
      <h2>Diff</h2>
      <JsonBlock value={diff} />
    </article>
  );
}

function ProcedureAiDraftPanel({
  onGenerate,
  loading,
}: {
  onGenerate: () => void;
  loading: boolean;
}) {
  return (
    <article className="admin-panel detail-panel">
      <h2>Brouillon IA</h2>
      <p className="empty-inline">
        Brouillon genere par IA, a valider par un responsable habilite.
      </p>
      <button type="button" onClick={onGenerate} disabled={loading}>
        Generer brouillon IA
      </button>
    </article>
  );
}

function parseProcedureContent(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return { text: value };
  }
}

function VersionsTab({
  versions,
  loading,
  error,
}: {
  versions?: WorkshopVersions;
  loading: boolean;
  error: Error | null;
}) {
  return (
    <article className="admin-panel wide detail-panel">
      <h2>Versions</h2>
      <WorkshopPanelState loading={loading} error={error} />
      {versions ? <JsonBlock value={versions} /> : null}
    </article>
  );
}

function CommentsTab({
  comments,
  loading,
  error,
  body,
  onBodyChange,
  onCreate,
  onResolve,
  creating,
}: {
  comments: { id: string; body: string; status: string; createdAt: string }[];
  loading: boolean;
  error: Error | null;
  body: string;
  onBodyChange: (value: string) => void;
  onCreate: () => void;
  onResolve: (commentId: string) => void;
  creating: boolean;
}) {
  return (
    <article className="admin-panel wide detail-panel">
      <h2>Commentaires</h2>
      <WorkshopPanelState loading={loading} error={error} />
      <textarea
        value={body}
        onChange={(event) => onBodyChange(event.target.value)}
        placeholder="Ajouter un commentaire"
      />
      <button type="button" disabled={creating || !body.trim()} onClick={onCreate}>
        Ajouter commentaire
      </button>
      {comments.length ? (
        <div className="compact-list">
          {comments.map((comment) => (
            <article key={comment.id}>
              <div>
                <strong>{comment.body}</strong>
                <span>
                  {comment.status} - {new Date(comment.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onResolve(comment.id)}
                disabled={comment.status === 'resolved'}
              >
                Resoudre
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-inline">Aucun commentaire.</p>
      )}
    </article>
  );
}

function AuditTab({
  logs,
  loading,
  error,
}: {
  logs: { id: string; action: string; createdAt: string }[];
  loading: boolean;
  error: Error | null;
}) {
  return (
    <article className="admin-panel wide detail-panel">
      <h2>Audit</h2>
      <WorkshopPanelState loading={loading} error={error} />
      <IssueList
        title="Actions"
        items={logs.map((item) => `${item.action} - ${new Date(item.createdAt).toLocaleString()}`)}
      />
    </article>
  );
}

function KeyValue({ label, value }: { label: string; value: string | number }) {
  return (
    <p className="key-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </p>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="analysis-output">{JSON.stringify(value, null, 2)}</pre>;
}

function IssueList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="quality-checklist">
      <h3>{title}</h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-inline">Aucun element.</p>
      )}
    </section>
  );
}

export function ProcessWizardPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error' | 'conflict'>(
    'saved',
  );
  const [lockVersion, setLockVersion] = useState<number | undefined>();
  const wizard = useQuery({ queryKey: ['wizard', id], queryFn: () => tenantApi.wizard(id) });
  const form = useForm<WizardForm>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {},
  });
  const process = wizard.data?.process;
  const completeness = wizard.data?.completeness;

  useEffect(() => {
    if (!process) return;
    setLockVersion(process.lockVersion);
    form.reset({
      name: process.name,
      code: process.code ?? '',
      description: process.description ?? '',
      objective: process.objective ?? '',
      scope: process.scope ?? '',
      trigger_event: process.triggerEvent ?? '',
      input_name: process.inputs?.[0]?.name ?? '',
      output_name: process.outputs?.[0]?.name ?? '',
      activity_name: process.activities?.[0]?.name ?? '',
      activity_output: process.activities?.[0]?.outputText ?? '',
    });
  }, [form, process]);

  const mutation = useMutation({
    mutationFn: (values: WizardForm) =>
      tenantApi.saveWizardStep(id, step, payloadForStep(step, values, process), lockVersion),
    onMutate: () => setSaveState('saving'),
    onSuccess: (result) => {
      setLockVersion(result.lock_version);
      setSaveState('saved');
      queryClient.invalidateQueries({ queryKey: ['wizard', id] });
    },
    onError: (error) => {
      setSaveState(
        error.message.includes('409') || error.message.includes('Conflit') ? 'conflict' : 'error',
      );
    },
  });
  const submit = useMutation({
    mutationFn: () => tenantApi.submitProcess(id, lockVersion),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wizard', id] }),
  });
  const recalculate = useMutation({
    mutationFn: () => tenantApi.recalculateCompleteness(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wizard', id] }),
  });

  const watched = form.watch();
  const currentPayload = useMemo(
    () => payloadForStep(step, watched, process),
    [step, watched, process],
  );
  useEffect(() => {
    if (!process) return;
    setSaveState('dirty');
    const handle = window.setTimeout(() => mutation.mutate(form.getValues()), 1000);
    return () => window.clearTimeout(handle);
  }, [currentPayload, form, mutation, process]);

  return (
    <main className="tenant-shell">
      <TenantHeader />
      <section className="process-workbench">
        <aside className="wizard-sidebar">
          <p className="eyebrow">Assistant processus</p>
          <h1>{process?.name ?? 'Wizard'}</h1>
          <Score completeness={completeness} />
          <SectionScoreList sections={completeness?.sections} onSelectStep={setStep} />
          <nav>
            {stepTitles.map((title, index) => (
              <button
                className={step === index + 1 ? 'active' : ''}
                key={title}
                onClick={() => setStep(index + 1)}
                type="button"
              >
                <span>{index + 1}</span>
                {title}
              </button>
            ))}
          </nav>
        </aside>
        <form
          className="wizard-panel"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="wizard-panel-header">
            <div>
              <p className="eyebrow">Etape {step} / 11</p>
              <h2>{stepTitles[step - 1]}</h2>
            </div>
            <span className={`save-state ${saveState}`}>{saveLabel(saveState)}</span>
          </div>
          <WizardStep
            step={step}
            form={form}
            process={process}
            completeness={completeness}
            onSelectStep={setStep}
          />
          <QualityMessages completeness={completeness} onSelectStep={setStep} />
          <div className="wizard-actions">
            <button type="button" onClick={() => setStep((value) => Math.max(1, value - 1))}>
              Precedent
            </button>
            <button type="submit" disabled={mutation.isPending}>
              Sauvegarder
            </button>
            <button
              type="button"
              onClick={() => recalculate.mutate()}
              disabled={recalculate.isPending}
            >
              Recalculer
            </button>
            {step < 11 ? (
              <button type="button" onClick={() => setStep((value) => Math.min(11, value + 1))}>
                Suivant
              </button>
            ) : (
              <button
                type="button"
                disabled={!completeness?.canSubmit || submit.isPending || saveState === 'conflict'}
                onClick={() => submit.mutate()}
              >
                Soumettre
              </button>
            )}
          </div>
          {mutation.error ? <p className="error-text">{mutation.error.message}</p> : null}
          {recalculate.error ? <p className="error-text">{recalculate.error.message}</p> : null}
          {submit.error ? <p className="error-text">{submit.error.message}</p> : null}
        </form>
      </section>
    </main>
  );
}

function WizardStep({
  step,
  form,
  process,
  completeness,
  onSelectStep,
}: {
  step: number;
  form: ReturnType<typeof useForm<WizardForm>>;
  process?: ProcessItem;
  completeness?: Completeness;
  onSelectStep: (step: number) => void;
}) {
  const raci = useQuery({
    queryKey: ['raci-preview', process?.id],
    queryFn: () => tenantApi.raci(process?.id ?? ''),
    enabled: Boolean(process?.id) && (step === 4 || step === 11),
  });
  const bpmn = useQuery({
    queryKey: ['bpmn-preview', process?.id],
    queryFn: () => tenantApi.bpmn(process?.id ?? ''),
    enabled: Boolean(process?.id) && (step === 3 || step === 11),
  });

  if (step === 1) {
    return (
      <div className="wizard-fields two">
        <input placeholder="Nom" {...form.register('name')} />
        <input placeholder="Code" {...form.register('code')} />
        <textarea placeholder="Description" {...form.register('description')} />
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="wizard-fields two">
        <textarea placeholder="Objectif" {...form.register('objective')} />
        <textarea placeholder="Perimetre" {...form.register('scope')} />
        <input placeholder="Declencheur" {...form.register('trigger_event')} />
        <input placeholder="Entree principale" {...form.register('input_name')} />
        <input placeholder="Sortie principale" {...form.register('output_name')} />
      </div>
    );
  }
  if (step === 3) {
    return (
      <DndContext>
        <div className="wizard-fields">
          <input placeholder="Nouvelle activite" {...form.register('activity_name')} />
          <input placeholder="Sortie de l'activite" {...form.register('activity_output')} />
          <div className="activity-board">
            {process?.activities?.map((activity) => (
              <article key={activity.id}>
                <strong>{activity.name}</strong>
                <span>{activity.outputText ?? 'Sortie non renseignee'}</span>
              </article>
            ))}
          </div>
          <div className="raci-preview">
            <p className="empty-inline">Sequence BPMN calculee depuis les activites structurees.</p>
            <Metric label="Blocages BPMN" value={bpmn.data?.blockingIssues.length ?? 0} />
            <Metric label="Warnings BPMN" value={bpmn.data?.warnings.length ?? 0} />
            <IssueList
              title="Signaux sequence"
              items={[
                ...(bpmn.data?.blockingIssues ?? []).map((item) => item.message),
                ...(bpmn.data?.warnings ?? [])
                  .filter((item) =>
                    ['orphan_activity', 'transition_to_missing', 'loop_detected'].includes(
                      item.code,
                    ),
                  )
                  .map((item) => item.message),
              ]}
            />
            <Link className="button-link" to={`/tenant/processes/${process?.id}/bpmn`}>
              Ouvrir BPMN detaille
            </Link>
          </div>
        </div>
      </DndContext>
    );
  }
  if (step === 4) {
    return (
      <div className="wizard-fields two">
        <select {...form.register('responsible_actor_id')}>
          <option value="">Responsible</option>
          {process?.ownerActor ? (
            <option value={process.ownerActor.id}>{process.ownerActor.name}</option>
          ) : null}
        </select>
        <select {...form.register('accountable_actor_id')}>
          <option value="">Accountable</option>
          {process?.ownerActor ? (
            <option value={process.ownerActor.id}>{process.ownerActor.name}</option>
          ) : null}
        </select>
        <div className="raci-preview">
          <p className="empty-inline">
            Les roles RACI sont controles par activite avant soumission.
          </p>
          <Metric label="Score RACI" value={raci.data ? `${raci.data.qualityScore}%` : '-'} />
          <Metric label="Blocages" value={raci.data?.blockingIssues.length ?? 0} />
          <Metric label="Warnings" value={raci.data?.warnings.length ?? 0} />
          <Link className="button-link" to={`/tenant/processes/${process?.id}/raci`}>
            Ouvrir matrice RACI detaillee
          </Link>
        </div>
      </div>
    );
  }
  if (step === 5)
    return <input placeholder="Document de reference" {...form.register('document_title')} />;
  if (step === 6)
    return <input placeholder="Application utilisee" {...form.register('application_name')} />;
  if (step === 7)
    return (
      <div className="wizard-fields">
        <input placeholder="KPI principal" {...form.register('kpi_name')} />
        <AiAssistLink processId={process?.id} label="Proposer des KPI" />
      </div>
    );
  if (step === 8)
    return (
      <div className="wizard-fields">
        <textarea
          placeholder="Risque ou controle principal"
          {...form.register('risk_description')}
        />
        <AiAssistLink processId={process?.id} label="Proposer des risques/controles" />
      </div>
    );
  if (step === 9)
    return (
      <div className="wizard-fields">
        <textarea placeholder="Point de douleur" {...form.register('pain_point')} />
        <AiAssistLink processId={process?.id} label="Proposer ameliorations" />
      </div>
    );
  if (step === 10)
    return (
      <div className="wizard-fields">
        <textarea placeholder="Besoin d'automatisation" {...form.register('automation_need')} />
        <AiAssistLink processId={process?.id} label="Proposer automatisations" />
      </div>
    );
  return (
    <div className="submission-review">
      <Score completeness={completeness} />
      <div className="metric-grid small">
        <Metric label="Statut RACI" value={raci.data?.validationStatus ?? 'Non generee'} />
        <Metric label="Blocages RACI" value={raci.data?.blockingIssues.length ?? 0} />
        <Metric label="Warnings RACI" value={raci.data?.warnings.length ?? 0} />
        <Metric label="Version RACI" value={raci.data?.versionNumber ?? '-'} />
        <Metric label="Statut BPMN" value={bpmn.data?.validationStatus ?? 'Non genere'} />
        <Metric label="Blocages BPMN" value={bpmn.data?.blockingIssues.length ?? 0} />
        <Metric label="Warnings BPMN" value={bpmn.data?.warnings.length ?? 0} />
        <Metric label="Version BPMN" value={bpmn.data?.versionNumber ?? '-'} />
      </div>
      <div className="wizard-actions">
        <Link className="button-link" to={`/tenant/processes/${process?.id}/bpmn`}>
          BPMN detaille
        </Link>
        <Link className="button-link" to={`/tenant/processes/${process?.id}/workshop`}>
          Atelier de Formalisation
        </Link>
        <AiAssistLink processId={process?.id} label="Analyser les incoherences" />
        <a className="button-link" href={`/api/v1/tenant/processes/${process?.id}/bpmn/export.xml`}>
          Export XML BPMN
        </a>
      </div>
      <h3>Checklist qualite</h3>
      <div className="quality-checklist">
        {(completeness?.sections?.length
          ? completeness.sections
          : fallbackSections(completeness)
        ).map((section) => (
          <button type="button" key={section.key} onClick={() => onSelectStep(section.wizardStep)}>
            <span className={`section-dot ${section.status}`} />
            <strong>{section.label}</strong>
            <small>
              {section.pointsObtained}/{section.pointsMax} pts
            </small>
            <em>{mainSectionProblem(section)}</em>
          </button>
        ))}
      </div>
    </div>
  );
}

function AiAssistLink({ processId, label }: { processId?: string; label: string }) {
  if (!processId) return null;
  return (
    <Link className="button-link" to={`/tenant/processes/${processId}/workshop`}>
      {label}
    </Link>
  );
}

function payloadForStep(step: number, values: WizardForm, process?: ProcessItem) {
  if (step === 1) {
    return {
      name: values.name,
      code: values.code,
      description: values.description,
    };
  }
  if (step === 2) {
    return {
      objective: values.objective,
      scope: values.scope,
      trigger_event: values.trigger_event,
      input_name: values.input_name,
      output_name: values.output_name,
    };
  }
  if (step === 3 && values.activity_name) {
    return {
      activities: [
        {
          name: values.activity_name,
          output_text: values.activity_output,
        },
      ],
    };
  }
  if (step === 4 && process?.activities?.[0]?.id) {
    const items = [
      values.responsible_actor_id
        ? {
            activity_id: process.activities[0].id,
            actor_id: values.responsible_actor_id,
            raci_role: 'RESPONSIBLE',
          }
        : null,
      values.accountable_actor_id
        ? {
            activity_id: process.activities[0].id,
            actor_id: values.accountable_actor_id,
            raci_role: 'ACCOUNTABLE',
          }
        : null,
    ].filter(Boolean);
    return { responsibilities: items };
  }
  return {};
}

function Score({ completeness }: { completeness?: Completeness }) {
  const score = completeness?.score ?? 0;
  return (
    <div className="score-box">
      <strong>{score}%</strong>
      <div className="progress-bar">
        <span style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <small>{completeness?.canSubmit ? 'Pret a soumettre' : 'Soumission bloquee'}</small>
    </div>
  );
}

function SectionScoreList({
  sections,
  onSelectStep,
}: {
  sections?: SectionCompleteness[];
  onSelectStep: (step: number) => void;
}) {
  if (!sections?.length) return null;
  return (
    <div className="section-score-list">
      {sections.map((section) => (
        <button type="button" key={section.key} onClick={() => onSelectStep(section.wizardStep)}>
          <span className={`section-dot ${section.status}`} />
          <span>{section.label}</span>
          <strong>{section.percentage}%</strong>
        </button>
      ))}
    </div>
  );
}

function QualityMessages({
  completeness,
  onSelectStep,
}: {
  completeness?: Completeness;
  onSelectStep: (step: number) => void;
}) {
  if (!completeness) return null;
  const blocking = completeness.blockingIssueDetails ?? issueFallback(completeness.blockingIssues);
  const warnings = completeness.warningDetails ?? issueFallback(completeness.warnings);
  return (
    <div className="quality-messages">
      <QualityList
        title="Blocages"
        empty="Aucun blocage"
        items={blocking}
        onSelectStep={onSelectStep}
      />
      <QualityList
        title="Alertes"
        empty="Aucune alerte"
        items={warnings}
        onSelectStep={onSelectStep}
      />
      <section>
        <h3>Recommandations</h3>
        {completeness.recommendations.length ? (
          <ul>
            {completeness.recommendations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="empty-inline">Aucune recommandation.</p>
        )}
      </section>
    </div>
  );
}

function QualityList({
  title,
  empty,
  items,
  onSelectStep,
}: {
  title: string;
  empty: string;
  items: { code: string; message: string; wizardStep: number }[];
  onSelectStep: (step: number) => void;
}) {
  return (
    <section>
      <h3>{title}</h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item.code}>
              <button
                type="button"
                className="link-button"
                onClick={() => onSelectStep(item.wizardStep)}
              >
                {item.message || item.code}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-inline">{empty}</p>
      )}
    </section>
  );
}

function fallbackSections(completeness?: Completeness): SectionCompleteness[] {
  if (!completeness) return [];
  return Object.entries(completeness.sectionScores).map(([key, points]) => ({
    key,
    label: key.replace(/_/g, ' '),
    wizardStep: 11,
    pointsObtained: points,
    pointsMax: points,
    percentage: completeness.sectionPercentages?.[key] ?? points,
    status: points > 0 ? 'complete' : 'incomplete',
    missingFields: [],
    blockingIssues: [],
    warnings: [],
    recommendations: [],
  }));
}

function mainSectionProblem(section: SectionCompleteness) {
  return (
    section.blockingIssues[0]?.message ??
    section.warnings[0]?.message ??
    section.recommendations[0] ??
    'OK'
  );
}

function issueFallback(codes: string[]) {
  return codes.map((code) => ({ code, message: code, wizardStep: 11 }));
}

function countJsonItems(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function AccessDenied() {
  return (
    <main className="tenant-shell">
      <section className="admin-empty">
        <BrandLogo variant="full" />
        <p className="eyebrow">Processus</p>
        <h1>Acces tenant refuse</h1>
      </section>
    </main>
  );
}

function saveLabel(state: 'saved' | 'dirty' | 'saving' | 'error' | 'conflict') {
  const labels = {
    saved: 'Enregistre',
    dirty: 'Modifications non sauvegardees',
    saving: 'Sauvegarde...',
    error: 'Erreur de sauvegarde',
    conflict: 'Conflit detecte',
  };
  return labels[state];
}
