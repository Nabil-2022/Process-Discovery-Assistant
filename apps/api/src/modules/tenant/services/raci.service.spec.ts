import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { RaciRole } from '../../../generated/prisma';
import { TenantAccessContext } from '../guards/tenant-access.guard';
import { evaluateRaci, RACI_RULE_VERSION, raciSourceHash } from './raci-rules';
import { RaciService } from './raci.service';

const metadata = { ip: '127.0.0.1', userAgent: 'vitest' };

function createPrismaMock() {
  const prisma = {
    $transaction: vi.fn(async (items: unknown) =>
      Array.isArray(items) ? Promise.all(items) : items,
    ),
    process: { findFirst: vi.fn() },
    processActivity: { findMany: vi.fn() },
    actor: { findMany: vi.fn() },
    processActorRole: { deleteMany: vi.fn(), create: vi.fn() },
    raciAssessment: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    raciVersion: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn() },
  };
  return prisma;
}

function createService() {
  const prisma = createPrismaMock();
  return { service: new RaciService(prisma as never), prisma };
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
  return tenantAdmin({
    tenantRoles: ['consultant'],
    permissions: ['create_process', 'update_process_working_copy'],
  });
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
    directionIds: [],
    supportGrantId: 'grant-a',
    isSupportAccess: true,
  });
}

function process(overrides = {}) {
  return {
    id: 'process-a',
    tenantId: 'tenant-a',
    directionId: 'direction-a',
    processOwnerActorId: 'actor-a',
    deletedAt: null,
    ownerActor: {
      id: 'actor-a',
      name: 'Responsable interne',
      title: 'Chef service',
      directionId: 'direction-a',
      isPlatformUser: true,
    },
    moroccoCompliance: { isUserFacingProcess: false, law5519Applicable: false },
    risks: [],
    activities: [
      { id: 'activity-a', name: 'Controler dossier', activityType: 'controle', isAutomated: false },
    ],
    actorRoles: [
      {
        activityId: 'activity-a',
        actorId: 'actor-a',
        raciRole: RaciRole.RESPONSIBLE,
        actor: {
          id: 'actor-a',
          name: 'Responsable interne',
          title: 'Chef service',
          directionId: 'direction-a',
          isPlatformUser: true,
        },
      },
      {
        activityId: 'activity-a',
        actorId: 'actor-b',
        raciRole: RaciRole.ACCOUNTABLE,
        actor: {
          id: 'actor-b',
          name: 'Directeur',
          title: 'Directeur',
          directionId: 'direction-a',
          isPlatformUser: true,
        },
      },
    ],
    ...overrides,
  };
}

function assessment(overrides = {}) {
  return {
    id: 'raci-a',
    processId: 'process-a',
    ruleVersion: RACI_RULE_VERSION,
    matrix: { activities: [], actors: [], cells: [] },
    blockingIssues: [],
    warnings: [],
    recommendations: [],
    qualityScore: 100,
    validationStatus: 'DRAFT',
    versionNumber: 1,
    generatedAt: new Date('2026-06-15T10:00:00Z'),
    sourceHash: 'hash-a',
    ...overrides,
  };
}

describe('RACI deterministic rules', () => {
  it('generates a matrix from activities, actors and responsibilities', () => {
    const result = evaluateRaci({
      activities: [{ id: 'activity-a', name: 'A' }],
      actors: [{ id: 'actor-a', name: 'Actor A' }],
      cells: [
        {
          activityId: 'activity-a',
          actorId: 'actor-a',
          roles: [RaciRole.RESPONSIBLE, RaciRole.ACCOUNTABLE],
        },
      ],
    });

    expect(result.matrix.cells[0]?.roles).toEqual([RaciRole.ACCOUNTABLE, RaciRole.RESPONSIBLE]);
    expect(result.blockingIssues).toHaveLength(0);
  });

  it('blocks activity without Responsible and Accountable', () => {
    const result = evaluateRaci({
      activities: [{ id: 'activity-a', name: 'A' }],
      actors: [{ id: 'actor-a', name: 'Actor A' }],
      cells: [],
    });

    expect(result.blockingIssues.map((issue) => issue.code)).toContain('missing_responsible');
    expect(result.blockingIssues.map((issue) => issue.code)).toContain('missing_accountable');
  });

  it('warns on multiple Accountable and external Accountable', () => {
    const result = evaluateRaci({
      activities: [{ id: 'activity-a', name: 'A' }],
      actors: [
        { id: 'actor-a', name: 'Internal', directionId: 'direction-a', isPlatformUser: true },
        { id: 'actor-b', name: 'External', isPlatformUser: false },
      ],
      cells: [
        {
          activityId: 'activity-a',
          actorId: 'actor-a',
          roles: [RaciRole.RESPONSIBLE, RaciRole.ACCOUNTABLE],
        },
        { activityId: 'activity-a', actorId: 'actor-b', roles: [RaciRole.ACCOUNTABLE] },
      ],
    });

    expect(result.warnings.map((issue) => issue.code)).toContain('multiple_accountable');
    expect(result.warnings.map((issue) => issue.code)).toContain('external_accountable');
  });

  it('warns for user-facing, financial and Court of Accounts contexts', () => {
    const result = evaluateRaci({
      activities: [{ id: 'activity-a', name: 'A' }],
      actors: [{ id: 'actor-a', name: 'External' }],
      cells: [
        {
          activityId: 'activity-a',
          actorId: 'actor-a',
          roles: [RaciRole.RESPONSIBLE, RaciRole.ACCOUNTABLE],
        },
      ],
      isUserFacingProcess: true,
      law5519Applicable: true,
      hasFinancialRisk: true,
      hasCourtOfAccountsRisk: true,
      hasProcessOwner: false,
    });

    expect(result.warnings.map((issue) => issue.code)).toContain(
      'user_facing_without_clear_internal_accountable',
    );
    expect(result.warnings.map((issue) => issue.code)).toContain('law_55_19_without_process_owner');
    expect(result.warnings.map((issue) => issue.code)).toContain(
      'public_audit_responsibility_control_check',
    );
  });

  it('is deterministic for same data and changes hash when responsibilities change', () => {
    const source = {
      ruleVersion: RACI_RULE_VERSION,
      cells: [{ actorId: 'a', activityId: 'x', roles: ['R'] }],
    };
    const changed = {
      ruleVersion: RACI_RULE_VERSION,
      cells: [{ actorId: 'a', activityId: 'x', roles: ['A'] }],
    };

    expect(raciSourceHash(source)).toBe(raciSourceHash(source));
    expect(raciSourceHash(source)).not.toBe(raciSourceHash(changed));
  });
});

