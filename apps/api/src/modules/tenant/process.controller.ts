import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { RequestMetadata } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentTenantContext } from './decorators/tenant-context.decorator';
import {
  ActivityDto,
  ActorDto,
  ApplicationDto,
  AutomationNeedDto,
  ControlDto,
  CreateProcessDto,
  DocumentDto,
  KpiDto,
  ListProcessesQueryDto,
  PainPointDto,
  ReorderActivitiesDto,
  ResponsibilitiesDto,
  RiskDto,
  SubmitProcessDto,
  UpdateProcessDto,
  WizardStepDto,
} from './dto/process.dto';
import { TenantAccessContext, TenantAccessGuard } from './guards/tenant-access.guard';
import { ProcessService, RelationKind } from './services/process.service';

@ApiTags('tenant-processes')
@ApiBearerAuth()
@Controller('tenant/processes')
@UseGuards(JwtAuthGuard, TenantAccessGuard)
export class ProcessController {
  constructor(private readonly processService: ProcessService) {}

  @Get()
  list(@CurrentTenantContext() ctx: TenantAccessContext, @Query() query: ListProcessesQueryDto) {
    return this.processService.listProcesses(ctx, query);
  }

  @Post()
  create(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Body() dto: CreateProcessDto,
    @Req() request: Request,
  ) {
    return this.processService.createProcess(ctx, dto, this.metadata(request));
  }

  @Get(':id')
  get(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.processService.getProcess(ctx, id);
  }

  @Patch(':id')
  update(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: UpdateProcessDto,
    @Req() request: Request,
  ) {
    return this.processService.updateProcess(ctx, id, dto, this.metadata(request));
  }

  @Delete(':id')
  @HttpCode(204)
  delete(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.processService.deleteProcess(ctx, id, this.metadata(request));
  }

  @Get(':id/wizard')
  wizard(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.processService.getWizard(ctx, id);
  }

  @Patch(':id/wizard/:step')
  saveWizardStep(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('step') step: string,
    @Body() dto: WizardStepDto,
    @Req() request: Request,
  ) {
    return this.processService.saveWizardStep(ctx, id, Number(step), dto, this.metadata(request));
  }

  @Get(':id/completeness')
  completeness(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.processService.calculateCompleteness(ctx, id);
  }

  @Post(':id/completeness/recalculate')
  recalculateCompleteness(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.processService.recalculateCompleteness(ctx, id, this.metadata(request));
  }

  @Get(':id/quality-check')
  qualityCheck(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.processService.qualityCheck(ctx, id);
  }

  @Get(':id/blocking-issues')
  blockingIssues(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.processService.blockingIssues(ctx, id);
  }

  @Get(':id/warnings')
  warnings(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.processService.warnings(ctx, id);
  }

  @Post(':id/submit')
  submit(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: SubmitProcessDto,
    @Req() request: Request,
  ) {
    return this.processService.submitProcess(ctx, id, dto, this.metadata(request));
  }

  @Get(':id/activities')
  listActivities(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.processService.listActivities(ctx, id);
  }

  @Post(':id/activities')
  createActivity(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: ActivityDto,
    @Req() request: Request,
  ) {
    return this.processService.createActivity(ctx, id, dto, this.metadata(request));
  }

  @Patch(':id/activities/:activityId')
  updateActivity(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('activityId') activityId: string,
    @Body() dto: ActivityDto,
    @Req() request: Request,
  ) {
    return this.processService.updateActivity(ctx, id, activityId, dto, this.metadata(request));
  }

  @Delete(':id/activities/:activityId')
  @HttpCode(204)
  deleteActivity(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('activityId') activityId: string,
    @Req() request: Request,
  ) {
    return this.processService.deleteActivity(ctx, id, activityId, this.metadata(request));
  }

  @Post(':id/activities/reorder')
  @HttpCode(204)
  reorderActivities(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: ReorderActivitiesDto,
    @Req() request: Request,
  ) {
    return this.processService.reorderActivities(ctx, id, dto, this.metadata(request));
  }

  @Post(':id/activities/:activityId/duplicate')
  duplicateActivity(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('activityId') activityId: string,
    @Req() request: Request,
  ) {
    return this.processService.duplicateActivity(ctx, id, activityId, this.metadata(request));
  }

  @Get(':id/actors')
  actors(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.processService.getActors(ctx, id);
  }

  @Post(':id/actors')
  createActor(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: ActorDto,
    @Req() request: Request,
  ) {
    return this.processService.createActor(ctx, id, dto, this.metadata(request));
  }

  @Patch(':id/actors/:actorId')
  updateActor(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('actorId') actorId: string,
    @Body() dto: ActorDto,
  ) {
    return this.processService.updateActor(ctx, id, actorId, dto);
  }

