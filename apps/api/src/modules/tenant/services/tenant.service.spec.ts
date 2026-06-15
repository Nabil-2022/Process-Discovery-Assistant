import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ProcessStatus, RiskLevel } from '../../../generated/prisma';
import { TenantAccessContext } from '../guards/tenant-access.guard';
import { TenantService } from './tenant.service';

const metadata = { ip: '127.0.0.1', userAgent: 'vitest' };

function createPrismaMock() {
  const prisma = {
    direction: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    process: {
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    processValidation: { count: vi.fn() },
    risk: { count: vi.fn(), groupBy: vi.fn() },
    automationNeed: { count: vi.fn() },
    processCategory: { findMany: vi.fn() },
    tenantMembership: { findFirst: vi.fn() },
    membershipDirection: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    notification: { create: vi.fn() },
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return prisma;
}

function createService() {
  const prisma = createPrismaMock();
  return { service: new TenantService(prisma as never), prisma };
}

function tenantAdmin(overrides: Partial<TenantAccessContext> = {}): TenantAccessContext {
  return {
    tenantId: 'tenant-a',
    actorUserId: 'admin-a',
    membershipId: 'membership-admin',
    tenantRoles: ['tenant_admin'],
    permissions: ['manage_directions', 'manage_users', 'create_process'],
    directionIds: [],
    isSupportAccess: false,
    ...overrides,
  };
}

function readonly(overrides: Partial<TenantAccessContext> = {}): TenantAccessContext {
  return {
    tenantId: 'tenant-a',
    actorUserId: 'readonly-a',
    membershipId: 'membership-readonly',
    tenantRoles: ['readonly'],
    permissions: ['export_process'],
    directionIds: [],
    isSupportAccess: false,
    ...overrides,
  };
}

function referent(overrides: Partial<TenantAccessContext> = {}): TenantAccessContext {
  return {
    tenantId: 'tenant-a',
    actorUserId: 'referent-a',
    membershipId: 'membership-ref',
    tenantRoles: ['direction_referent'],
    permissions: ['create_process', 'export_process'],
    directionIds: ['direction-a'],
    isSupportAccess: false,
    ...overrides,
  };
}

function direction(overrides = {}) {
  return {
    id: 'direction-a',
    tenantId: 'tenant-a',
    name: 'Finance',
    code: 'finance',
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    membershipDirections: [],
    processes: [],
    campaignDirections: [],
    ...overrides,
  };
}

describe('TenantService', () => {
  it('allows tenant_admin to read tenant dashboard', async () => {
    const { service, prisma } = createService();
    prisma.direction.count.mockResolvedValue(13);
    prisma.process.count.mockResolvedValue(0);
    prisma.process.aggregate.mockResolvedValue({ _avg: { completenessScore: null } });
    prisma.processValidation.count.mockResolvedValue(0);
    prisma.risk.count.mockResolvedValue(0);
    prisma.automationNeed.count.mockResolvedValue(0);

    const result = await service.dashboardSummary(tenantAdmin(), {});

    expect(result.directions).toBe(13);
    expect(result.processes).toBe(0);
    expect(result.average_completeness).toBe(0);
  });

  it('keeps tenant metrics scoped to the active tenant', async () => {
    const { service, prisma } = createService();
    prisma.direction.count.mockResolvedValue(0);
    prisma.process.count.mockResolvedValue(0);
    prisma.process.aggregate.mockResolvedValue({ _avg: { completenessScore: null } });
    prisma.processValidation.count.mockResolvedValue(0);
    prisma.risk.count.mockResolvedValue(0);
    prisma.automationNeed.count.mockResolvedValue(0);

    await service.dashboardSummary(tenantAdmin({ tenantId: 'tenant-b' }), {});

    expect(prisma.direction.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId: 'tenant-b' }),
    });
  });

  it('limits a direction_referent to assigned directions', async () => {
    const { service, prisma } = createService();
    prisma.direction.count.mockResolvedValue(1);
    prisma.direction.findMany.mockResolvedValue([direction()]);

    await service.listDirections(referent(), {});

    expect(prisma.direction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['direction-a'] } }),
      }),
    );
  });

  it('refuses a referent outside their direction scope', async () => {
    const { service } = createService();

    await expect(service.getDirection(referent(), 'direction-b')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses writes for readonly users', async () => {
    const { service } = createService();

    await expect(
      service.createDirection(readonly(), { name: 'Audit' }, metadata),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a direction for tenant_admin and audits it', async () => {
    const { service, prisma } = createService();
    prisma.direction.create.mockResolvedValue(direction({ id: 'direction-new', name: 'Audit' }));
    prisma.direction.findFirst.mockResolvedValue(direction({ id: 'direction-new', name: 'Audit' }));

    await service.createDirection(tenantAdmin(), { name: 'Audit' }, metadata);

    expect(prisma.direction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-a', name: 'Audit' }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'direction_created' }) }),
    );
  });

  it('refuses direction creation without direction permission', async () => {
    const { service } = createService();

    await expect(
      service.createDirection(
        tenantAdmin({ permissions: ['export_process'] }),
        { name: 'Audit' },
        metadata,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('assigns a valid same-tenant referent', async () => {
    const { service, prisma } = createService();
    prisma.direction.findFirst.mockResolvedValue(direction());
    prisma.tenantMembership.findFirst.mockResolvedValue({
      id: 'membership-ref',
      userId: 'user-ref',
    });

    await service.assignReferent(tenantAdmin(), 'direction-a', { user_id: 'user-ref' }, metadata);

    expect(prisma.membershipDirection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          membershipId_directionId: { membershipId: 'membership-ref', directionId: 'direction-a' },
        },
      }),
    );
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it('refuses assigning a referent from another tenant', async () => {
    const { service, prisma } = createService();
    prisma.direction.findFirst.mockResolvedValue(direction());
    prisma.tenantMembership.findFirst.mockResolvedValue(null);

    await expect(
      service.assignReferent(tenantAdmin(), 'direction-a', { user_id: 'foreign-user' }, metadata),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('soft deletes a direction', async () => {
    const { service, prisma } = createService();
    prisma.direction.findFirst.mockResolvedValue(direction());
    prisma.direction.update.mockResolvedValue(direction({ status: 'deleted' }));

    await service.deleteDirection(tenantAdmin(), 'direction-a', metadata);

    expect(prisma.direction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'deleted' }) }),
    );
  });

  it('audits referent reminders and creates notifications', async () => {
    const { service, prisma } = createService();
    prisma.direction.findFirst.mockResolvedValue(direction());
    prisma.membershipDirection.findMany.mockResolvedValue([{ membership: { userId: 'user-ref' } }]);

    await service.remindReferent(tenantAdmin(), 'direction-a', {}, metadata);

    expect(prisma.notification.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'direction_referent_reminded' }),
      }),
    );
  });

  it('returns coherent dashboard metrics with existing processes', async () => {
    const { service, prisma } = createService();
    prisma.direction.count.mockResolvedValue(1);
    prisma.process.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);
    prisma.process.aggregate.mockResolvedValue({ _avg: { completenessScore: 75 } });
    prisma.processValidation.count.mockResolvedValue(1);
    prisma.risk.count.mockResolvedValue(1);
    prisma.automationNeed.count.mockResolvedValue(2);

    const result = await service.dashboardSummary(tenantAdmin(), {});

    expect(result.processes).toBe(2);
    expect(result.draft_processes).toBe(1);
    expect(result.validated_processes).toBe(1);
    expect(result.critical_risks).toBe(1);
  });

  it('groups dashboard processes by status', async () => {
    const { service, prisma } = createService();
    prisma.process.groupBy.mockResolvedValue([
      { status: ProcessStatus.DRAFT, _count: { _all: 2 } },
      { status: ProcessStatus.APPROVED, _count: { _all: 1 } },
    ]);

    const result = await service.processStatusDistribution(tenantAdmin(), {});

    expect(result).toEqual([
      { label: ProcessStatus.DRAFT, count: 2 },
      { label: ProcessStatus.APPROVED, count: 1 },
    ]);
  });

  it('groups risks by criticality', async () => {
    const { service, prisma } = createService();
    prisma.risk.groupBy.mockResolvedValue([
      { inherentLevel: RiskLevel.CRITICAL, _count: { _all: 1 } },
    ]);

    const result = await service.risksByCriticality(tenantAdmin());

    expect(result).toEqual([{ level: RiskLevel.CRITICAL, count: 1 }]);
  });
});