describe('RaciService', () => {
  it('persists generated RACI and creates history version', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process());
    prisma.raciAssessment.findFirst.mockResolvedValue(null);
    prisma.raciVersion.findFirst.mockResolvedValue(null);
    prisma.raciAssessment.create.mockResolvedValue(assessment());
    prisma.raciVersion.create.mockResolvedValue({});

    await service.generate(tenantAdmin(), 'process-a', metadata);

    expect(prisma.raciAssessment.create).toHaveBeenCalled();
    expect(prisma.raciVersion.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'raci_generated' }) }),
    );
  });

  it('validates RACI when no blocking issue exists', async () => {
    const { service, prisma } = createService();
    prisma.raciAssessment.findFirst.mockResolvedValue(assessment());
    prisma.raciVersion.findFirst.mockResolvedValue({ versionNumber: 1 });
    prisma.raciAssessment.update.mockResolvedValue(
      assessment({ validationStatus: 'VALIDATED', versionNumber: 2 }),
    );
    prisma.raciVersion.create.mockResolvedValue({});

    const result = await service.validate(tenantAdmin(), 'process-a', { comment: 'OK' }, metadata);

    expect(result.validationStatus).toBe('VALIDATED');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'raci_validated' }) }),
    );
  });

  it('refuses validation when blocking issues exist', async () => {
    const { service, prisma } = createService();
    prisma.raciAssessment.findFirst.mockResolvedValue(
      assessment({
        blockingIssues: [{ code: 'missing_responsible', message: 'x', severity: 'blocking' }],
      }),
    );

    await expect(service.validate(tenantAdmin(), 'process-a', {}, metadata)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses readonly writes and consultant validation', async () => {
    const { service } = createService();

    await expect(service.generate(readonly(), 'process-a', metadata)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.validate(consultant(), 'process-a', {}, metadata)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses direction referent outside scope and tenant B data', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(null);

    await expect(service.getRaci(referent(['direction-b']), 'process-a')).rejects.toBeInstanceOf(
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

  it('allows support grant reads but refuses support writes', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process());
    prisma.raciAssessment.findFirst.mockResolvedValue(assessment());

    await expect(service.getRaci(support(), 'process-a')).resolves.toBeDefined();
    await expect(service.generate(support(), 'process-a', metadata)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('updates responsibilities and recalculates source hash', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process());
    prisma.processActivity.findMany.mockResolvedValue([{ id: 'activity-a' }]);
    prisma.actor.findMany.mockResolvedValue([{ id: 'actor-a' }]);
    prisma.raciAssessment.findFirst.mockResolvedValue(null);
    prisma.raciVersion.findFirst.mockResolvedValue(null);
    prisma.raciAssessment.create.mockResolvedValue(assessment({ sourceHash: 'hash-b' }));
    prisma.raciVersion.create.mockResolvedValue({});
    prisma.processActorRole.deleteMany.mockResolvedValue({});
    prisma.processActorRole.create.mockResolvedValue({});

    const result = await service.updateResponsibilities(
      tenantAdmin(),
      'process-a',
      { items: [{ activity_id: 'activity-a', actor_id: 'actor-a', raci_role: 'RESPONSIBLE' }] },
      metadata,
    );

    expect(result.sourceHash).toBe('hash-b');
    expect(prisma.processActorRole.create).toHaveBeenCalled();
  });

  it('lists versions and audit history', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process());
    prisma.raciVersion.findMany.mockResolvedValue([{ id: 'version-a' }]);
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'audit-a' }]);

    await expect(service.versions(tenantAdmin(), 'process-a')).resolves.toEqual([
      { id: 'version-a' },
    ]);
    await expect(service.history(tenantAdmin(), 'process-a')).resolves.toEqual([{ id: 'audit-a' }]);
  });
});
