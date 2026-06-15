import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { SupportAccessStatus, TenantStatus, UserStatus } from '../../../generated/prisma';
import { GLOBAL_ROLES_KEY, PERMISSIONS_KEY } from '../../auth/decorators/auth.decorators';
import { AuthPolicyGuard } from '../../auth/guards/auth-policy.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminService } from './admin.service';

const metadata = { ip: '127.0.0.1', userAgent: 'vitest' };

function createPrismaMock() {
  const prisma = {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
    tenant: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    tenantSetting: {
      create: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    subscription: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    tenantMembership: {
      count: vi.fn(),
      findFirstOrThrow: vi.fn(),
    },
    user: {
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    role: {
      findUniqueOrThrow: vi.fn(),
    },
    direction: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    process: { count: vi.fn() },
    campaign: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    completenessAssessment: {
      aggregate: vi.fn(),
    },
    templateVersion: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    template: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    feature: {
      findMany: vi.fn(),
    },
    tenantFeature: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    tenantTemplate: {
      upsert: vi.fn(),
    },
    supportAccessGrant: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return prisma;
}

function createService() {
  const prisma = createPrismaMock();
  const authService = { invite: vi.fn() };
  const configService = { get: vi.fn((_key: string, fallback: unknown) => fallback) };
  const service = new AdminService(prisma as never, configService as never, authService as never);
  return { service, prisma, authService, configService };
}

function tenant(overrides = {}) {
  return {
    id: 'tenant-1',
    name: 'Client A',
    slug: 'client-a',
    status: TenantStatus.ACTIVE,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    deletedAt: null,
    subscriptions: [],
    _count: { memberships: 2, directions: 3, processes: 4, campaigns: 1 },
    ...overrides,
  };
}

describe('AdminService', () => {
  it('allows a super_admin to list tenants through the admin service', async () => {
    const { service, prisma } = createService();
    prisma.tenant.count.mockResolvedValue(1);
    prisma.tenant.findMany.mockResolvedValue([tenant()]);

    const result = await service.listTenants({});

    expect(result.total).toBe(1);
    expect(result.items[0]?.slug).toBe('client-a');
  });

  it('creates a tenant and writes an audit entry', async () => {
    const { service, prisma } = createService();
    prisma.tenant.findUnique.mockImplementation(
      async (args: { where: { slug?: string; id?: string } }) =>
        args.where.slug
          ? null
          : {
              ...tenant(),
              settings: [],
              subscriptions: [],
              tenantFeatures: [],
              tenantTemplates: [],
              _count: { memberships: 0, directions: 0, processes: 0, campaigns: 0 },
            },
    );
    prisma.tenant.create.mockResolvedValue(tenant());
    prisma.tenantSetting.create.mockResolvedValue({});
    prisma.subscription.create.mockResolvedValue({});

    await service.createTenant(
      {
        name: 'Client A',
        slug: 'client-a',
        organization_type: 'public',
        country: 'MA',
        city: 'Rabat',
        timezone: 'Africa/Casablanca',
        plan: 'trial',
      },
      'admin-1',
      metadata,
    );

    expect(prisma.tenant.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'tenant_created' }) }),
    );
  });

  it('refuses a duplicated tenant slug', async () => {
    const { service, prisma } = createService();
    prisma.tenant.findUnique.mockResolvedValue(tenant());

    await expect(
      service.createTenant(
        {
          name: 'Client A',
          slug: 'client-a',
          organization_type: 'public',
          country: 'MA',
          city: 'Rabat',
          timezone: 'Africa/Casablanca',
          plan: 'trial',
        },
        'admin-1',
        metadata,
      ),
    ).rejects.toThrow('slug');
  });

  it('suspends a tenant and disables tenant features', async () => {
    const { service, prisma } = createService();
    prisma.tenant.findUnique.mockResolvedValue(tenant());
    prisma.tenant.update.mockResolvedValue({ ...tenant(), status: TenantStatus.SUSPENDED });
    prisma.tenantFeature.updateMany.mockResolvedValue({ count: 2 });
    prisma.subscription.updateMany.mockResolvedValue({ count: 1 });

    await service.suspendTenant('tenant-1', { reason: 'Contract pause' }, 'admin-1', metadata);

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { status: TenantStatus.SUSPENDED },
    });
    expect(prisma.tenantFeature.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      data: { enabled: false },
    });
  });

  it('reactivates a tenant', async () => {
    const { service, prisma } = createService();
    prisma.tenant.findUnique.mockResolvedValue(tenant({ status: TenantStatus.SUSPENDED }));
    prisma.tenant.update.mockResolvedValue(tenant());

    await service.reactivateTenant('tenant-1', 'admin-1', metadata);

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { status: TenantStatus.ACTIVE },
    });
  });

  it('creates the initial tenant admin through invitation flow', async () => {
    const { service, prisma, authService } = createService();
    prisma.tenant.findUnique.mockResolvedValue(tenant());
    authService.invite.mockResolvedValue({ invitation_token: 'token' });
    prisma.tenantMembership.findFirstOrThrow.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      status: 'INVITED',
      user: { email: 'admin@example.test' },
      roles: [{ role: { code: 'tenant_admin' } }],
    });

    const result = await service.createInitialAdmin(
      'tenant-1',
      { email: 'admin@example.test', full_name: 'Admin Client' },
      'admin-1',
      metadata,
    );

    expect(authService.invite).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 'tenant-1', role_codes: ['tenant_admin'] }),
      'admin-1',
      metadata,
    );
    expect(result.roles).toEqual(['tenant_admin']);
  });

  it('applies the MAP template idempotently by creating only missing directions', async () => {
    const { service, prisma } = createService();
    prisma.tenant.findUnique.mockResolvedValue(tenant());
    prisma.templateVersion.findFirst.mockResolvedValue({
      id: 'template-version-1',
      templateId: 'template-1',
      configuration: { code: 'map' },
      directions: [
        { name: 'Direction A', code: 'direction_a' },
        { name: 'Direction B', code: 'direction_b' },
      ],
      fields: [{ id: 'field-1' }],
      rules: [{ id: 'rule-1' }],
    });
    prisma.direction.findMany.mockResolvedValue([
      { id: 'direction-1', name: 'Direction A', code: 'direction_a' },
    ]);
    prisma.direction.create.mockResolvedValue({});
    prisma.tenantTemplate.upsert.mockResolvedValue({});

    const result = await service.applyTemplate('tenant-1', {}, 'admin-1', metadata);

    expect(result.preview.directions_to_create).toHaveLength(1);
    expect(prisma.direction.create).toHaveBeenCalledTimes(1);
  });

  it('updates tenant features', async () => {
    const { service, prisma } = createService();
    prisma.tenant.findUnique.mockResolvedValue(tenant());
    prisma.feature.findMany
      .mockResolvedValueOnce([{ id: 'feature-1', code: 'exports', name: 'Exports' }])
      .mockResolvedValueOnce([{ id: 'feature-1', code: 'exports', name: 'Exports' }]);
    prisma.tenantFeature.upsert.mockResolvedValue({});
    prisma.tenantFeature.findMany.mockResolvedValue([
      { feature: { code: 'exports' }, enabled: true, config: {} },
    ]);

    await service.updateTenantFeatures(
      'tenant-1',
      { features: [{ code: 'exports', enabled: true }] },
      'admin-1',
      metadata,
    );

    expect(prisma.tenantFeature.upsert).toHaveBeenCalled();
  });

  it('updates a subscription', async () => {
    const { service, prisma } = createService();
    prisma.tenant.findUnique.mockResolvedValue(tenant());
    prisma.subscription.findFirst.mockResolvedValue({ id: 'subscription-1' });
    prisma.subscription.update.mockResolvedValue({
      id: 'subscription-1',
      plan: 'pro',
      status: 'active',
    });

    const result = await service.updateSubscription(
      'tenant-1',
      { plan: 'pro', status: 'active' },
      'admin-1',
      metadata,
    );

    expect(result.plan).toBe('pro');
  });

  it('creates a support access grant', async () => {
    const { service, prisma } = createService();
    const validFrom = new Date(Date.now() - 60 * 60 * 1000);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    prisma.tenant.findUnique.mockResolvedValue(tenant());
    prisma.user.findUnique.mockResolvedValue({ id: 'support-1' });
    prisma.supportAccessGrant.create.mockResolvedValue({
      id: 'grant-1',
      tenantId: 'tenant-1',
      status: SupportAccessStatus.ACTIVE,
      validFrom,
      expiresAt,
      revokedAt: null,
    });

    const result = await service.createSupportAccessGrant(
      {
        tenant_id: 'tenant-1',
        support_user_id: 'support-1',
        reason: 'Analyse incident',
        scope: { process_ids: [] },
        valid_from: validFrom.toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      'admin-1',
      metadata,
    );

    expect(result.effective_status).toBe(SupportAccessStatus.ACTIVE);
  });

  it('refuses an expired support access grant', () => {
    const { service } = createService();

    expect(() =>
      service.assertSupportAccessGrantActive({
        status: SupportAccessStatus.ACTIVE,
        validFrom: new Date('2026-01-01T00:00:00Z'),
        expiresAt: new Date('2026-01-02T00:00:00Z'),
        revokedAt: null,
      }),
    ).toThrow('expire');
  });

  it('refuses a revoked support access grant', () => {
    const { service } = createService();

    expect(() =>
      service.assertSupportAccessGrantActive({
        status: SupportAccessStatus.REVOKED,
        validFrom: new Date('2030-01-01T00:00:00Z'),
        expiresAt: new Date('2030-01-02T00:00:00Z'),
        revokedAt: new Date('2030-01-01T01:00:00Z'),
      }),
    ).toThrow('revoque');
  });

  it('audits sensitive administration actions', async () => {
    const { service, prisma } = createService();
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.auditLogs({}, 'admin-1', metadata);

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'audit_logs_viewed' }) }),
    );
  });
});

