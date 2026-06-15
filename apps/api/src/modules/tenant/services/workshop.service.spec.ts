import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ProcessStatus, RaciRole, RiskLevel } from '../../../generated/prisma';
import { TenantAccessContext } from '../guards/tenant-access.guard';
import { CompletenessService } from './completeness.service';
import { WorkshopService } from './workshop.service';

const metadata = { ip: '127.0.0.1', userAgent: 'vitest' };

function createPrismaMock() {
  return {
    process: { findFirst: vi.fn() },
    comment: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    auditLog: { findMany: vi.fn(), create: vi.fn() },
    completenessAssessment: { create: vi.fn() },
  };
}

function createService() {
  const prisma = createPrismaMock();
  const completeness = new CompletenessService(prisma as never);
  return { service: new WorkshopService(prisma as never, completeness), prisma };
}

function tenantAdmin(overrides: Partial<TenantAccessContext> = {}): TenantAccessContext {
  return {
    tenantId: 'tenant-a',
    actorUserId: 'admin-a',
    membershipId: 'membership-admin',
    tenantRoles: ['tenant_admin'],
    permissions: [
      'manage_directions',
      'create_process',
      'update_process_working_copy',
      'validate_process',
      'export_process',
    ],
    directionIds: [],
    isSupportAccess: false,
    ...overrides,
  };
}

function readonly() {
  return tenantAdmin({ tenantRoles: ['readonly'], permissions: ['export_process'] });
}

function consultant() {
  return tenantAdmin({ tenantRoles: ['consultant'], permissions: ['create_process'] });
}

function referent(directionIds = ['direction-a']) {
  return tenantAdmin({
    tenantRoles: ['direction_referent'],
    permissions: ['create_process', 'update_process_working_copy'],
    directionIds,
  });
}

function support() {
  return tenantAdmin({
    tenantRoles: [],
    permissions: ['support_read'],
    supportGrantId: 'grant-a',
    isSupportAccess: true,
  });
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
    completenessScore: 90,
    lockVersion: 2,
    lastSubmittedSnapshotId: 'snapshot-a',
    lastSubmittedVersionId: null,
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
        description: 'Erreur',
        inherentLevel: RiskLevel.HIGH,
        treatmentPlan: 'Revue',
        controls: [{ riskId: 'risk-a', control: { id: 'control-a', name: 'Revue', evidence: {} } }],
      },
    ],
    moroccoCompliance: {
      isUserFacingProcess: true,
      law5519Applicable: true,
      targetChannel: 'digital',
      targetProcessingTimeDays: 3,
    },
    eventLogImports: [{ id: 'import-a', status: 'ANALYZED', rowCount: 10 }],
    raciAssessments: [
      {
        validationStatus: 'VALIDATED',
        qualityScore: 100,
        versionNumber: 1,
        generatedAt: new Date('2026-01-02T00:00:00Z'),
        recommendations: ['Confirmer Accountable.'],
      },
    ],
    bpmnModels: [
      {
        validationStatus: 'VALIDATED',
        versionNumber: 1,
        generatedAt: new Date('2026-01-02T00:00:00Z'),
        blockingIssues: [],
        warnings: [],
        recommendations: ['Verifier le chemin nominal.'],
      },
    ],
    bpmnVersions: [{ id: 'bpmn-version-a', versionNumber: 1 }],
    raciVersions: [{ id: 'raci-version-a', versionNumber: 1 }],
    assessments: [],
    validations: [{ id: 'validation-a', decision: 'SUBMITTED', createdAt: new Date() }],
    snapshots: [{ id: 'snapshot-a', snapshotHash: 'hash-a' }],
    versions: [{ id: 'version-a', versionNumber: 1, publishedAt: new Date() }],
    comments: [],
    painPoints: [{ id: 'pain-a', description: 'Relances manuelles', impact: 'Moyen' }],
    automationNeeds: [{ id: 'auto-a', description: 'Rapprochement automatique', priority: 'HIGH' }],
    direction: { id: 'direction-a', name: 'Finance' },
    category: { id: 'category-a', name: 'Metier', code: 'METIER' },
    ownerActor: { id: 'actor-owner', name: 'Owner' },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  } as never;
}

describe('WorkshopService', () => {
  it('returns workshop overview data', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process());

    const result = await service.overview(tenantAdmin(), 'process-a');

    expect(result.process.name).toBe('Cloture comptable');
    expect(result.quality.score).toBeGreaterThanOrEqual(80);
    expect(result.raci?.status).toBe('VALIDATED');
    expect(result.bpmn?.status).toBe('VALIDATED');
  });

  it('returns quality score', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process());

    await expect(service.quality(tenantAdmin(), 'process-a')).resolves.toMatchObject({
      canSubmit: true,
    });
  });

  it('generates deterministic procedure and audits view', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process());
    prisma.auditLog.create.mockResolvedValue({});

    const result = await service.procedure(tenantAdmin(), 'process-a', metadata);

    expect(result.sections.map((section) => section.key)).toContain('activites');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'procedure_viewed' }) }),
    );
  });

  it('generates deterministic backlog', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process());
    prisma.auditLog.create.mockResolvedValue({});

    const result = await service.backlog(tenantAdmin(), 'process-a', metadata);

    expect(result.items.map((item) => item.type)).toEqual(
      expect.arrayContaining(['pain_point', 'automation', 'quality', 'morocco', 'process_mining']),
    );
  });

  it('returns versions and tenant-filtered audit', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process());
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'audit-a' }]);
    prisma.auditLog.create.mockResolvedValue({});

    await expect(service.versions(tenantAdmin(), 'process-a')).resolves.toMatchObject({
      published_versions: [{ id: 'version-a', versionNumber: 1, publishedAt: expect.any(Date) }],
      raci_versions: [{ id: 'raci-version-a', versionNumber: 1 }],
      bpmn_versions: [{ id: 'bpmn-version-a', versionNumber: 1 }],
    });
    await expect(service.auditLogs(tenantAdmin(), 'process-a', metadata)).resolves.toEqual([
      { id: 'audit-a' },
    ]);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) }),
    );
  });

  it('creates and resolves comments', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process());
    prisma.comment.create.mockResolvedValue({ id: 'comment-a', body: 'A revoir' });
    prisma.comment.findFirst.mockResolvedValue({ id: 'comment-a' });
    prisma.comment.update.mockResolvedValue({ id: 'comment-a', status: 'resolved' });
    prisma.auditLog.create.mockResolvedValue({});

    await expect(
      service.createComment(tenantAdmin(), 'process-a', { body: 'A revoir' }, metadata),
    ).resolves.toMatchObject({ id: 'comment-a' });
    await expect(
      service.resolveComment(tenantAdmin(), 'process-a', 'comment-a', metadata),
    ).resolves.toMatchObject({ status: 'resolved' });
  });

  it('refuses readonly comments and consultant audit', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process());

    await expect(
      service.createComment(readonly(), 'process-a', { body: 'Non' }, metadata),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.auditLogs(consultant(), 'process-a', metadata)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses direction referent outside scope and tenant B data', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(null);

    await expect(service.overview(referent(['direction-b']), 'process-a')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.process.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-a',
          directionId: { in: ['direction-b'] },
        }),
      }),
    );
  });

  it('refuses super admin without support grant and allows support read', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process());

    await expect(
      service.overview(
        tenantAdmin({ tenantRoles: [], permissions: [], actorUserId: 'super-admin' }),
        'process-a',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.overview(support(), 'process-a')).resolves.toBeDefined();
  });
});
