import {
  Body,
  Controller,
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

import { AuthenticatedRequestUser } from '../auth/auth.types';
import { CurrentUser, GlobalRoles, RequirePermissions } from '../auth/decorators/auth.decorators';
import { AuthPolicyGuard } from '../auth/guards/auth-policy.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AdminAuditQueryDto,
  ApplyTemplateDto,
  CreateSupportAccessGrantDto,
  CreateTenantDto,
  InitialTenantAdminDto,
  ListTenantsQueryDto,
  ReasonDto,
  RevokeSupportAccessGrantDto,
  UpdateSubscriptionDto,
  UpdateTenantDto,
  UpdateTenantFeaturesDto,
} from './dto/admin.dto';
import { AdminService } from './services/admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, AuthPolicyGuard)
@GlobalRoles('super_admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('tenants')
  @RequirePermissions('manage_tenants')
  listTenants(@Query() query: ListTenantsQueryDto) {
    return this.adminService.listTenants(query);
  }

  @Get('tenants/:id')
  @RequirePermissions('manage_tenants')
  getTenant(@Param('id') id: string) {
    return this.adminService.getTenant(id);
  }

  @Post('tenants')
  @RequirePermissions('manage_tenants')
  createTenant(
    @Body() dto: CreateTenantDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: Request,
  ) {
    return this.adminService.createTenant(dto, user.sub, this.metadata(request));
  }

  @Patch('tenants/:id')
  @RequirePermissions('manage_tenants')
  updateTenant(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: Request,
  ) {
    return this.adminService.updateTenant(id, dto, user.sub, this.metadata(request));
  }

  @Post('tenants/:id/suspend')
  @HttpCode(204)
  @RequirePermissions('manage_tenants')
  suspendTenant(
    @Param('id') id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: Request,
  ) {
    return this.adminService.suspendTenant(id, dto, user.sub, this.metadata(request));
  }

  @Post('tenants/:id/reactivate')
  @HttpCode(204)
  @RequirePermissions('manage_tenants')
  reactivateTenant(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: Request,
  ) {
    return this.adminService.reactivateTenant(id, user.sub, this.metadata(request));
  }

  @Get('tenants/:id/summary')
  @RequirePermissions('manage_tenants')
  getTenantSummary(@Param('id') id: string) {
    return this.adminService.getTenantSummary(id);
  }

  @Post('tenants/:id/initial-admin')
  @RequirePermissions('manage_tenants')
  createInitialAdmin(
    @Param('id') id: string,
    @Body() dto: InitialTenantAdminDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: Request,
  ) {
    return this.adminService.createInitialAdmin(id, dto, user.sub, this.metadata(request));
  }

  @Get('templates')
  @RequirePermissions('manage_templates')
  listTemplates() {
    return this.adminService.listTemplates();
  }

  @Get('templates/:id')
  @RequirePermissions('manage_templates')
  getTemplate(@Param('id') id: string) {
    return this.adminService.getTemplate(id);
  }

  @Post('tenants/:id/apply-template')
  @RequirePermissions('manage_templates')
  applyTemplate(
    @Param('id') id: string,
    @Body() dto: ApplyTemplateDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: Request,
  ) {
    return this.adminService.applyTemplate(id, dto, user.sub, this.metadata(request));
  }

  @Get('features')
  @RequirePermissions('manage_tenants')
  listFeatures() {
    return this.adminService.listFeatures();
  }

  @Get('tenants/:id/features')
  @RequirePermissions('manage_tenants')
  getTenantFeatures(@Param('id') id: string) {
    return this.adminService.getTenantFeatures(id);
  }

  @Put('tenants/:id/features')
  @RequirePermissions('manage_tenants')
  updateTenantFeatures(
    @Param('id') id: string,
    @Body() dto: UpdateTenantFeaturesDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: Request,
  ) {
    return this.adminService.updateTenantFeatures(id, dto, user.sub, this.metadata(request));
  }

  @Get('tenants/:id/subscription')
  @RequirePermissions('manage_tenants')
  getSubscription(@Param('id') id: string) {
    return this.adminService.getSubscription(id);
  }

  @Put('tenants/:id/subscription')
  @RequirePermissions('manage_tenants')
  updateSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: Request,
  ) {
    return this.adminService.updateSubscription(id, dto, user.sub, this.metadata(request));
  }

  @Get('support-access-grants')
  @RequirePermissions('manage_support_grants')
  listSupportAccessGrants() {
    return this.adminService.listSupportAccessGrants();
  }

  @Post('support-access-grants')
  @RequirePermissions('manage_support_grants')
  createSupportAccessGrant(
    @Body() dto: CreateSupportAccessGrantDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: Request,
  ) {
    return this.adminService.createSupportAccessGrant(dto, user.sub, this.metadata(request));
  }

  @Post('support-access-grants/:id/revoke')
  @HttpCode(204)
  @RequirePermissions('manage_support_grants')
  revokeSupportAccessGrant(
    @Param('id') id: string,
    @Body() dto: RevokeSupportAccessGrantDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: Request,
  ) {
    return this.adminService.revokeSupportAccessGrant(id, dto, user.sub, this.metadata(request));
  }

  @Get('dashboard/summary')
  @RequirePermissions('manage_platform')
  dashboardSummary() {
    return this.adminService.dashboardSummary();
  }

  @Get('dashboard/tenants-attention')
  @RequirePermissions('manage_platform')
  tenantsAttention() {
    return this.adminService.tenantsAttention();
  }

  @Get('dashboard/recent-activity')
  @RequirePermissions('manage_platform')
  recentActivity() {
    return this.adminService.recentActivity();
  }

  @Get('dashboard/campaigns-overview')
  @RequirePermissions('manage_platform')
  campaignsOverview() {
    return this.adminService.campaignsOverview();
  }

  @Get('audit-logs')
  @RequirePermissions('view_sensitive_audit')
  auditLogs(
    @Query() query: AdminAuditQueryDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: Request,
  ) {
    return this.adminService.auditLogs(query, user.sub, this.metadata(request));
  }

  private metadata(request: Request) {
    return {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };
  }
}
