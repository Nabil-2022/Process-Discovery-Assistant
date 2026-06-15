import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { RequestMetadata } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentTenantContext } from './decorators/tenant-context.decorator';
import {
  ProcedureSectionUpdateDto,
  ProcedureTransitionDto,
  ProcedureUpdateDto,
} from './dto/procedure.dto';
import { TenantAccessContext, TenantAccessGuard } from './guards/tenant-access.guard';
import { ProcedureService } from './services/procedure.service';

@ApiTags('tenant-procedure')
@ApiBearerAuth()
@Controller('tenant/processes/:id/procedure')
@UseGuards(JwtAuthGuard, TenantAccessGuard)
export class ProcedureController {
  constructor(private readonly procedureService: ProcedureService) {}

  @Get()
  current(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.procedureService.current(ctx, id, this.metadata(request));
  }

  @Post('generate')
  generate(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.procedureService.generate(ctx, id, this.metadata(request));
  }

  @Patch()
  update(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: ProcedureUpdateDto,
    @Req() request: Request,
  ) {
    return this.procedureService.update(ctx, id, dto, this.metadata(request));
  }

  @Patch('sections/:sectionId')
  updateSection(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: ProcedureSectionUpdateDto,
    @Req() request: Request,
  ) {
    return this.procedureService.updateSection(ctx, id, sectionId, dto, this.metadata(request));
  }

  @Post('submit-review')
  submitReview(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.procedureService.submitReview(ctx, id, this.metadata(request));
  }

  @Post('request-changes')
  requestChanges(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: ProcedureTransitionDto,
    @Req() request: Request,
  ) {
    return this.procedureService.requestChanges(ctx, id, dto, this.metadata(request));
  }

  @Post('approve')
  approve(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: ProcedureTransitionDto,
    @Req() request: Request,
  ) {
    return this.procedureService.approve(ctx, id, dto, this.metadata(request));
  }

  @Post('publish')
  publish(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: ProcedureTransitionDto,
    @Req() request: Request,
  ) {
    return this.procedureService.publish(ctx, id, dto, this.metadata(request));
  }

  @Post('archive')
  archive(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: ProcedureTransitionDto,
    @Req() request: Request,
  ) {
    return this.procedureService.archive(ctx, id, dto, this.metadata(request));
  }

  @Get('versions')
  versions(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.procedureService.versions(ctx, id);
  }

  @Get('versions/:versionId')
  version(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.procedureService.version(ctx, id, versionId);
  }

  @Get('diff')
  diff(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.procedureService.diff(ctx, id);
  }

  @Post('generate-ai-draft')
  generateAiDraft(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.procedureService.generateAiDraft(ctx, id, this.metadata(request));
  }

  private metadata(request: Request): RequestMetadata {
    return { ip: request.ip, userAgent: request.headers['user-agent'] };
  }
}
