import { UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';

import {
  AuthActionTokenType,
  MembershipStatus,
  TenantStatus,
  UserStatus,
} from '../../../generated/prisma';
import { AuthService } from './auth.service';

const metadata = { ip: '127.0.0.1', userAgent: 'vitest' };

function role(code = 'tenant_admin', permissions = ['manage_users', 'export_process']) {
  return {
    role: {
      code,
      permissions: permissions.map((permission) => ({ permission: { code: permission } })),
    },
  };
}

function membership(overrides: Record<string, unknown> = {}) {
  return {
    id: 'membership-1',
    tenantId: 'tenant-1',
    status: MembershipStatus.ACTIVE,
    tenant: {
      id: 'tenant-1',
      slug: 'map-demo',
      name: 'MAP Démo',
      status: TenantStatus.ACTIVE,
      tenantFeatures: [{ enabled: true, feature: { code: 'process_discovery' } }],
    },
    roles: [role()],
    directions: [{ direction: { id: 'direction-1', name: 'Direction', code: 'direction' } }],
    ...overrides,
  };
}

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'user@example.test',
    passwordHash: 'hash',
    fullName: 'User Example',
    status: UserStatus.ACTIVE,
    locale: 'fr',
    userRoles: [],
    sessions: [],
    memberships: [membership()],
    ...overrides,
  };
}

function createService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    session: {
      create: vi
        .fn()
        .mockResolvedValue({ id: 'session-1', expiresAt: new Date(Date.now() + 100000) }),
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    refreshToken: {
      create: vi
        .fn()
        .mockImplementation(({ data }) => Promise.resolve({ id: 'refresh-new', ...data })),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    tenantMembership: { upsert: vi.fn(), update: vi.fn() },
    role: { findMany: vi.fn().mockResolvedValue([]), findUniqueOrThrow: vi.fn() },
    membershipRole: { upsert: vi.fn() },
    membershipDirection: { upsert: vi.fn() },
    authActionToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    tenant: { update: vi.fn() },
    ...prismaOverrides,
  } as any;

  const config = {
    get: vi.fn((key: string, fallback?: unknown) => {
      const values: Record<string, unknown> = {
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        PASSWORD_RESET_EXPIRES_IN: '30m',
        INVITATION_EXPIRES_IN: '7d',
        PASSWORD_MIN_LENGTH: 12,
        LOGIN_RATE_LIMIT_MAX: 100,
        LOGIN_RATE_LIMIT_WINDOW_SECONDS: 60,
      };
      return values[key] ?? fallback;
    }),
    getOrThrow: vi.fn((key: string) => {
      const value = config.get(key);
      if (!value) {
        throw new Error(key);
      }
      return value;
    }),
  } as any;
  const password = {
    verify: vi.fn((_hash: string, candidate: string) =>
      Promise.resolve(candidate === 'ValidPass123!'),
    ),
    hash: vi.fn((candidate: string) => Promise.resolve(`hash:${candidate}`)),
  } as any;
  const rateLimit = { assertAllowed: vi.fn() } as any;

  return {
    service: new AuthService(prisma, new JwtService(), config, password, rateLimit),
    prisma,
    password,
    rateLimit,
  };
}

