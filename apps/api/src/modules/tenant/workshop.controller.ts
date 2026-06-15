import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { RequestMetadata } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentTenantContext } from './decorators/tenant-context.decorator';
import { WorkshopCommentDto, WorkshopCommentUpdateDto } from './dto/workshop.dto';
import { TenantAccessContext, TenantAccessGuard } from './guards/tenant-access.guard';
import { WorkshopService } from './services/workshop.service';

@ApiTags('tenant-workshop')
@ApiBearerAuth()
@Controller('tenant/processes/:id')
@UseGuards(JwtAuthGuard, TenantAccessGuard)
export class WorkshopController {
  constructor(private readonly workshopService: WorkshopService) {}

  @Get('workshop/overview')
  overview(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.workshopService.overview(ctx, id);
  }

  @Get('workshop/quality')
  quality(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.workshopService.quality(ctx, id);
  }

  @Get('workshop/procedure')
  procedure(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.workshopService.procedure(ctx, id, this.metadata(request));
  }

  @Get('workshop/backlog')
  backlog(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.workshopService.backlog(ctx, id, this.metadata(request));
  }

  @Get('workshop/audit')
  audit(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.workshopService.auditLogs(ctx, id, this.metadata(request));
  }

  @Get('workshop/versions')
  versions(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.workshopService.versions(ctx, id);
  }

  @Get('comments')
  comments(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.workshopService.comments(ctx, id);
  }

  @Post('comments')
  createComment(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: WorkshopCommentDto,
    @Req() request: Request,
  ) {
    return this.workshopService.createComment(ctx, id, dto, this.metadata(request));
  }

  @Patch('comments/:commentId')
  updateComment(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() dto: WorkshopCommentUpdateDto,
  ) {
    return this.workshopService.updateComment(ctx, id, commentId, dto);
  }

  @Delete('comments/:commentId')
  deleteComment(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
  ) {
    return this.workshopService.deleteComment(ctx, id, commentId);
  }

  @Post('comments/:commentId/resolve')
  resolveComment(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Req() request: Request,
  ) {
    return this.workshopService.resolveComment(ctx, id, commentId, this.metadata(request));
  }

  private metadata(request: Request): RequestMetadata {
    return {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };
  }
}
