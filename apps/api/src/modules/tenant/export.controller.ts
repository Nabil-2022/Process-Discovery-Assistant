import { Body, Controller, Get, Param, Post, Req, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { RequestMetadata } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentTenantContext } from './decorators/tenant-context.decorator';
import { CreateExportDto } from './dto/export.dto';
import { TenantAccessContext, TenantAccessGuard } from './guards/tenant-access.guard';
import { ExportService } from './services/export.service';

@ApiTags('tenant-exports')
@ApiBearerAuth()
@Controller('tenant')
@UseGuards(JwtAuthGuard, TenantAccessGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post('exports')
  create(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Body() dto: CreateExportDto,
    @Req() request: Request,
  ) {
    return this.exportService.create(ctx, dto, this.metadata(request));
  }

  @Get('exports')
  list(@CurrentTenantContext() ctx: TenantAccessContext) {
    return this.exportService.list(ctx);
  }

  @Get('exports/:exportJobId')
  get(@CurrentTenantContext() ctx: TenantAccessContext, @Param('exportJobId') exportJobId: string) {
    return this.exportService.get(ctx, exportJobId);
  }

  @Get('exports/:exportJobId/download')
  async download(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('exportJobId') exportJobId: string,
    @Req() request: Request,
  ) {
    const { job, buffer } = await this.exportService.download(
      ctx,
      exportJobId,
      this.metadata(request),
    );
    return new StreamableFile(buffer, {
      type: job.mimeType ?? 'application/octet-stream',
      disposition: `attachment; filename="${job.fileName ?? 'export.bin'}"`,
    });
  }

  @Post('exports/:exportJobId/cancel')
  cancel(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('exportJobId') exportJobId: string,
    @Req() request: Request,
  ) {
    return this.exportService.cancel(ctx, exportJobId, this.metadata(request));
  }

  @Post('exports/:exportJobId/retry')
  retry(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('exportJobId') exportJobId: string,
    @Req() request: Request,
  ) {
    return this.exportService.retry(ctx, exportJobId, this.metadata(request));
  }

  @Post('processes/:id/exports/process-sheet')
  processSheet(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.exportService.processExport(
      ctx,
      id,
      'process_sheet',
      'pdf',
      this.metadata(request),
    );
  }

  @Post('processes/:id/exports/procedure')
  procedure(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: Partial<CreateExportDto>,
    @Req() request: Request,
  ) {
    return this.exportService.processExport(
      ctx,
      id,
      'procedure',
      dto.export_format ?? 'docx',
      this.metadata(request),
    );
  }

  @Post('processes/:id/exports/raci')
  raci(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.exportService.processExport(ctx, id, 'raci_matrix', 'xlsx', this.metadata(request));
  }

  @Post('processes/:id/exports/bpmn')
  bpmn(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.exportService.processExport(
      ctx,
      id,
      'bpmn_diagram',
      'bpmn_xml',
      this.metadata(request),
    );
  }

  @Post('processes/:id/exports/risks')
  risks(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.exportService.processExport(
      ctx,
      id,
      'risk_register',
      'xlsx',
      this.metadata(request),
    );
  }

  @Post('processes/:id/exports/kpis')
  kpis(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.exportService.processExport(
      ctx,
      id,
      'kpi_register',
      'xlsx',
      this.metadata(request),
    );
  }

  @Post('processes/:id/exports/backlog')
  backlog(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.exportService.processExport(ctx, id, 'backlog', 'xlsx', this.metadata(request));
  }

  @Post('processes/:id/exports/full-package')
  fullPackage(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.exportService.processExport(ctx, id, 'full_package', 'zip', this.metadata(request));
  }

  @Post('directions/:id/exports/summary')
  directionSummary(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.exportService.directionSummary(ctx, id, 'pdf', this.metadata(request));
  }

  @Post('exports/executive-summary')
  executiveSummary(@CurrentTenantContext() ctx: TenantAccessContext, @Req() request: Request) {
    return this.exportService.executiveSummary(ctx, 'pdf', this.metadata(request));
  }

  private metadata(request: Request): RequestMetadata {
    return { ip: request.ip, userAgent: request.headers['user-agent'] };
  }
}
