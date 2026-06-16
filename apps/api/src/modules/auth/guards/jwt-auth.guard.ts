import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import { MembershipStatus, TenantStatus, UserStatus } from '../../../generated/prisma';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import { AuthenticatedRequestUser } from '../auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractBearerToken(request.headers.authorization);
    if (!token) {
      return this.useLocalAuthBypass(request);
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthenticatedRequestUser>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (payload.token_type !== 'access') {
        throw new UnauthorizedException();
      }

      const session = await this.prisma.session.findUnique({ where: { id: payload.session_id } });
      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        throw new UnauthorizedException();
      }

      request.user = payload;
      return true;
    } catch {
      return this.useLocalAuthBypass(request);
    }
  }

  private extractBearerToken(header: string | undefined) {
    const [type, token] = header?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private async useLocalAuthBypass(request: { user?: AuthenticatedRequestUser }) {
    if (!this.localAuthBypassEnabled()) {
      throw new UnauthorizedException();
    }

    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        status: MembershipStatus.ACTIVE,
        tenant: { slug: 'map-demo', status: TenantStatus.ACTIVE },
        user: { email: 'tenant.admin@example.test', status: UserStatus.ACTIVE },
      },
      include: {
        tenant: true,
        user: { include: { userRoles: { include: { role: true } } } },
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });

    if (!membership) {
      throw new UnauthorizedException('Local demo auth bypass needs the seeded map-demo tenant.');
    }

    request.user = {
      sub: membership.userId,
      session_id: 'local-auth-bypass',
      active_tenant_id: membership.tenantId,
      membership_id: membership.id,
      global_roles: membership.user.userRoles.map((item) => item.role.code),
      tenant_roles: membership.roles.map((item) => item.role.code),
      permissions: [
        ...new Set(
          membership.roles.flatMap((item) =>
            item.role.permissions.map((permission) => permission.permission.code),
          ),
        ),
      ],
      token_type: 'access',
      jti: 'local-auth-bypass',
    };

    return true;
  }

  private localAuthBypassEnabled() {
    if (typeof this.configService.get !== 'function') {
      return false;
    }

    return this.configService.get<boolean>('LOCAL_AUTH_BYPASS') !== false;
  }
}
