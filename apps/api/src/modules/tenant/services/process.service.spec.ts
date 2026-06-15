import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ProcessStatus, RaciRole, RiskLevel } from '../../../generated/prisma';
import { TenantAccessContext } from '../guards/tenant-access.guard';
import { CompletenessService } from './completeness.service';
import { ProcessService } from './process.service';

const metadata = { ip: '127.0.0.1', userAgent: 'vitest' };

function createPrismaMock() {
  const prisma = {
    $transaction: vi.fn(async (items: unknown) => {
      if (Array.isArray(items)) return Promise.all(items);
      if (typeof items === 'function') return items(prisma);
      return items;
    }),
    process: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    direction: { findFirst: vi.fn() },
    processCategory: { findFirst: vi.fn() },
    actor: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    processInput: { deleteMany: vi.fn(), create: vi.fn() },
    processOutput: { deleteMany: vi.fn(), create: vi.fn() },
    processActivity: {
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findFirstOrThrow: vi.fn(),
    },
    processActorRole: { deleteMany: vi.fn(), create: vi.fn() },
    processDocument: { findMany: vi.fn(), create: vi.fn() },
    processApplication: { findMany: vi.fn(), create: vi.fn() },
    document: { create: vi.fn(), update: vi.fn() },
    application: { create: vi.fn(), update: vi.fn() },
    kpi: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    risk: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    control: { create: vi.fn(), update: vi.fn() },
    riskControl: { create: vi.fn() },
    painPoint: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    automationNeed: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    processSnapshot: { create: vi.fn() },
    completenessAssessment: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return prisma;
}

function createService() {
  const prisma = createPrismaMock();
  const completenessService = new CompletenessService(prisma as never);
  return { service: new ProcessService(prisma as never, completenessService), prisma };
}

function tenantAdmin(overrides: Partial<TenantAccessContext> = {}): TenantAccessContext {
  return {
    tenantId: 'tenant-a',
    actorUserId: 'admin-a',
    membershipId: 'membership-admin',
    tenantRoles: ['tenant_admin'],
    permissions: ['manage_directions', 'create_process', 'update_process_working_copy'],
    directionIds: [],
    isSupportAccess: false,
    ...overrides,
  };
}

function referent(overrides: Partial<TenantAccessContext> = {}): TenantAccessContext {
  return {
    tenantId: 'tenant-a',
    actorUserId: 'ref-a',
    membershipId: 'membership-ref',
    tenantRoles: ['direction_referent'],
    permissions: ['create_process', 'update_process_working_copy'],
    directionIds: ['direction-a'],
    isSupportAccess: false,
    ...overrides,
  };
}

function readonly(): TenantAccessContext {
  return tenantAdmin({ tenantRoles: ['readonly'], permissions: ['export_process'] });
}

function support(): TenantAccessContext {
  return tenantAdmin({
    tenantRoles: [],
    permissions: ['support_read'],
    directionIds: [],
    supportGrantId: 'grant-a',
    isSupportAccess: true,
  });
}

function processDetails(overrides = {}) {
  return {
    id: 'process-a',
    tenantId: 'tenant-a',
    directionId: 'direction-a',
    categoryId: 'category-a',
    processOwnerActorId: 'actor-owner',
    name: 'Cloture comptable',
    code: 'FIN-CLOT',
    description: 'Description',
    objective: 'Produire les comptes mensuels',
    scope: 'Finance',
    triggerEvent: 'Fin de mois',
    status: ProcessStatus.DRAFT,
    lockVersion: 2,
    inputs: [{ id: 'input-a', name: 'Factures' }],
    outputs: [{ id: 'output-a', name: 'Etats financiers' }],
    activities: [{ id: 'activity-a', name: 'Controler', outputText: 'Dossier controle' }],
    actorRoles: [
      { activityId: 'activity-a', actorId: 'actor-owner', raciRole: RaciRole.RESPONSIBLE },
      { activityId: 'activity-a', actorId: 'actor-owner', raciRole: RaciRole.ACCOUNTABLE },
    ],
    transitions: [],
    documents: [{ id: 'doc-link', document: { id: 'doc-a', title: 'Procedure', version: '1.0' } }],
    applications: [{ id: 'app-link', application: { id: 'app-a', name: 'ERP' } }],
    kpis: [{ id: 'kpi-a', name: 'Delai', target: 'J+3', evidence: { source: 'reporting' } }],
    risks: [
      {
        id: 'risk-a',
        description: 'Erreur de cutoff',
        inherentLevel: RiskLevel.HIGH,
        controls: [
          { riskId: 'risk-a', controlId: 'control-a', control: { evidence: { type: 'sample' } } },
        ],
      },
    ],
    painPoints: [{ id: 'pain-a', description: 'Relances manuelles' }],
    automationNeeds: [{ id: 'auto-a', description: 'Rapprochement automatique' }],
    direction: { id: 'direction-a', name: 'Finance' },
    category: { id: 'category-a', name: 'Metier' },
    ownerActor: { id: 'actor-owner', name: 'Owner' },
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('ProcessService', () => {
  it('lists processes in the referent direction scope', async () => {
    const { service, prisma } = createService();
    prisma.process.findMany.mockResolvedValue([]);

    await service.listProcesses(referent(), {});

    expect(prisma.process.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ directionId: { in: ['direction-a'] } }),
      }),
    );
  });

  it('refuses writes for readonly and support contexts', async () => {
    const { service } = createService();

    await expect(
      service.createProcess(readonly(), { name: 'P', direction_id: 'direction-a' }, metadata),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.createProcess(support(), { name: 'P', direction_id: 'direction-a' }, metadata),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a referent creating a process outside assigned directions', async () => {
    const { service } = createService();

    await expect(
      service.createProcess(referent(), { name: 'Audit', direction_id: 'direction-b' }, metadata),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a draft process and audits the action', async () => {
    const { service, prisma } = createService();
    prisma.direction.findFirst.mockResolvedValue({ id: 'direction-a' });
    prisma.process.create.mockResolvedValue({ id: 'process-a' });
    prisma.process.findFirst.mockResolvedValue(processDetails());

    await service.createProcess(
      tenantAdmin(),
      { name: 'Audit', direction_id: 'direction-a' },
      metadata,
    );

    expect(prisma.process.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-a', directionId: 'direction-a' }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'process_created' }) }),
    );
  });

  it('detects optimistic locking conflicts on wizard save', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(processDetails({ lockVersion: 4 }));

    await expect(
      service.saveWizardStep(
        tenantAdmin(),
        'process-a',
        1,
        { lock_version: 2, payload: { name: 'X' } },
        metadata,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('calculates completeness and blocks incomplete drafts', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(
      processDetails({
        objective: null,
        processOwnerActorId: null,
        inputs: [],
        outputs: [],
        activities: [],
        actorRoles: [],
      }),
    );

    const result = await service.calculateCompleteness(tenantAdmin(), 'process-a');

    expect(result.score).toBeLessThan(80);
    expect(result.canSubmit).toBe(false);
    expect(result.blockingIssues).toContain('missing_objective');
    expect(result.blockingIssues).toContain('missing_activity');
    expect(result.blockingIssues).toContain('missing_process_owner');
  });

  it('creates a submitted snapshot only when completeness passes', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(processDetails());
    prisma.processSnapshot.create.mockResolvedValue({ id: 'snapshot-a' });
    prisma.process.update.mockResolvedValue(processDetails({ status: ProcessStatus.SUBMITTED }));

    const result = await service.submitProcess(
      tenantAdmin(),
      'process-a',
      { lock_version: 2, comment: 'OK' },
      metadata,
    );

    expect(prisma.processSnapshot.create).toHaveBeenCalled();
    expect(prisma.process.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ProcessStatus.SUBMITTED }),
      }),
    );
    expect(result.id).toBe('process-a');
  });

  it('saves step two inputs and outputs as partial draft data', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(processDetails());
    prisma.process.update.mockResolvedValue(processDetails({ lockVersion: 3 }));
    prisma.processInput.deleteMany.mockResolvedValue({ count: 0 });
    prisma.processOutput.deleteMany.mockResolvedValue({ count: 0 });
    prisma.processInput.create.mockResolvedValue({ id: 'input-a' });
    prisma.processOutput.create.mockResolvedValue({ id: 'output-a' });
    prisma.completenessAssessment.create.mockResolvedValue({});

    await service.saveWizardStep(
      tenantAdmin(),
      'process-a',
      2,
      {
        lock_version: 2,
        payload: { objective: 'Obj', input_name: 'Facture', output_name: 'Etat' },
      },
      metadata,
    );

    expect(prisma.processInput.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Facture' }) }),
    );
    expect(prisma.processOutput.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Etat' }) }),
    );
  });

  it('refuses manual recalculation for readonly users', async () => {
    const { service } = createService();

    await expect(
      service.recalculateCompleteness(readonly(), 'process-a', metadata),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses recalculation outside a direction referent scope', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(null);

    await expect(
      service.recalculateCompleteness(referent(), 'process-b', metadata),
    ).rejects.toThrow('Processus introuvable.');
  });

  it('refuses super_admin without support grant or tenant write permission', async () => {
    const { service } = createService();

    await expect(
      service.recalculateCompleteness(
        tenantAdmin({ tenantRoles: [], permissions: [], directionIds: [], isSupportAccess: false }),
        'process-a',
        metadata,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
