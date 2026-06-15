import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import {
  MembershipStatus,
  SupportAccessStatus,
  TenantStatus,
  UserStatus,
} from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedRequestUser } from '../../auth/auth.types';

export type TenantAccessContext = {
  tenantId: string;
  actorUserId: string;
  membershipId?: string;
  tenantRoles: string[];
  permissions: string[];
  supportGrantId?: string;
  directionIds: string[];
  isSupportAccess: boolean;
};

@Injectable()
export class TenantAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedRequestUser | undefined;
    if (!user) {
      throw new ForbiddenException('Contexte utilisateur manquant.');
    }

    const dbUser = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (!dbUser || dbUser.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Utilisateur inactif.');
    }

    const supportGrantId = this.headerValue(request.headers['x-support-grant-id']);
    if (supportGrantId) {
      request.tenantContext = await this.resolveSupportAccess(user, supportGrantId);
      return true;
    }

    if (!user.active_tenant_id || !user.membership_id) {
      throw new ForbiddenException('Contexte tenant requis.');
    }

    const membership = await this.prisma.tenantMembership.findUnique({
      where: { id: user.membership_id },
      include: {
        tenant: true,
        directions: true,
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });
    if (
      !membership ||
      membership.userId !== user.sub ||
      membership.tenantId !== user.active_tenant_id ||
      membership.status !== MembershipStatus.ACTIVE ||
      membership.tenant.status !== TenantStatus.ACTIVE
    ) {
      throw new ForbiddenException('Contexte tenant indisponible.');
    }

    request.tenantContext = {
      tenantId: membership.tenantId,
      actorUserId: user.sub,
      membershipId: membership.id,
      tenantRoles: membership.roles.map((item) => item.role.code),
      permissions: [
        ...new Set(
          membership.roles.flatMap((item) =>
            item.role.permissions.map((permission) => permission.permission.code),
          ),
        ),
      ],
      directionIds: membership.directions.map((item) => item.directionId),
      isSupportAccess: false,
    } satisfies TenantAccessContext;
    return true;
  }

  private async resolveSupportAccess(user: AuthenticatedRequestUser, grantId: string) {
    if (!user.global_roles.includes('super_admin')) {
      throw new ForbiddenException('Acces support reserve au super_admin.');
    }
    const grant = await this.prisma.supportAccessGrant.findUnique({
      where: { id: grantId },
      include: { tenant: true },
    });
    const now = new Date();
    if (
      !grant ||
      grant.supportUserId !== user.sub ||
      grant.status !== SupportAccessStatus.ACTIVE ||
      grant.revokedAt ||
      grant.validFrom > now ||
      grant.expiresAt <= now ||
      grant.tenant.status !== TenantStatus.ACTIVE
    ) {
      throw new ForbiddenException('Support access grant invalide.');
    }

    return {
      tenantId: grant.tenantId,
      actorUserId: user.sub,
      tenantRoles: [],
      permissions: ['support_read'],
      supportGrantId: grant.id,
      directionIds: [],
      isSupportAccess: true,
    } satisfies TenantAccessContext;
  }

  private headerValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }
}
