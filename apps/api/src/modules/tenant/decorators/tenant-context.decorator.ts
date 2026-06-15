import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentTenantContext = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().tenantContext;
});
