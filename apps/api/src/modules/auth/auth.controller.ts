import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';

import { AUTH_COOKIE_NAME } from './auth.constants';
import { AuthenticatedRequestUser } from './auth.types';
import {
  CurrentUser,
  GlobalRoles,
  Public,
  RequirePermissions,
  TenantRequired,
} from './decorators/auth.decorators';
import {
  AcceptInvitationDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  InviteUserDto,
  LoginDto,
  RefreshDto,
  ResetPasswordDto,
  SelectTenantDto,
} from './dto/auth.dto';
import { AuthPolicyGuard } from './guards/auth-policy.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './services/auth.service';

@ApiTags('auth')
@Controller('auth')
@UseGuards(JwtAuthGuard, AuthPolicyGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Connexion email/mot de passe.' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto, this.metadata(request));
    this.setRefreshCookie(response, result.refresh_token);
    return this.withoutRefreshToken(result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotation du refresh token.' })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.refresh(
      request.cookies?.[AUTH_COOKIE_NAME] ?? dto.refresh_token,
      this.metadata(request),
    );
    this.setRefreshCookie(response, result.refresh_token);
    return this.withoutRefreshToken(result);
  }

  @Post('select-tenant')
  @HttpCode(200)
  @ApiBearerAuth()
  async selectTenant(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: SelectTenantDto,
    @Req() request: Request,
  ) {
    return this.authService.selectTenant(user.sub, user.session_id, dto, this.metadata(request));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Contexte utilisateur courant sans secret.' })
  me(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.authService.me(user.sub, user.session_id, user.active_tenant_id);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  async logout(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(user.sub, user.session_id, this.metadata(request));
    this.clearRefreshCookie(response);
  }

  @Post('logout-all')
  @HttpCode(204)
  @ApiBearerAuth()
  async logoutAll(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logoutAll(user.sub, this.metadata(request));
    this.clearRefreshCookie(response);
  }

  @Post('invitations')
  @TenantRequired()
  @RequirePermissions('manage_users')
  @ApiBearerAuth()
  invite(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: InviteUserDto,
    @Req() request: Request,
  ) {
    if (!user.active_tenant_id || (dto.tenant_id && dto.tenant_id !== user.active_tenant_id)) {
      throw new ForbiddenException('Tenant invalide pour cette invitation.');
    }

    return this.authService.invite(
      { ...dto, tenant_id: user.active_tenant_id },
      user.sub,
      this.metadata(request),
    );
  }

  @Public()
  @Post('accept-invitation')
  @HttpCode(200)
  acceptInvitation(@Body() dto: AcceptInvitationDto, @Req() request: Request) {
    return this.authService.acceptInvitation(dto, this.metadata(request));
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(202)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() request: Request) {
    return this.authService.forgotPassword(dto, this.metadata(request));
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto, @Req() request: Request) {
    return this.authService.resetPassword(dto, this.metadata(request));
  }

  @Post('change-password')
  @HttpCode(200)
  @ApiBearerAuth()
  changePassword(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ) {
    return this.authService.changePassword(user.sub, dto, this.metadata(request));
  }

  @Post('admin/users/:userId/suspend')
  @GlobalRoles('super_admin')
  @HttpCode(204)
  @ApiBearerAuth()
  suspendUser(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: Request,
  ) {
    return this.authService.suspendUser(userId, user.sub, this.metadata(request));
  }

  @Post('admin/memberships/:membershipId/suspend')
  @RequirePermissions('manage_users')
  @HttpCode(204)
  @ApiBearerAuth()
  suspendMembership(
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: Request,
  ) {
    return this.authService.suspendMembership(membershipId, user.sub, this.metadata(request));
  }

  @Post('admin/tenants/:tenantId/suspend')
  @GlobalRoles('super_admin')
  @HttpCode(204)
  @ApiBearerAuth()
  suspendTenant(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() request: Request,
  ) {
    return this.authService.suspendTenant(tenantId, user.sub, this.metadata(request));
  }

  private metadata(request: Request) {
    return {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };
  }

  private setRefreshCookie(response: Response, token: string) {
    response.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.configService.get<boolean>('COOKIE_SECURE', false),
      sameSite: this.configService.get<'lax' | 'strict' | 'none'>('COOKIE_SAME_SITE', 'lax'),
      domain: this.configService.get<string | undefined>('COOKIE_DOMAIN'),
      path: '/api/v1/auth/refresh',
    });
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie(AUTH_COOKIE_NAME, {
      path: '/api/v1/auth/refresh',
      domain: this.configService.get<string | undefined>('COOKIE_DOMAIN'),
    });
  }

  private withoutRefreshToken<T extends { refresh_token?: string }>(result: T) {
    const { refresh_token: _, ...safeResult } = result;
    return safeResult;
  }
}
