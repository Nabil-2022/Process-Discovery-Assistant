import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const GLOBAL_ROLES_KEY = 'globalRoles';
export const PERMISSIONS_KEY = 'permissions';
export const TENANT_REQUIRED_KEY = 'tenantRequired';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const GlobalRoles = (...roles: string[]) => SetMetadata(GLOBAL_ROLES_KEY, roles);
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
export const TenantRequired = () => SetMetadata(TENANT_REQUIRED_KEY, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user;
});

export const CurrentTenant = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().tenant;
});

export const CurrentMembership = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().membership;
});