  @Delete(':id/actors/:actorId')
  @HttpCode(204)
  deleteActor(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('actorId') actorId: string,
  ) {
    return this.processService.deleteActor(ctx, id, actorId);
  }

  @Put(':id/responsibilities')
  updateResponsibilities(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: ResponsibilitiesDto,
    @Req() request: Request,
  ) {
    return this.processService.updateResponsibilities(ctx, id, dto, this.metadata(request));
  }

  @Get(':id/documents')
  documents(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.processService.listRelation(ctx, id, 'documents');
  }

  @Post(':id/documents')
  createDocument(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: DocumentDto,
    @Req() request: Request,
  ) {
    return this.processService.createRelation(ctx, id, 'documents', dto, this.metadata(request));
  }

  @Patch(':id/documents/:relationId')
  updateDocument(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('relationId') relationId: string,
    @Body() dto: DocumentDto,
  ) {
    return this.processService.updateRelation(ctx, id, 'documents', relationId, dto);
  }

  @Delete(':id/documents/:relationId')
  @HttpCode(204)
  deleteDocument(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('relationId') relationId: string,
  ) {
    return this.processService.deleteRelation(ctx, id, 'documents', relationId);
  }

  @Get(':id/applications')
  applications(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.processService.listRelation(ctx, id, 'applications');
  }

  @Post(':id/applications')
  createApplication(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: ApplicationDto,
    @Req() request: Request,
  ) {
    return this.processService.createRelation(ctx, id, 'applications', dto, this.metadata(request));
  }

  @Patch(':id/applications/:relationId')
  updateApplication(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('relationId') relationId: string,
    @Body() dto: ApplicationDto,
  ) {
    return this.processService.updateRelation(ctx, id, 'applications', relationId, dto);
  }

  @Delete(':id/applications/:relationId')
  @HttpCode(204)
  deleteApplication(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('relationId') relationId: string,
  ) {
    return this.processService.deleteRelation(ctx, id, 'applications', relationId);
  }

  @Get(':id/:kind(kpis|risks|pain-points|automation-needs)')
  listRelation(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('kind') kind: RelationKind,
  ) {
    return this.processService.listRelation(ctx, id, kind);
  }

  @Post(':id/kpis')
  createKpi(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: KpiDto,
    @Req() request: Request,
  ) {
    return this.processService.createRelation(ctx, id, 'kpis', dto, this.metadata(request));
  }

  @Post(':id/risks')
  createRisk(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: RiskDto,
    @Req() request: Request,
  ) {
    return this.processService.createRelation(ctx, id, 'risks', dto, this.metadata(request));
  }

  @Post(':id/pain-points')
  createPainPoint(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: PainPointDto,
    @Req() request: Request,
  ) {
    return this.processService.createRelation(ctx, id, 'pain-points', dto, this.metadata(request));
  }

  @Post(':id/automation-needs')
  createAutomationNeed(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: AutomationNeedDto,
    @Req() request: Request,
  ) {
    return this.processService.createRelation(
      ctx,
      id,
      'automation-needs',
      dto,
      this.metadata(request),
    );
  }

  @Patch(':id/:kind(kpis|risks|pain-points|automation-needs)/:relationId')
  updateRelation(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('kind') kind: RelationKind,
    @Param('relationId') relationId: string,
    @Body() dto: KpiDto | RiskDto | PainPointDto | AutomationNeedDto,
  ) {
    return this.processService.updateRelation(ctx, id, kind, relationId, dto);
  }

  @Delete(':id/:kind(kpis|risks|pain-points|automation-needs)/:relationId')
  @HttpCode(204)
  deleteRelation(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('kind') kind: RelationKind,
    @Param('relationId') relationId: string,
  ) {
    return this.processService.deleteRelation(ctx, id, kind, relationId);
  }

  @Post(':id/risks/:riskId/controls')
  createControl(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('riskId') riskId: string,
    @Body() dto: ControlDto,
    @Req() request: Request,
  ) {
    return this.processService.createControl(ctx, id, riskId, dto, this.metadata(request));
  }

  @Patch(':id/controls/:controlId')
  updateControl(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('controlId') controlId: string,
    @Body() dto: ControlDto,
  ) {
    return this.processService.updateControl(ctx, id, controlId, dto);
  }

  @Delete(':id/controls/:controlId')
  @HttpCode(204)
  deleteControl(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('controlId') controlId: string,
  ) {
    return this.processService.deleteControl(ctx, id, controlId);
  }

  private metadata(request: Request): RequestMetadata {
    return {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };
  }
}
