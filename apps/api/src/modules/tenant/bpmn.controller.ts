import { Body, Controller, Get, Header, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { RequestMetadata } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentTenantContext } from './decorators/tenant-context.decorator';
import { BpmnValidationDto } from './dto/bpmn.dto';
import { TenantAccessContext, TenantAccessGuard } from './guards/tenant-access.guard';
import { BpmnService } from './services/bpmn.service';

@ApiTags('tenant-bpmn')
@ApiBearerAuth()
@Controller('tenant/processes')
@UseGuards(JwtAuthGuard, TenantAccessGuard)
export class BpmnController {
  constructor(private readonly bpmnService: BpmnService) {}

  @Get(':id/bpmn')
  get(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.bpmnService.getBpmn(ctx, id);
  }

  @Post(':id/bpmn/generate')
  generate(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.bpmnService.generate(ctx, id, this.metadata(req));
  }

  @Post(':id/bpmn/recalculate')
  recalculate(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.bpmnService.recalculate(ctx, id, this.metadata(req));
  }

  @Get(':id/bpmn/issues')
  issues(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.bpmnService.issues(ctx, id);
  }

  @Get(':id/bpmn/history')
  history(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.bpmnService.history(ctx, id);
  }

  @Get(':id/bpmn/versions')
  versions(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.bpmnService.versions(ctx, id);
  }

  @Get(':id/bpmn/export.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  exportXml(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.bpmnService.exportXml(ctx, id, this.metadata(req));
  }

  @Get(':id/bpmn/export.json')
  exportJson(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.bpmnService.exportJson(ctx, id, this.metadata(req));
  }

  @Post(':id/bpmn/validate')
  validate(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: BpmnValidationDto,
    @Req() req: Request,
  ) {
    return this.bpmnService.validate(ctx, id, dto, this.metadata(req));
  }

  @Post(':id/bpmn/invalidate')
  invalidate(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: BpmnValidationDto,
    @Req() req: Request,
  ) {
    return this.bpmnService.invalidate(ctx, id, dto, this.metadata(req));
  }

  private metadata(request: Request): RequestMetadata {
    return { ip: request.ip, userAgent: request.get('user-agent') };
  }
}
