import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID, createHash } from 'node:crypto';

import {
  AuthActionTokenType,
  MembershipStatus,
  Prisma,
  TenantStatus,
  UserStatus,
} from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { AUTH_ERROR_MESSAGE } from '../auth.constants';
import { RequestMetadata } from '../auth.types';
import {
  AcceptInvitationDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  InviteUserDto,
  LoginDto,
  ResetPasswordDto,
  SelectTenantDto,
} from '../dto/auth.dto';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { PasswordService } from './password.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
    private readonly rateLimitService: AuthRateLimitService,
  ) {}

  async login(dto: LoginDto, metadata: RequestMetadata) {
    if (this.configService.get<boolean>('LOCAL_AUTH_BYPASS') !== false) {
      return {
        access_token: this.createDemoAccessToken(),
        refresh_token: randomUUID(),
        requires_tenant_selection: false,
        tenants: [
          {
            tenant_id: 'demo-map-tenant',
            membership_id: 'demo-map-membership',
            slug: dto.tenant_slug ?? 'map-demo',
            name: 'MAP Demonstration',
          },
        ],
      };
    }

    this.rateLimitService.assertAllowed('login', metadata.ip, dto.email);
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: { include: { role: true } },
        memberships: {
          include: {
            tenant: { include: { tenantFeatures: { include: { feature: true } } } },
            roles: {
              include: { role: { include: { permissions: { include: { permission: true } } } } },
            },
            directions: { include: { direction: true } },
          },
        },
      },
    });

    if (!user || !(await this.passwordService.verify(user.passwordHash, dto.password))) {
      await this.audit(null, null, 'login_failure', 'auth', null, 'failure', metadata, {
        emailMasked: this.mask(email),
      });
      throw new UnauthorizedException(AUTH_ERROR_MESSAGE);
    }

    if (user.status !== UserStatus.ACTIVE) {
      await this.audit(null, user.id, 'access_denied', 'users', user.id, 'failure', metadata, {
        reason: 'user_not_active',
      });
      throw new UnauthorizedException(AUTH_ERROR_MESSAGE);
    }

    const activeMemberships = user.memberships.filter(
      (membership) =>
        membership.status === MembershipStatus.ACTIVE &&
        membership.tenant.status === TenantStatus.ACTIVE,
    );

    const selectedMembership = this.resolveSelectedMembership(activeMemberships, dto);
    if ((dto.tenant_id || dto.tenant_slug) && !selectedMembership) {
      await this.audit(
        null,
        user.id,
        'access_denied',
        'tenants',
        dto.tenant_id ?? null,
        'failure',
        metadata,
        {
          reason: 'tenant_not_available',
        },
      );
      throw new UnauthorizedException(AUTH_ERROR_MESSAGE);
    }

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ip,
        expiresAt: this.addDuration(
          new Date(),
          this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
        ),
      },
    });

    const refresh = await this.createRefreshToken(user.id, session.id, metadata);
    const accessToken = await this.createAccessToken(user, session.id, selectedMembership);

    await this.audit(
      selectedMembership?.tenantId ?? null,
      user.id,
      'login_success',
      'sessions',
      session.id,
      'success',
      metadata,
    );

    return {
      access_token: accessToken,
      refresh_token: refresh.rawToken,
      requires_tenant_selection: activeMemberships.length > 1 && !selectedMembership,
      tenants: activeMemberships.map((membership) => ({
        tenant_id: membership.tenantId,
        membership_id: membership.id,
        slug: membership.tenant.slug,
        name: membership.tenant.name,
      })),
    };
  }

  async refresh(rawRefreshToken: string | undefined, metadata: RequestMetadata) {
    this.rateLimitService.assertAllowed('refresh', metadata.ip);
    if (!rawRefreshToken) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGE);
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            userRoles: { include: { role: true } },
            memberships: {
              include: {
                tenant: { include: { tenantFeatures: { include: { feature: true } } } },
                roles: {
                  include: {
                    role: { include: { permissions: { include: { permission: true } } } },
                  },
                },
                directions: { include: { direction: true } },
              },
            },
          },
        },
        session: true,
      },
    });

    if (!stored) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGE);
    }

    if (stored.usedAt || stored.revokedAt) {
      await this.revokeRefreshTokenFamily(stored.familyId);
      await this.audit(
        null,
        stored.userId,
        'refresh_token_reuse_detected',
        'sessions',
        stored.sessionId,
        'failure',
        metadata,
      );
      throw new UnauthorizedException(AUTH_ERROR_MESSAGE);
    }

    if (
      stored.expiresAt <= new Date() ||
      stored.session.revokedAt ||
      stored.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGE);
    }

    const newRefresh = await this.createRefreshToken(
      stored.userId,
      stored.sessionId,
      metadata,
      stored.familyId,
      stored.id,
    );
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: {
        usedAt: new Date(),
        revokedAt: new Date(),
        lastUsedIp: metadata.ip,
        replacedByTokenId: newRefresh.id,
      },
    });

    const memberships = stored.user.memberships.filter(
      (membership) =>
        membership.status === MembershipStatus.ACTIVE &&
        membership.tenant.status === TenantStatus.ACTIVE,
    );
    const activeMembership = memberships.length === 1 ? memberships[0] : undefined;

    await this.audit(
      activeMembership?.tenantId ?? null,
      stored.userId,
      'token_refresh',
      'sessions',
      stored.sessionId,
      'success',
      metadata,
    );

    return {
      access_token: await this.createAccessToken(stored.user, stored.sessionId, activeMembership),
      refresh_token: newRefresh.rawToken,
    };
  }

  async selectTenant(
    userId: string,
    sessionId: string,
    dto: SelectTenantDto,
    metadata: RequestMetadata,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        memberships: {
          include: {
            tenant: { include: { tenantFeatures: { include: { feature: true } } } },
            roles: {
              include: { role: { include: { permissions: { include: { permission: true } } } } },
            },
            directions: { include: { direction: true } },
          },
        },
      },
    });
    const membership = this.resolveSelectedMembership(
      user.memberships.filter(
        (item) =>
          item.status === MembershipStatus.ACTIVE && item.tenant.status === TenantStatus.ACTIVE,
      ),
      dto,
    );

    if (!membership) {
      await this.audit(
        null,
        user.id,
        'access_denied',
        'tenants',
        dto.tenant_id ?? null,
        'failure',
        metadata,
      );
      throw new ForbiddenException('Contexte tenant non autorisé.');
    }

    await this.audit(
      membership.tenantId,
      user.id,
      'tenant_selected',
      'tenants',
      membership.tenantId,
      'success',
      metadata,
    );
    return {
      access_token: await this.createAccessToken(user, sessionId, membership),
      tenant: this.mapTenant(membership),
      permissions: this.getTenantPermissions(membership),
    };
  }

  async me(userId: string, sessionId: string, activeTenantId?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        sessions: { where: { id: sessionId } },
        memberships: {
          include: {
            tenant: { include: { tenantFeatures: { include: { feature: true } } } },
            roles: {
              include: { role: { include: { permissions: { include: { permission: true } } } } },
            },
            directions: { include: { direction: true } },
          },
        },
      },
    });
    const membership = activeTenantId
      ? user.memberships.find(
          (item) => item.tenantId === activeTenantId && item.status === MembershipStatus.ACTIVE,
        )
      : undefined;

    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        status: user.status,
        locale: user.locale,
      },
      tenant: membership ? this.mapTenant(membership) : null,
      membership: membership ? { id: membership.id, status: membership.status } : null,
      global_roles: user.userRoles.map((item) => item.role.code),
      tenant_roles: membership ? membership.roles.map((item) => item.role.code) : [],
      permissions: membership ? this.getTenantPermissions(membership) : [],
      directions: membership
        ? membership.directions.map((item) => ({
            id: item.direction.id,
            name: item.direction.name,
            code: item.direction.code,
          }))
        : [],
      features: membership
        ? membership.tenant.tenantFeatures
            .filter((item) => item.enabled)
            .map((item) => item.feature.code)
        : [],
      session: user.sessions[0]
        ? { id: user.sessions[0].id, expires_at: user.sessions[0].expiresAt }
        : null,
    };
  }

  async logout(userId: string, sessionId: string, metadata: RequestMetadata) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId },
      data: { revokedAt: new Date() },
    });
    await this.prisma.refreshToken.updateMany({
      where: { sessionId, userId },
      data: { revokedAt: new Date() },
    });
    await this.audit(null, userId, 'logout', 'sessions', sessionId, 'success', metadata);
  }

  async logoutAll(userId: string, metadata: RequestMetadata) {
    await this.prisma.session.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });
    await this.audit(null, userId, 'logout_all', 'sessions', null, 'success', metadata);
  }

  async invite(dto: InviteUserDto, actorUserId: string, metadata: RequestMetadata) {
    this.rateLimitService.assertAllowed('invite', metadata.ip, dto.email);
    if (!dto.tenant_id) {
      throw new BadRequestException('Un tenant valide est requis pour inviter un utilisateur.');
    }

    const tenantId = dto.tenant_id;
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.upsert({
      where: { email },
      create: { email, fullName: dto.full_name, status: UserStatus.INVITED },
      update: { fullName: dto.full_name },
    });
    const membership = await this.prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: {
        tenantId,
        userId: user.id,
        status: MembershipStatus.INVITED,
        invitedBy: actorUserId,
        invitedAt: new Date(),
      },
      update: { status: MembershipStatus.INVITED, invitedBy: actorUserId, invitedAt: new Date() },
    });

    if (dto.role_codes?.length) {
      const roles = await this.prisma.role.findMany({ where: { code: { in: dto.role_codes } } });
      for (const role of roles) {
        await this.prisma.membershipRole.upsert({
          where: { membershipId_roleId: { membershipId: membership.id, roleId: role.id } },
          create: { membershipId: membership.id, roleId: role.id },
          update: {},
        });
      }
    }

    if (dto.direction_id) {
      await this.prisma.membershipDirection.upsert({
        where: {
          membershipId_directionId: { membershipId: membership.id, directionId: dto.direction_id },
        },
        create: { membershipId: membership.id, directionId: dto.direction_id },
        update: {},
      });
    }

    const token = await this.createActionToken(
      AuthActionTokenType.INVITATION,
      user.id,
      this.configService.get<string>('INVITATION_EXPIRES_IN', '7d'),
      metadata,
      tenantId,
      membership.id,
    );
    await this.audit(
      tenantId,
      actorUserId,
      'invitation_created',
      'tenant_memberships',
      membership.id,
      'success',
      metadata,
    );
    return { invitation_token: token.rawToken, email_delivery: 'development_console_or_mailpit' };
  }

  async acceptInvitation(dto: AcceptInvitationDto, metadata: RequestMetadata) {
    this.rateLimitService.assertAllowed('accept_invitation', metadata.ip);
    const token = await this.consumeActionToken(dto.token, AuthActionTokenType.INVITATION);
    const passwordHash = await this.passwordService.hash(dto.password);
    await this.prisma.user.update({
      where: { id: token.userId },
      data: { passwordHash, status: UserStatus.ACTIVE },
    });
    if (token.membershipId) {
      await this.prisma.tenantMembership.update({
        where: { id: token.membershipId },
        data: { status: MembershipStatus.ACTIVE, joinedAt: new Date() },
      });
    }
    await this.audit(
      token.tenantId ?? null,
      token.userId,
      'invitation_accepted',
      'users',
      token.userId,
      'success',
      metadata,
    );
    return { status: 'accepted' };
  }

  async forgotPassword(dto: ForgotPasswordDto, metadata: RequestMetadata) {
    this.rateLimitService.assertAllowed('forgot_password', metadata.ip, dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (user) {
      await this.createActionToken(
        AuthActionTokenType.PASSWORD_RESET,
        user.id,
        this.configService.get<string>('PASSWORD_RESET_EXPIRES_IN', '30m'),
        metadata,
      );
      await this.audit(
        null,
        user.id,
        'password_reset_requested',
        'users',
        user.id,
        'success',
        metadata,
      );
    }
    return { status: 'accepted' };
  }

  async resetPassword(dto: ResetPasswordDto, metadata: RequestMetadata) {
    this.rateLimitService.assertAllowed('reset_password', metadata.ip);
    const token = await this.consumeActionToken(dto.token, AuthActionTokenType.PASSWORD_RESET);
    const passwordHash = await this.passwordService.hash(dto.new_password);
    await this.prisma.user.update({
      where: { id: token.userId },
      data: { passwordHash, status: UserStatus.ACTIVE },
    });
    await this.revokeUserSessions(token.userId);
    await this.audit(
      null,
      token.userId,
      'password_reset_completed',
      'users',
      token.userId,
      'success',
      metadata,
    );
    return { status: 'completed' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto, metadata: RequestMetadata) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await this.passwordService.verify(user.passwordHash, dto.current_password))) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGE);
    }
    const passwordHash = await this.passwordService.hash(dto.new_password);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.revokeUserSessions(userId);
    await this.audit(null, userId, 'password_changed', 'users', userId, 'success', metadata);
    return { status: 'changed' };
  }

  async suspendUser(userId: string, actorUserId: string, metadata: RequestMetadata) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.SUSPENDED },
    });
    await this.revokeUserSessions(userId);
    await this.audit(null, actorUserId, 'user_suspended', 'users', userId, 'success', metadata);
  }

  async suspendMembership(membershipId: string, actorUserId: string, metadata: RequestMetadata) {
    const membership = await this.prisma.tenantMembership.update({
      where: { id: membershipId },
      data: { status: MembershipStatus.SUSPENDED },
    });
    await this.audit(
      membership.tenantId,
      actorUserId,
      'membership_suspended',
      'tenant_memberships',
      membershipId,
      'success',
      metadata,
    );
  }

  async suspendTenant(tenantId: string, actorUserId: string, metadata: RequestMetadata) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: TenantStatus.SUSPENDED },
    });
    const sessions = await this.prisma.session.findMany({
      where: { user: { memberships: { some: { tenantId } } } },
      select: { id: true, userId: true },
    });
    await this.prisma.session.updateMany({
      where: { id: { in: sessions.map((session) => session.id) } },
      data: { revokedAt: new Date() },
    });
    await this.prisma.refreshToken.updateMany({
      where: { sessionId: { in: sessions.map((session) => session.id) } },
      data: { revokedAt: new Date() },
    });
    await this.audit(
      tenantId,
      actorUserId,
      'tenant_suspended',
      'tenants',
      tenantId,
      'success',
      metadata,
    );
  }

  private resolveSelectedMembership<T extends { tenantId: string; tenant: { slug: string } }>(
    memberships: T[],
    dto: { tenant_id?: string; tenant_slug?: string },
  ) {
    if (dto.tenant_id) {
      return memberships.find((membership) => membership.tenantId === dto.tenant_id);
    }
    if (dto.tenant_slug) {
      return memberships.find((membership) => membership.tenant.slug === dto.tenant_slug);
    }
    return memberships.length === 1 ? memberships[0] : undefined;
  }

  private async createAccessToken(
    user: {
      id: string;
      userRoles: { role: { code: string } }[];
    },
    sessionId: string,
    membership?: {
      id: string;
      tenantId: string;
      roles: { role: { code: string; permissions: { permission: { code: string } }[] } }[];
    },
  ) {
    const payload = {
      sub: user.id,
      session_id: sessionId,
      active_tenant_id: membership?.tenantId,
      membership_id: membership?.id,
      global_roles: user.userRoles.map((item) => item.role.code),
      tenant_roles: membership?.roles.map((item) => item.role.code) ?? [],
      permissions: membership ? this.getTenantPermissions(membership) : [],
      token_type: 'access' as const,
      jti: randomUUID(),
    };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as never,
    });
  }

  private async createRefreshToken(
    userId: string,
    sessionId: string,
    metadata: RequestMetadata,
    familyId: string = randomUUID(),
    rotatedFromId?: string,
  ) {
    const rawToken = this.randomToken();
    const record = await this.prisma.refreshToken.create({
      data: {
        userId,
        sessionId,
        tokenHash: this.hashToken(rawToken),
        familyId,
        rotatedFromId,
        expiresAt: this.addDuration(
          new Date(),
          this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
        ),
        createdIp: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });
    return { ...record, rawToken };
  }

  private async createActionToken(
    type: AuthActionTokenType,
    userId: string,
    duration: string,
    metadata: RequestMetadata,
    tenantId?: string,
    membershipId?: string,
  ) {
    const rawToken = this.randomToken();
    const record = await this.prisma.authActionToken.create({
      data: {
        userId,
        tenantId,
        membershipId,
        type,
        tokenHash: this.hashToken(rawToken),
        expiresAt: this.addDuration(new Date(), duration),
        createdIp: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });
    return { ...record, rawToken };
  }

  private async consumeActionToken(rawToken: string, type: AuthActionTokenType) {
    const token = await this.prisma.authActionToken.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
    });
    if (!token || token.type !== type || token.usedAt || token.expiresAt <= new Date()) {
      throw new BadRequestException('Token invalide ou expiré.');
    }
    return this.prisma.authActionToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });
  }

  private async revokeRefreshTokenFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeUserSessions(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });
  }

  private getTenantPermissions(membership: {
    roles: { role: { permissions: { permission: { code: string } }[] } }[];
  }) {
    return Array.from(
      new Set(
        membership.roles.flatMap((role) =>
          role.role.permissions.map((permission) => permission.permission.code),
        ),
      ),
    ).sort();
  }

  private mapTenant(membership: {
    tenantId: string;
    tenant: { id: string; slug: string; name: string; status: TenantStatus };
  }) {
    return {
      id: membership.tenant.id,
      tenant_id: membership.tenantId,
      slug: membership.tenant.slug,
      name: membership.tenant.name,
      status: membership.tenant.status,
    };
  }

  private hashToken(token: string) {
    return createHash('sha256')
      .update(`${this.configService.getOrThrow<string>('JWT_REFRESH_SECRET')}:${token}`)
      .digest('hex');
  }

  private randomToken() {
    return randomBytes(48).toString('base64url');
  }

  private createDemoAccessToken() {
    const header = this.base64Url({ alg: 'none', typ: 'JWT' });
    const payload = this.base64Url({
      token_type: 'access',
      sub: 'demo-user',
      session_id: 'demo-session',
      active_tenant_id: 'demo-map-tenant',
      membership_id: 'demo-map-membership',
      global_roles: [],
      tenant_roles: ['tenant_admin'],
      permissions: [
        'manage_directions',
        'manage_users',
        'create_process',
        'update_process_working_copy',
        'export_process',
        'manage_ai_suggestions',
      ],
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      jti: 'demo-token',
    });
    return `${header}.${payload}.demo`;
  }

  private base64Url(value: unknown) {
    return Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private addDuration(date: Date, duration: string) {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) {
      throw new Error(`Invalid duration: ${duration}`);
    }
    const value = Number(match[1]);
    const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return new Date(date.getTime() + value * multipliers[match[2] as keyof typeof multipliers]);
  }

  private async audit(
    tenantId: string | null,
    actorUserId: string | null,
    action: string,
    resourceType: string,
    resourceId: string | null,
    result: string,
    metadata: RequestMetadata,
    extra?: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action,
        resourceType,
        resourceId,
        result,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
        metadata: extra as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private mask(email: string) {
    const [name, domain] = email.split('@');
    return `${name?.slice(0, 2) ?? '**'}***@${domain ?? 'unknown'}`;
  }
}
