import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { RequestMetadata } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentTenantContext } from './decorators/tenant-context.decorator';
import {
  CreatePublicAuditRiskDto,
  ImportEventLogCsvDto,
  MapEventLogColumnsDto,
  UpdateMoroccoComplianceDto,
} from './dto/morocco-compliance.dto';
import { TenantAccessContext, TenantAccessGuard } from './guards/tenant-access.guard';
import { MoroccoComplianceService } from './services/morocco-compliance.service';

@ApiTags('tenant-morocco-compliance')
@ApiBearerAuth()
@Controller('tenant')
@UseGuards(JwtAuthGuard, TenantAccessGuard)
export class MoroccoComplianceController {
  constructor(private readonly moroccoComplianceService: MoroccoComplianceService) {}

  @Get('morocco-compliance/dashboard')
  dashboard(@CurrentTenantContext() ctx: TenantAccessContext) {
    return this.moroccoComplianceService.dashboard(ctx);
  }

  @Get('processes/:id/morocco-compliance')
  getCompliance(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.moroccoComplianceService.getCompliance(ctx, id);
  }

  @Put('processes/:id/morocco-compliance')
  upsertCompliance(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: UpdateMoroccoComplianceDto,
    @Req() request: Request,
  ) {
    return this.moroccoComplianceService.upsertCompliance(ctx, id, dto, this.metadata(request));
  }

  @Post('processes/:id/public-audit-risks')
  createPublicAuditRisk(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: CreatePublicAuditRiskDto,
    @Req() request: Request,
  ) {
    return this.moroccoComplianceService.createPublicAuditRisk(
      ctx,
      id,
      dto,
      this.metadata(request),
    );
  }

  @Post('processes/:id/event-logs/import-csv')
  importCsv(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: ImportEventLogCsvDto,
    @Req() request: Request,
  ) {
    return this.moroccoComplianceService.importCsv(ctx, id, dto, this.metadata(request));
  }

  @Get('processes/:id/event-logs')
  eventLogs(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.moroccoComplianceService.listEventLogs(ctx, id);
  }

  @Get('processes/:id/event-logs/:importId')
  eventLog(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('importId') importId: string,
  ) {
    return this.moroccoComplianceService.getEventLogImport(ctx, id, importId);
  }

  @Get('processes/:id/event-logs/:importId/events')
  events(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('importId') importId: string,
  ) {
    return this.moroccoComplianceService.listEvents(ctx, id, importId);
  }

  @Post('processes/:id/event-logs/:importId/map-columns')
  mapColumns(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('importId') importId: string,
    @Body() dto: MapEventLogColumnsDto,
    @Req() request: Request,
  ) {
    return this.moroccoComplianceService.mapColumns(ctx, id, importId, dto, this.metadata(request));
  }

  @Post('processes/:id/event-logs/:importId/validate')
  validate(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('importId') importId: string,
  ) {
    return this.moroccoComplianceService.validateImport(ctx, id, importId);
  }

  @Post('processes/:id/event-logs/:importId/analyze-basic')
  analyzeBasic(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('importId') importId: string,
    @Req() request: Request,
  ) {
    return this.moroccoComplianceService.analyzeBasic(ctx, id, importId, this.metadata(request));
  }

  private metadata(request: Request): RequestMetadata {
    return {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    };
  }
}
