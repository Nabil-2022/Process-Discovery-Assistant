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
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentTenantContext } from './decorators/tenant-context.decorator';
import {
  ActivityQueryDto,
  AuditQueryDto,
  CreateTaskDto,
  ListNotificationsQueryDto,
  ListTasksQueryDto,
  UpdateNotificationPreferencesDto,
  UpdateTaskDto,
} from './dto/activity.dto';
import { TenantAccessContext, TenantAccessGuard } from './guards/tenant-access.guard';
import { ActivityService } from './services/activity.service';

@ApiTags('tenant-activity')
@ApiBearerAuth()
@Controller('tenant')
@UseGuards(JwtAuthGuard, TenantAccessGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('notifications')
  notifications(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.activityService.listNotifications(ctx, query);
  }

  @Get('notifications/unread-count')
  unreadCount(@CurrentTenantContext() ctx: TenantAccessContext) {
    return this.activityService.unreadCount(ctx);
  }

  @Post('notifications/:id/read')
  readNotification(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.activityService.markRead(ctx, id, this.metadata(request));
  }

  @Post('notifications/read-all')
  readAll(@CurrentTenantContext() ctx: TenantAccessContext, @Req() request: Request) {
    return this.activityService.markAllRead(ctx, this.metadata(request));
  }

  @Delete('notifications/:id')
  @HttpCode(204)
  deleteNotification(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.activityService.deleteNotification(ctx, id, this.metadata(request));
  }

  @Get('notification-preferences')
  preferences(@CurrentTenantContext() ctx: TenantAccessContext) {
    return this.activityService.preferences(ctx);
  }

  @Put('notification-preferences')
  updatePreferences(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Body() dto: UpdateNotificationPreferencesDto,
    @Req() request: Request,
  ) {
    return this.activityService.updatePreferences(ctx, dto, this.metadata(request));
  }

  @Get('activity')
  activity(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Query() query: ActivityQueryDto,
    @Req() request: Request,
  ) {
    return this.activityService.activity(ctx, query, this.metadata(request));
  }

  @Get('audit')
  audit(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Query() query: AuditQueryDto,
    @Req() request: Request,
  ) {
    return this.activityService.auditLogs(ctx, query, this.metadata(request));
  }

  @Get('audit/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  auditCsv(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Query() query: AuditQueryDto,
    @Req() request: Request,
  ) {
    return this.activityService.auditCsv(ctx, query, this.metadata(request));
  }

  @Get('audit/:id')
  auditLog(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.activityService.auditLog(ctx, id, this.metadata(request));
  }

  @Get('tasks')
  tasks(@CurrentTenantContext() ctx: TenantAccessContext, @Query() query: ListTasksQueryDto) {
    return this.activityService.listTasks(ctx, query);
  }

  @Post('tasks')
  createTask(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Body() dto: CreateTaskDto,
    @Req() request: Request,
  ) {
    return this.activityService.createTask(ctx, dto, this.metadata(request));
  }

  @Patch('tasks/:id')
  updateTask(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @Req() request: Request,
  ) {
    return this.activityService.updateTask(ctx, id, dto, this.metadata(request));
  }

  @Post('tasks/:id/complete')
  completeTask(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.activityService.completeTask(ctx, id, this.metadata(request));
  }

  @Delete('tasks/:id')
  @HttpCode(204)
  deleteTask(
    @CurrentTenantContext() ctx: TenantAccessContext,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.activityService.deleteTask(ctx, id, this.metadata(request));
  }

  @Get('my-actions')
  myActions(@CurrentTenantContext() ctx: TenantAccessContext) {
    return this.activityService.myActions(ctx);
  }

  private metadata(request: Request) {
    return {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      correlationId: request.headers['x-correlation-id'] as string | undefined,
    };
  }
}
