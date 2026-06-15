import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { RequestMetadata } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentTenantContext } from './decorators/tenant-context.decorator';
import { AiApplySuggestionDto, AiGenerateDto, AiModifySuggestionDto } from './dto/ai.dto';
import { TenantAccessContext, TenantAccessGuard } from './guards/tenant-access.guard';
import { TenantAiService } from './services/ai.service';

@ApiTags('tenant-ai')
@ApiBearerAuth()
@Controller('tenant/processes/:id/ai')
@UseGuards(JwtAuthGuard, TenantAccessGuard)
export class AiController {
  constructor(private readonly aiService: TenantAiService) {}

  @Post('generate')
  generate(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: AiGenerateDto,
    @Req() request: Request,
  ) {
    return this.aiService.generate(ctx, id, dto, this.metadata(request));
  }

  @Get('generations')
  generations(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.aiService.generations(ctx, id);
  }

  @Get('generations/:generationId')
  generation(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('generationId') generationId: string,
  ) {
    return this.aiService.generation(ctx, id, generationId);
  }

  @Get('suggestions')
  suggestions(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.aiService.suggestions(ctx, id);
  }

  @Post('suggestions/:suggestionId/accept')
  accept(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('suggestionId') suggestionId: string,
    @Req() request: Request,
  ) {
    return this.aiService.accept(ctx, id, suggestionId, this.metadata(request));
  }

  @Post('suggestions/:suggestionId/reject')
  reject(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('suggestionId') suggestionId: string,
    @Req() request: Request,
  ) {
    return this.aiService.reject(ctx, id, suggestionId, this.metadata(request));
  }

  @Post('suggestions/:suggestionId/modify')
  modify(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('suggestionId') suggestionId: string,
    @Body() dto: AiModifySuggestionDto,
    @Req() request: Request,
  ) {
    return this.aiService.modify(ctx, id, suggestionId, dto, this.metadata(request));
  }

  @Post('suggestions/:suggestionId/validate')
  validate(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('suggestionId') suggestionId: string,
    @Req() request: Request,
  ) {
    return this.aiService.validate(ctx, id, suggestionId, this.metadata(request));
  }

  @Post('suggestions/:suggestionId/create-kpi')
  createKpi(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('suggestionId') suggestionId: string,
    @Body() dto: AiApplySuggestionDto,
    @Req() request: Request,
  ) {
    return this.aiService.createKpi(ctx, id, suggestionId, dto, this.metadata(request));
  }

  @Post('suggestions/:suggestionId/create-risk')
  createRisk(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('suggestionId') suggestionId: string,
    @Req() request: Request,
  ) {
    return this.aiService.createRisk(ctx, id, suggestionId, this.metadata(request));
  }

  @Post('suggestions/:suggestionId/create-control')
  createControl(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('suggestionId') suggestionId: string,
    @Req() request: Request,
  ) {
    return this.aiService.createControl(ctx, id, suggestionId, this.metadata(request));
  }

  @Post('suggestions/:suggestionId/create-backlog-item')
  createBacklogItem(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('suggestionId') suggestionId: string,
    @Req() request: Request,
  ) {
    return this.aiService.createBacklogItem(ctx, id, suggestionId, this.metadata(request));
  }

  @Post('suggestions/:suggestionId/insert-procedure-draft')
  insertProcedureDraft(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Param('suggestionId') suggestionId: string,
    @Req() request: Request,
  ) {
    return this.aiService.insertProcedureDraft(ctx, id, suggestionId, this.metadata(request));
  }

  private metadata(request: Request): RequestMetadata {
    return { ip: request.ip, userAgent: request.headers['user-agent'] };
  }
}
