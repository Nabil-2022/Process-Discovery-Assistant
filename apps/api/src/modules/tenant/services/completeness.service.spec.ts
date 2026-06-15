import { describe, expect, it, vi } from 'vitest';

import { ProcessStatus, RaciRole, RiskLevel } from '../../../generated/prisma';
import { CompletenessService } from './completeness.service';
import { SCORING_RULE_VERSION } from './completeness-rules';

function createService() {
  const prisma = {
    process: { update: vi.fn() },
    completenessAssessment: { create: vi.fn() },
  };
  return { service: new CompletenessService(prisma as never), prisma };
}

function process(overrides = {}) {
  return {
    id: 'process-a',
    tenantId: 'tenant-a',
    directionId: 'direction-a',
    categoryId: 'category-a',
    processOwnerActorId: 'actor-owner',
    code: 'FIN-CLOT',
    name: 'Cloture comptable',
    description: 'Description',
    objective: 'Produire les comptes mensuels',
    scope: 'Finance',
    triggerEvent: 'Fin de mois',
    status: ProcessStatus.DRAFT,
    lockVersion: 2,
    inputs: [{ id: 'input-a', name: 'Factures' }],
    outputs: [{ id: 'output-a', name: 'Etats financiers' }],
    activities: [
      {
        id: 'activity-a',
        name: 'Controler',
        outputText: 'Dossier controle',
        duration: '2 jours',
        isAutomated: true,
      },
    ],
    transitions: [],
    actorRoles: [
      { activityId: 'activity-a', actorId: 'actor-owner', raciRole: RaciRole.RESPONSIBLE },
      { activityId: 'activity-a', actorId: 'actor-owner', raciRole: RaciRole.ACCOUNTABLE },
    ],
    documents: [{ id: 'doc-link', document: { id: 'doc-a', title: 'Procedure', version: '1.0' } }],
    applications: [
      { id: 'app-link', application: { id: 'app-a', name: 'ERP', criticality: RiskLevel.LOW } },
    ],
    kpis: [{ id: 'kpi-a', name: 'Delai', target: 'J+3', evidence: { source: 'reporting' } }],
    risks: [
      {
        id: 'risk-a',
        description: 'Erreur de cutoff',
        inherentLevel: RiskLevel.HIGH,
        treatmentPlan: 'Revue mensuelle',
        controls: [
          {
            riskId: 'risk-a',
            controlId: 'control-a',
            control: { id: 'control-a', name: 'Revue', evidence: { type: 'checklist' } },
          },
        ],
      },
    ],
    bpmnModels: [
      {
        id: 'bpmn-a',
        validationStatus: 'VALIDATED',
        blockingIssues: [],
        warnings: [],
        generatedAt: new Date('2026-01-02T00:00:00Z'),
      },
    ],
    painPoints: [{ id: 'pain-a', description: 'Relances manuelles' }],
    automationNeeds: [{ id: 'auto-a', description: 'Rapprochement automatique' }],
    direction: { id: 'direction-a', name: 'Finance' },
    category: { id: 'category-a', name: 'Metier', code: 'METIER' },
    ownerActor: { id: 'actor-owner', name: 'Owner' },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  } as never;
}