describe('admin RBAC guards', () => {
  it('rejects a tenant_admin for global admin routes', async () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) => {
        if (key === GLOBAL_ROLES_KEY) return ['super_admin'];
        if (key === PERMISSIONS_KEY) return ['manage_tenants'];
        return undefined;
      }),
    } as unknown as Reflector;
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'user-1', status: UserStatus.ACTIVE }) },
    };
    const guard = new AuthPolicyGuard(reflector, prisma as never);
    const context = executionContext({
      user: { sub: 'user-1', global_roles: [], permissions: ['manage_tenants'] },
    });

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a super_admin with the required permission', async () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) => {
        if (key === GLOBAL_ROLES_KEY) return ['super_admin'];
        if (key === PERMISSIONS_KEY) return ['manage_tenants'];
        return undefined;
      }),
    } as unknown as Reflector;
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'admin-1', status: UserStatus.ACTIVE }) },
    };
    const guard = new AuthPolicyGuard(reflector, prisma as never);
    const context = executionContext({
      user: { sub: 'admin-1', global_roles: ['super_admin'], permissions: ['manage_tenants'] },
    });

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
  });

  it('rejects an unauthenticated request before policy checks', async () => {
    const guard = new JwtAuthGuard(
      { getAllAndOverride: vi.fn().mockReturnValue(false) } as never,
      { verifyAsync: vi.fn() } as never,
      { getOrThrow: vi.fn() } as never,
      { session: { findUnique: vi.fn() } } as never,
    );

    await expect(
      guard.canActivate(executionContext({ headers: {} }) as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

function executionContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => null,
    getClass: () => null,
  };
}
