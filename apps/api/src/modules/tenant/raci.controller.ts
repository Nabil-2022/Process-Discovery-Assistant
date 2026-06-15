import { Body, Controller, Get, Header, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { RequestMetadata } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentTenantContext } from './decorators/tenant-context.decorator';
import { RaciValidationDto, UpdateRaciResponsibilitiesDto } from './dto/raci.dto';
import { TenantAccessContext, TenantAccessGuard } from './guards/tenant-access.guard';
import { RaciService } from './services/raci.service';

@ApiTags('tenant-raci')
@ApiBearerAuth()
@Controller('tenant/processes')
@UseGuards(JwtAuthGuard, TenantAccessGuard)
export class RaciController {
  constructor(private readonly raciService: RaciService) {}

  @Get(':id/raci')
  get(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.raciService.getRaci(ctx, id);
  }

  @Post(':id/raci/generate')
  generate(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.raciService.generate(ctx, id, this.metadata(request));
  }

  @Post(':id/raci/recalculate')
  recalculate(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.raciService.recalculate(ctx, id, this.metadata(request));
  }

  @Put(':id/raci/responsibilities')
  updateResponsibilities(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: UpdateRaciResponsibilitiesDto,
    @Req() request: Request,
  ) {
    return this.raciService.updateResponsibilities(ctx, id, dto, this.metadata(request));
  }

  @Post(':id/raci/validate')
  validate(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: RaciValidationDto,
    @Req() request: Request,
  ) {
    return this.raciService.validate(ctx, id, dto, this.metadata(request));
  }

  @Post(':id/raci/invalidate')
  invalidate(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: RaciValidationDto,
    @Req() request: Request,
  ) {
    return this.raciService.invalidate(ctx, id, dto, this.metadata(request));
  }

  @Get(':id/raci/issues')
  issues(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.raciService.issues(ctx, id);
  }

  @Get(':id/raci/history')
  history(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.raciService.history(ctx, id);
  }

  @Get(':id/raci/versions')
  versions(@CurrentTenantContext() ctx: TenantAccessContext, @Param('id') id: string) {
    return this.raciService.versions(ctx, id);
  }

  @Get(':id/raci/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  exportCsv(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.raciService.exportCsv(ctx, id, this.metadata(request));
  }

  private metadata(request: Request): RequestMetadata {
    return {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    };
  }
}
