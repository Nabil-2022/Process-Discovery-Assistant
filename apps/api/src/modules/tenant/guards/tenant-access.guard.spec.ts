import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { SupportAccessStatus, TenantStatus, UserStatus } from '../../../generated/prisma';
import { TenantAccessGuard } from './tenant-access.guard';

describe('TenantAccessGuard', () => {
  it('refuses unauthenticated tenant access', async () => {
    const guard = new TenantAccessGuard({ user: { findUnique: vi.fn() } } as never);

    await expect(guard.canActivate(context({}) as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('resolves active membership tenant context', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'user-1', status: UserStatus.ACTIVE }) },
      tenantMembership: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'membership-1',
          userId: 'user-1',
          tenantId: 'tenant-a',
          status: 'ACTIVE',
          tenant: { status: TenantStatus.ACTIVE },
          directions: [{ directionId: 'direction-a' }],
          roles: [
            {
              role: {
                code: 'direction_referent',
                permissions: [{ permission: { code: 'create_process' } }],
              },
            },
          ],
        }),
      },
    };
    const request = {
      user: {
        sub: 'user-1',
        active_tenant_id: 'tenant-a',
        membership_id: 'membership-1',
        global_roles: [],
      },
      headers: {},
    };
    const guard = new TenantAccessGuard(prisma as never);

    await expect(guard.canActivate(context(request) as never)).resolves.toBe(true);
    expect(request).toHaveProperty('tenantContext.tenantId', 'tenant-a');
  });

  it('allows super_admin only through a valid support access grant', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'admin-1', status: UserStatus.ACTIVE }) },
      supportAccessGrant: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'grant-1',
          tenantId: 'tenant-a',
          supportUserId: 'admin-1',
          status: SupportAccessStatus.ACTIVE,
          validFrom: new Date(Date.now() - 1000),
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
          tenant: { status: TenantStatus.ACTIVE },
        }),
      },
    };
    const request = {
      user: { sub: 'admin-1', global_roles: ['super_admin'] },
      headers: { 'x-support-grant-id': 'grant-1' },
    };
    const guard = new TenantAccessGuard(prisma as never);

    await expect(guard.canActivate(context(request) as never)).resolves.toBe(true);
    expect(request).toHaveProperty('tenantContext.supportGrantId', 'grant-1');
  });

  it('refuses super_admin direct business access without support grant', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'admin-1', status: UserStatus.ACTIVE }) },
    };
    const request = { user: { sub: 'admin-1', global_roles: ['super_admin'] }, headers: {} };
    const guard = new TenantAccessGuard(prisma as never);

    await expect(guard.canActivate(context(request) as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses expired support access grant', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'admin-1', status: UserStatus.ACTIVE }) },
      supportAccessGrant: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'grant-expired',
          tenantId: 'tenant-a',
          supportUserId: 'admin-1',
          status: SupportAccessStatus.ACTIVE,
          validFrom: new Date(Date.now() - 120_000),
          expiresAt: new Date(Date.now() - 60_000),
          revokedAt: null,
          tenant: { status: TenantStatus.ACTIVE },
        }),
      },
    };
    const request = {
      user: { sub: 'admin-1', global_roles: ['super_admin'] },
      headers: { 'x-support-grant-id': 'grant-expired' },
    };
    const guard = new TenantAccessGuard(prisma as never);

    await expect(guard.canActivate(context(request) as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses revoked support access grant', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'admin-1', status: UserStatus.ACTIVE }) },
      supportAccessGrant: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'grant-revoked',
          tenantId: 'tenant-a',
          supportUserId: 'admin-1',
          status: SupportAccessStatus.REVOKED,
          validFrom: new Date(Date.now() - 120_000),
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: new Date(),
          tenant: { status: TenantStatus.ACTIVE },
        }),
      },
    };
    const request = {
      user: { sub: 'admin-1', global_roles: ['super_admin'] },
      headers: { 'x-support-grant-id': 'grant-revoked' },
    };
    const guard = new TenantAccessGuard(prisma as never);

    await expect(guard.canActivate(context(request) as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

function context(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  };
}
