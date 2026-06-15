import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { MembershipStatus, TenantStatus, UserStatus } from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GLOBAL_ROLES_KEY,
  PERMISSIONS_KEY,
  TENANT_REQUIRED_KEY,
} from '../decorators/auth.decorators';

@Injectable()
export class AuthPolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const auth = request.user;
    if (!auth) {
      return true;
    }

    const user = await this.prisma.user.findUnique({ where: { id: auth.sub } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Utilisateur inactif.');
    }

    const tenantRequired = this.reflector.getAllAndOverride<boolean>(TENANT_REQUIRED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredGlobalRoles =
      this.reflector.getAllAndOverride<string[]>(GLOBAL_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (
      requiredGlobalRoles.length &&
      !requiredGlobalRoles.some((role) => auth.global_roles.includes(role))
    ) {
      throw new ForbiddenException('Rôle global manquant.');
    }

    if (tenantRequired && !auth.active_tenant_id) {
      throw new ForbiddenException('Contexte tenant requis.');
    }

    if (auth.active_tenant_id && auth.membership_id) {
      const membership = await this.prisma.tenantMembership.findUnique({
        where: { id: auth.membership_id },
        include: { tenant: true },
      });
      if (
        !membership ||
        membership.userId !== auth.sub ||
        membership.tenantId !== auth.active_tenant_id ||
        membership.status !== MembershipStatus.ACTIVE ||
        membership.tenant.status !== TenantStatus.ACTIVE
      ) {
        throw new ForbiddenException('Contexte tenant indisponible.');
      }
      request.membership = membership;
      request.tenant = membership.tenant;
    }

    if (
      requiredPermissions.length &&
      !requiredPermissions.every((permission) => auth.permissions.includes(permission))
    ) {
      throw new ForbiddenException('Permission manquante.');
    }

    return true;
  }
}