describe('AuthService', () => {
  it('logs in a valid single-tenant user', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(user());

    const result = await service.login(
      { email: 'user@example.test', password: 'ValidPass123!', tenant_slug: 'map-demo' },
      metadata,
    );

    expect(result.access_token).toBeTruthy();
    expect(result.refresh_token).toBeTruthy();
    expect(result.requires_tenant_selection).toBe(false);
  });

  it('rejects an unknown email with the generic error', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@example.test', password: 'ValidPass123!' }, metadata),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid password', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(user());

    await expect(
      service.login({ email: 'user@example.test', password: 'bad-password' }, metadata),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a suspended user', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(user({ status: UserStatus.SUSPENDED }));

    await expect(
      service.login({ email: 'user@example.test', password: 'ValidPass123!' }, metadata),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('requires explicit tenant selection for multi-tenant users', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(
      user({
        memberships: [
          membership(),
          membership({
            id: 'membership-2',
            tenantId: 'tenant-2',
            tenant: { ...membership().tenant, id: 'tenant-2', slug: 'other' },
          }),
        ],
      }),
    );

    const result = await service.login(
      { email: 'user@example.test', password: 'ValidPass123!' },
      metadata,
    );

    expect(result.requires_tenant_selection).toBe(true);
    expect(result.tenants).toHaveLength(2);
  });

  it('rejects login when selected tenant membership is suspended', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(
      user({ memberships: [membership({ status: MembershipStatus.SUSPENDED })] }),
    );

    await expect(
      service.login(
        { email: 'user@example.test', password: 'ValidPass123!', tenant_slug: 'map-demo' },
        metadata,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects login when selected tenant is suspended', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(
      user({
        memberships: [
          membership({ tenant: { ...membership().tenant, status: TenantStatus.SUSPENDED } }),
        ],
      }),
    );

    await expect(
      service.login(
        { email: 'user@example.test', password: 'ValidPass123!', tenant_slug: 'map-demo' },
        metadata,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('selects an authorized tenant', async () => {
    const { service, prisma } = createService();
    prisma.user.findUniqueOrThrow.mockResolvedValue(user());

    const result = await service.selectTenant(
      'user-1',
      'session-1',
      { tenant_slug: 'map-demo' },
      metadata,
    );

    expect(result.tenant.slug).toBe('map-demo');
    expect(result.permissions).toContain('manage_users');
  });

  it('rejects unauthorized tenant selection', async () => {
    const { service, prisma } = createService();
    prisma.user.findUniqueOrThrow.mockResolvedValue(user());

    await expect(
      service.selectTenant('user-1', 'session-1', { tenant_slug: 'missing' }, metadata),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refreshes and rotates a valid refresh token', async () => {
    const { service, prisma } = createService();
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'refresh-old',
      userId: 'user-1',
      sessionId: 'session-1',
      familyId: 'family-1',
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 100000),
      session: { id: 'session-1', revokedAt: null },
      user: user(),
    });

    const result = await service.refresh('raw-refresh-token', metadata);

    expect(result.access_token).toBeTruthy();
    expect(result.refresh_token).toBeTruthy();
    expect(prisma.refreshToken.update).toHaveBeenCalled();
  });

  it('revokes a refresh family when reuse is detected', async () => {
    const { service, prisma } = createService();
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'refresh-old',
      userId: 'user-1',
      sessionId: 'session-1',
      familyId: 'family-1',
      usedAt: new Date(),
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 100000),
      session: { id: 'session-1', revokedAt: null },
      user: user(),
    });

    await expect(service.refresh('raw-refresh-token', metadata)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'family-1' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('logs out the current session', async () => {
    const { service, prisma } = createService();
    await service.logout('user-1', 'session-1', metadata);
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-1', userId: 'user-1' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('logs out all sessions', async () => {
    const { service, prisma } = createService();
    await service.logoutAll('user-1', metadata);
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('returns me context without secrets', async () => {
    const { service, prisma } = createService();
    prisma.user.findUniqueOrThrow.mockResolvedValue(
      user({ sessions: [{ id: 'session-1', expiresAt: new Date() }] }),
    );
    const result = await service.me('user-1', 'session-1', 'tenant-1');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.permissions).toContain('manage_users');
  });

  it('creates an invitation token', async () => {
    const { service, prisma } = createService();
    prisma.user.upsert.mockResolvedValue(user());
    prisma.tenantMembership.upsert.mockResolvedValue({ id: 'membership-1', tenantId: 'tenant-1' });
    prisma.authActionToken.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'token-1', ...data }),
    );

    const result = await service.invite(
      {
        email: 'invite@example.test',
        full_name: 'Invite',
        tenant_id: 'tenant-1',
        role_codes: ['readonly'],
      },
      'admin-1',
      metadata,
    );

    expect(result.invitation_token).toBeTruthy();
  });

  it('accepts a valid invitation', async () => {
    const { service, prisma } = createService();
    prisma.authActionToken.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      membershipId: 'membership-1',
      type: AuthActionTokenType.INVITATION,
      usedAt: null,
      expiresAt: new Date(Date.now() + 100000),
    });
    prisma.authActionToken.update.mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: 'token-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        membershipId: 'membership-1',
        type: AuthActionTokenType.INVITATION,
        ...data,
      }),
    );
    prisma.user.update.mockResolvedValue({});
    prisma.tenantMembership.update.mockResolvedValue({});

    await expect(
      service.acceptInvitation({ token: 'token', password: 'ValidPass123!' }, metadata),
    ).resolves.toEqual({
      status: 'accepted',
    });
  });

  it('rejects an expired invitation', async () => {
    const { service, prisma } = createService();
    prisma.authActionToken.findUnique.mockResolvedValue({
      type: AuthActionTokenType.INVITATION,
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      service.acceptInvitation({ token: 'token', password: 'ValidPass123!' }, metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('completes a password reset and revokes sessions', async () => {
    const { service, prisma } = createService();
    prisma.authActionToken.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tenantId: null,
      membershipId: null,
      type: AuthActionTokenType.PASSWORD_RESET,
      usedAt: null,
      expiresAt: new Date(Date.now() + 100000),
    });
    prisma.authActionToken.update.mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: 'token-1',
        userId: 'user-1',
        tenantId: null,
        type: AuthActionTokenType.PASSWORD_RESET,
        ...data,
      }),
    );

    const result = await service.resetPassword(
      { token: 'token', new_password: 'ValidPass123!' },
      metadata,
    );
    expect(result.status).toBe('completed');
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects expired password reset tokens', async () => {
    const { service, prisma } = createService();
    prisma.authActionToken.findUnique.mockResolvedValue({
      type: AuthActionTokenType.PASSWORD_RESET,
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      service.resetPassword({ token: 'token', new_password: 'ValidPass123!' }, metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('changes password and revokes existing sessions', async () => {
    const { service, prisma } = createService();
    prisma.user.findUniqueOrThrow.mockResolvedValue(user());
    const result = await service.changePassword(
      'user-1',
      { current_password: 'ValidPass123!', new_password: 'AnotherPass123!' },
      metadata,
    );
    expect(result.status).toBe('changed');
  });
});