describe('CompletenessService', () => {
  it('returns a weak score and blocking issues for an empty process', () => {
    const { service } = createService();
    const result = service.calculate(
      process({
        objective: null,
        scope: null,
        processOwnerActorId: null,
        inputs: [],
        outputs: [],
        activities: [],
        actorRoles: [],
        documents: [],
        applications: [],
        kpis: [],
        risks: [],
      }),
    );

    expect(result.score).toBeLessThan(80);
    expect(result.blockingIssues).toEqual(
      expect.arrayContaining([
        'missing_objective',
        'missing_scope',
        'missing_input',
        'missing_output',
        'missing_activity',
        'missing_process_owner',
      ]),
    );
    expect(result.canSubmit).toBe(false);
  });

  it('blocks missing Responsible and Accountable by activity', () => {
    const { service } = createService();
    const result = service.calculate(process({ actorRoles: [] }));

    expect(result.blockingIssues).toContain('missing_responsible');
    expect(result.blockingIssues).toContain('missing_accountable');
  });

  it('warns when multiple Accountable are assigned to the same activity', () => {
    const { service } = createService();
    const result = service.calculate(
      process({
        actorRoles: [
          { activityId: 'activity-a', actorId: 'actor-owner', raciRole: RaciRole.RESPONSIBLE },
          { activityId: 'activity-a', actorId: 'actor-owner', raciRole: RaciRole.ACCOUNTABLE },
          { activityId: 'activity-a', actorId: 'actor-b', raciRole: RaciRole.ACCOUNTABLE },
        ],
      }),
    );

    expect(result.warnings).toContain('multiple_accountable');
    expect(result.canSubmit).toBe(true);
  });

  it('creates non-blocking warnings for missing KPI, documents, applications and risks', () => {
    const { service } = createService();
    const result = service.calculate(
      process({
        documents: [],
        applications: [],
        kpis: [{ id: 'kpi-a', name: 'Delai', target: 'J+3', evidence: { source: 'reporting' } }],
        risks: [],
      }),
    );

    expect(result.warnings).toEqual(
      expect.arrayContaining(['missing_document', 'missing_application', 'missing_risk']),
    );
    expect(result.blockingIssues).not.toContain('missing_document');
  });

  it('blocks critical risks without a control', () => {
    const { service } = createService();
    const result = service.calculate(
      process({
        risks: [
          {
            id: 'risk-critical',
            description: 'Fraude',
            inherentLevel: RiskLevel.CRITICAL,
            treatmentPlan: 'Plan',
            controls: [],
          },
        ],
      }),
    );

    expect(result.blockingIssues).toContain('critical_risk_without_control');
  });

  it('integrates BPMN generation and graph issues in activity completeness', () => {
    const { service } = createService();

    expect(service.calculate(process({ bpmnModels: [] })).warnings).toContain('bpmn_not_generated');
    expect(
      service.calculate(
        process({
          bpmnModels: [
            {
              id: 'bpmn-bad',
              validationStatus: 'DRAFT',
              blockingIssues: [
                {
                  code: 'orphan_activity',
                  message: 'Activite orpheline.',
                  severity: 'blocking',
                },
              ],
              warnings: [],
              generatedAt: new Date('2026-01-03T00:00:00Z'),
            },
          ],
        }),
      ).blockingIssues,
    ).toContain('orphan_activity');
  });

  it('refuses submission below the 80 percent threshold', () => {
    const { service } = createService();
    const result = service.calculate(process({ documents: [], applications: [], risks: [] }));

    expect(result.score).toBeLessThan(80);
    expect(result.blockingIssues).toContain('score_below_threshold');
    expect(result.canSubmit).toBe(false);
  });

  it('allows submission at 80 percent or more when no blocking issue exists', () => {
    const { service } = createService();
    const result = service.calculate(process({ applications: [], risks: [] }));

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.blockingIssues).toEqual([]);
    expect(result.canSubmit).toBe(true);
  });

  it('refuses submission above 80 percent when a blocking issue remains', () => {
    const { service } = createService();
    const result = service.calculate(
      process({
        actorRoles: [
          { activityId: 'activity-a', actorId: 'actor-owner', raciRole: RaciRole.RESPONSIBLE },
        ],
      }),
    );

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.blockingIssues).toContain('missing_accountable');
    expect(result.canSubmit).toBe(false);
  });

  it('is deterministic for identical data and rule version', () => {
    const { service } = createService();
    const first = service.calculate(process());
    const second = service.calculate(process());

    expect(second.score).toBe(first.score);
    expect(second.sectionScores).toEqual(first.sectionScores);
    expect(second.scoringRuleVersion).toBe(SCORING_RULE_VERSION);
  });

  it('changes the score when process data changes', () => {
    const { service } = createService();

    expect(service.calculate(process({ kpis: [] })).score).toBeLessThan(
      service.calculate(process()).score,
    );
  });

  it('persists the scoring rule version and source lock version', async () => {
    const { service, prisma } = createService();
    const source = process();
    const result = service.calculate(source);

    await service.persist(
      {
        tenantId: 'tenant-a',
        actorUserId: 'admin-a',
        tenantRoles: ['tenant_admin'],
        permissions: ['update_process_working_copy'],
        directionIds: [],
        isSupportAccess: false,
      },
      source as never,
      result,
      'snapshot-hash',
    );

    expect(prisma.completenessAssessment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ruleVersion: SCORING_RULE_VERSION,
          sourceLockVersion: 2,
          snapshotHash: 'snapshot-hash',
        }),
      }),
    );
  });
});
