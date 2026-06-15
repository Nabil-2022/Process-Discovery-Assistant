import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentTenantContext } from './decorators/tenant-context.decorator';
import {
  AssignReferentDto,
  CreateDirectionDto,
  ListDirectionsQueryDto,
  RemindReferentDto,
  TenantDashboardQueryDto,
  UpdateDirectionDto,
} from './dto/tenant.dto';
import { TenantAccessContext, TenantAccessGuard } from './guards/tenant-access.guard';
import { TenantService } from './services/tenant.service';

@ApiTags('tenant')
@ApiBearerAuth()
@Controller('tenant')
@UseGuards(JwtAuthGuard, TenantAccessGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('dashboard/summary')
  dashboardSummary(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Query() query: TenantDashboardQueryDto,
  ) {
    return this.tenantService.dashboardSummary(ctx, query);
  }

  @Get('dashboard/progress-by-direction')
  progressByDirection(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Query() query: TenantDashboardQueryDto,
  ) {
    return this.tenantService.progressByDirection(ctx, query);
  }

  @Get('dashboard/process-status-distribution')
  processStatusDistribution(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Query() query: TenantDashboardQueryDto,
  ) {
    return this.tenantService.processStatusDistribution(ctx, query);
  }

  @Get('dashboard/process-category-distribution')
  processCategoryDistribution(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Query() query: TenantDashboardQueryDto,
  ) {
    return this.tenantService.processCategoryDistribution(ctx, query);
  }

  @Get('dashboard/risks-by-criticality')
  risksByCriticality(@CurrentTenantContext() ctx: TenantAccessContext) {
    return this.tenantService.risksByCriticality(ctx);
  }

  @Get('dashboard/maturity-overview')
  maturityOverview(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Query() query: TenantDashboardQueryDto,
  ) {
    return this.tenantService.maturityOverview(ctx, query);
  }

  @Get('dashboard/actions-priority')
  actionsPriority(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Query() query: TenantDashboardQueryDto,
  ) {
    return this.tenantService.actionsPriority(ctx, query);
  }

  @Get('directions')
  listDirections(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Query() query: ListDirectionsQueryDto,
  ) {
    return this.tenantService.listDirections(ctx, query);
  }

  @Get('directions/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  exportDirections(@CurrentTenantContext() ctx: TenantAccessContext, @Req() request: Request) {
    return this.tenantService.exportDirectionsCsv(ctx, this.metadata(request));
  }

  @Get('directions/:id')
  getDirection(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.tenantService.getDirection(ctx, id);
  }

  @Post('directions')
  createDirection(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Body() dto: CreateDirectionDto,
    @Req() request: Request,
  ) {
    return this.tenantService.createDirection(ctx, dto, this.metadata(request));
  }

  @Patch('directions/:id')
  updateDirection(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: UpdateDirectionDto,
    @Req() request: Request,
  ) {
    return this.tenantService.updateDirection(ctx, id, dto, this.metadata(request));
  }

  @Delete('directions/:id')
  @HttpCode(204)
  deleteDirection(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.tenantService.deleteDirection(ctx, id, this.metadata(request));
  }

  @Post('directions/:id/assign-referent')
  @HttpCode(204)
  assignReferent(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: AssignReferentDto,
    @Req() request: Request,
  ) {
    return this.tenantService.assignReferent(ctx, id, dto, this.metadata(request));
  }

  @Post('directions/:id/remove-referent')
  @HttpCode(204)
  removeReferent(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: AssignReferentDto,
    @Req() request: Request,
  ) {
    return this.tenantService.removeReferent(ctx, id, dto, this.metadata(request));
  }

  @Post('directions/:id/remind-referent')
  @HttpCode(204)
  remindReferent(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: RemindReferentDto,
    @Req() request: Request,
  ) {
    return this.tenantService.remindReferent(ctx, id, dto, this.metadata(request));
  }

  @Get('directions/:id/progress')
  directionProgress(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.tenantService.directionProgress(ctx, id);
  }

  @Get('directions/:id/activity')
  directionActivity(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.tenantService.directionActivity(ctx, id);
  }

  @Get('directions/:id/processes')
  directionProcesses(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.tenantService.directionProcesses(ctx, id);
  }

  private metadata(request: Request) {
    return {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };
  }
}
