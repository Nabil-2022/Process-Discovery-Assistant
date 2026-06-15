import { ForbiddenException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';

import {
  NotificationStatus,
  NotificationType,
  Prisma,
  TaskItemPriority,
  TaskItemStatus,
} from '../../../generated/prisma';
import { RequestMetadata } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ActivityQueryDto,
  AuditQueryDto,
  CreateTaskDto,
  ListNotificationsQueryDto,
  ListTasksQueryDto,
  notificationTypes,
  UpdateNotificationPreferencesDto,
  UpdateTaskDto,
} from '../dto/activity.dto';
import { TenantAccessContext } from '../guards/tenant-access.guard';

type NotificationPayload = {
  recipientUserId: string;
  recipientMembershipId?: string;
  type: keyof typeof NotificationType;
  title: string;
  message?: string;
  severity?: string;
  actionUrl?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonObject;
  expiresAt?: Date;
};

const SENSITIVE_KEYS = [
  'password',
  'hash',
  'token',
  'cookie',
  'secret',
  'api_key',
  'apikey',
  'database_url',
  'storage_secret',
  'jwt',
];

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(ctx: TenantAccessContext, payload: NotificationPayload) {
    const notification = await this.prisma.notification.create({
      data: {
        tenantId: ctx.tenantId,
        userId: payload.recipientUserId,
        recipientMembershipId: payload.recipientMembershipId,
        type: payload.type,
        title: payload.title,
        body: payload.message,
        severity: payload.severity ?? 'info',
        actionUrl: payload.actionUrl,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
        metadata: payload.metadata,
        expiresAt: payload.expiresAt,
      },
    });
    return this.serializeNotification(notification);
  }

  async listNotifications(ctx: TenantAccessContext, query: ListNotificationsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const where: Prisma.NotificationWhereInput = {
      tenantId: ctx.tenantId,
      userId: ctx.actorUserId,
      ...(query.status ? { status: this.notificationStatus(query.status) } : {}),
      ...(query.type ? { type: this.notificationType(query.type) } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      page,
      page_size: pageSize,
      total,
      items: items.map((item) => this.serializeNotification(item)),
    };
  }

  async unreadCount(ctx: TenantAccessContext) {
    const count = await this.prisma.notification.count({
      where: { tenantId: ctx.tenantId, userId: ctx.actorUserId, status: NotificationStatus.UNREAD },
    });
    return { unread_count: count };
  }

  async markRead(ctx: TenantAccessContext, id: string, metadata: RequestMetadata) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, tenantId: ctx.tenantId, userId: ctx.actorUserId },
    });
    if (!notification) throw new NotFoundException('Notification introuvable.');
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
    await this.audit(ctx, 'notification_read', 'notifications', id, {}, metadata);
    return this.serializeNotification(updated);
  }

  async markAllRead(ctx: TenantAccessContext, metadata: RequestMetadata) {
    const result = await this.prisma.notification.updateMany({
      where: { tenantId: ctx.tenantId, userId: ctx.actorUserId, status: NotificationStatus.UNREAD },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
    await this.audit(
      ctx,
      'notification_read_all',
      'notifications',
      null,
      { count: result.count },
      metadata,
    );
    return { updated: result.count };
  }

  async deleteNotification(ctx: TenantAccessContext, id: string, metadata: RequestMetadata) {
    const result = await this.prisma.notification.deleteMany({
      where: { id, tenantId: ctx.tenantId, userId: ctx.actorUserId },
    });
    if (!result.count) throw new NotFoundException('Notification introuvable.');
    await this.audit(ctx, 'notification_deleted', 'notifications', id, {}, metadata);
  }

  async preferences(ctx: TenantAccessContext) {
    const rows = await this.prisma.notificationPreference.findMany({
      where: { tenantId: ctx.tenantId, userId: ctx.actorUserId },
      orderBy: [{ channel: 'asc' }, { type: 'asc' }],
    });
    const first = rows[0];
    return {
      in_app_enabled: rows.some((row) => row.channel === 'in_app' && row.enabled),
      email_enabled: rows.some((row) => row.channel === 'email' && row.enabled),
      frequency: first?.frequency ?? 'immediate',
      language: first?.language ?? 'fr',
      quiet_hours_start: first?.quietHoursStart ?? null,
      quiet_hours_end: first?.quietHoursEnd ?? null,
      disabled_types: rows
        .filter((row) => !row.enabled)
        .map((row) => this.externalNotificationType(row.type)),
      channels: rows,
    };
  }

  async updatePreferences(
    ctx: TenantAccessContext,
    dto: UpdateNotificationPreferencesDto,
    metadata: RequestMetadata,
  ) {
    const disabled = new Set(dto.disabled_types ?? []);
    for (const externalType of notificationTypes) {
      const type = this.notificationType(externalType);
      await this.upsertPreference(
        ctx,
        'in_app',
        type,
        dto.in_app_enabled !== false && !disabled.has(externalType),
        dto,
      );
      await this.upsertPreference(
        ctx,
        'email',
        type,
        dto.email_enabled === true && !disabled.has(externalType),
        dto,
      );
    }
    await this.audit(
      ctx,
      'notification_preferences_updated',
      'notification_preferences',
      null,
      {},
      metadata,
    );
    return this.preferences(ctx);
  }

  async activity(ctx: TenantAccessContext, query: ActivityQueryDto, metadata: RequestMetadata) {
    this.assertCanReadBusiness(ctx);
    const where = await this.auditWhere(ctx, query);
    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    await this.audit(ctx, 'activity_viewed', 'audit_logs', null, { count: logs.length }, metadata);
    return logs.map((log) => this.serializeAudit(log));
  }

  async auditLogs(ctx: TenantAccessContext, query: AuditQueryDto, metadata: RequestMetadata) {
    this.assertCanReadAudit(ctx);
    const where = await this.auditWhere(ctx, query);
    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    await this.audit(ctx, 'audit_viewed', 'audit_logs', null, { count: logs.length }, metadata);
    return logs.map((log) => this.serializeAudit(log));
  }

  async auditLog(ctx: TenantAccessContext, id: string, metadata: RequestMetadata) {
    this.assertCanReadAudit(ctx);
    const log = await this.prisma.auditLog.findFirst({
      where: { id, ...(await this.auditWhere(ctx, {})) },
    });
    if (!log) throw new NotFoundException('Audit introuvable.');
    await this.audit(ctx, 'audit_viewed', 'audit_logs', id, {}, metadata);
    return this.serializeAudit(log);
  }

  async auditCsv(ctx: TenantAccessContext, query: AuditQueryDto, metadata: RequestMetadata) {
    const logs = await this.auditLogs(ctx, query, metadata);
    const rows = [
      [
        'id',
        'created_at',
        'actor_user_id',
        'action',
        'resource_type',
        'resource_id',
        'result',
      ].join(','),
      ...logs.map((log) =>
        [
          this.csv(log.id),
          this.csv(log.created_at),
          this.csv(log.actor_user_id ?? ''),
          this.csv(log.action),
          this.csv(log.resource_type),
          this.csv(log.resource_id ?? ''),
          this.csv(log.result),
        ].join(','),
      ),
    ];
    await this.audit(ctx, 'audit_exported', 'audit_logs', null, { count: logs.length }, metadata);
    return new StreamableFile(Buffer.from(rows.join('\n'), 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="tenant-audit.csv"',
    });
  }

  async listTasks(ctx: TenantAccessContext, query: ListTasksQueryDto) {
    const where: Prisma.TaskItemWhereInput = {
      tenantId: ctx.tenantId,
      ...(query.status ? { status: this.taskStatus(query.status) } : {}),
      ...(query.direction_id ? { directionId: query.direction_id } : {}),
      ...(query.process_id ? { processId: query.process_id } : {}),
      ...this.taskScope(ctx),
    };
    const tasks = await this.prisma.taskItem.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return tasks.map((task) => this.serializeTask(task));
  }

  async createTask(ctx: TenantAccessContext, dto: CreateTaskDto, metadata: RequestMetadata) {
    this.assertCanCreateTask(ctx);
    if (dto.direction_id) this.assertDirectionScope(ctx, dto.direction_id);
    const task = await this.prisma.taskItem.create({
      data: {
        tenantId: ctx.tenantId,
        assignedToUserId: dto.assigned_to_user_id ?? ctx.actorUserId,
        assignedToMembershipId: dto.assigned_to_membership_id,
        createdBy: ctx.actorUserId,
        title: dto.title,
        description: dto.description,
        priority: this.taskPriority(dto.priority),
        dueDate: dto.due_date ? new Date(dto.due_date) : undefined,
        directionId: dto.direction_id,
        processId: dto.process_id,
        resourceType: dto.resource_type,
        resourceId: dto.resource_id,
        actionUrl: dto.action_url,
      },
    });
    await this.audit(ctx, 'task_created', 'task_items', task.id, { title: task.title }, metadata);
    if (task.assignedToUserId) {
      await this.createNotification(ctx, {
        recipientUserId: task.assignedToUserId,
        recipientMembershipId: task.assignedToMembershipId ?? undefined,
        type: 'DIRECTION_ASSIGNED',
        title: 'Nouvelle tache',
        message: task.title,
        severity: task.priority === TaskItemPriority.CRITICAL ? 'critical' : 'info',
        actionUrl: task.actionUrl ?? '/tenant/my-actions',
        resourceType: 'task_items',
        resourceId: task.id,
      });
    }
    return this.serializeTask(task);
  }

  async updateTask(
    ctx: TenantAccessContext,
    id: string,
    dto: UpdateTaskDto,
    metadata: RequestMetadata,
  ) {
    const task = await this.ensureTask(ctx, id);
    this.assertCanMutateTask(ctx, task);
    const updated = await this.prisma.taskItem.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status ? this.taskStatus(dto.status) : undefined,
        priority: dto.priority ? this.taskPriority(dto.priority) : undefined,
        dueDate: dto.due_date ? new Date(dto.due_date) : undefined,
        completedAt: dto.status === 'completed' ? new Date() : undefined,
      },
    });
    await this.audit(ctx, 'task_updated', 'task_items', id, {}, metadata);
    return this.serializeTask(updated);
  }

  async completeTask(ctx: TenantAccessContext, id: string, metadata: RequestMetadata) {
    const task = await this.ensureTask(ctx, id);
    this.assertCanMutateTask(ctx, task);
    const updated = await this.prisma.taskItem.update({
      where: { id },
      data: { status: TaskItemStatus.COMPLETED, completedAt: new Date() },
    });
    await this.audit(ctx, 'task_completed', 'task_items', id, {}, metadata);
    return this.serializeTask(updated);
  }

  async deleteTask(ctx: TenantAccessContext, id: string, metadata: RequestMetadata) {
    const task = await this.ensureTask(ctx, id);
    this.assertCanMutateTask(ctx, task);
    await this.prisma.taskItem.delete({ where: { id } });
    await this.audit(ctx, 'task_deleted', 'task_items', id, {}, metadata);
  }

  async myActions(ctx: TenantAccessContext) {
    const [tasks, notifications, exportsReady, processes] = await Promise.all([
      this.listTasks(ctx, { status: 'open' }),
      this.listNotifications(ctx, { status: 'unread', page_size: 10 }),
      this.prisma.exportJob.findMany({
        where: { tenantId: ctx.tenantId, requestedBy: ctx.actorUserId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        take: 10,
      }),
      this.prisma.process.findMany({
        where: {
          tenantId: ctx.tenantId,
          deletedAt: null,
          status: { in: ['DRAFT', 'CHANGES_REQUESTED'] },
          ...this.processScope(ctx),
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: { id: true, name: true, status: true, completenessScore: true },
      }),
    ]);
    return {
      tasks,
      notifications: notifications.items,
      exports_ready: exportsReady,
      processes_to_complete: processes,
    };
  }

  private async upsertPreference(
    ctx: TenantAccessContext,
    channel: string,
    type: NotificationType,
    enabled: boolean,
    dto: UpdateNotificationPreferencesDto,
  ) {
    await this.prisma.notificationPreference.upsert({
      where: {
        tenantId_userId_channel_type: {
          tenantId: ctx.tenantId,
          userId: ctx.actorUserId,
          channel,
          type,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        userId: ctx.actorUserId,
        channel,
        type,
        enabled,
        frequency: dto.frequency ?? 'immediate',
        language: dto.language ?? 'fr',
        quietHoursStart: dto.quiet_hours_start,
        quietHoursEnd: dto.quiet_hours_end,
      },
      update: {
        enabled,
        frequency: dto.frequency,
        language: dto.language,
        quietHoursStart: dto.quiet_hours_start,
        quietHoursEnd: dto.quiet_hours_end,
      },
    });
  }

  private async auditWhere(ctx: TenantAccessContext, query: AuditQueryDto | ActivityQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      tenantId: ctx.tenantId,
      ...(query.user_id ? { actorUserId: query.user_id } : {}),
      ...(query.date_from || query.date_to
        ? {
            createdAt: {
              ...(query.date_from ? { gte: new Date(query.date_from) } : {}),
              ...(query.date_to ? { lte: new Date(query.date_to) } : {}),
            },
          }
        : {}),
    };
    if ('action' in query && query.action) where.action = query.action;
    if ('resource_type' in query && query.resource_type) where.resourceType = query.resource_type;
    if ('resource_id' in query && query.resource_id) where.resourceId = query.resource_id;
    if ('result' in query && query.result) where.result = query.result;
    if ('correlation_id' in query && query.correlation_id)
      where.correlationId = query.correlation_id;
    if (query.process_id)
      where.OR = [
        { resourceId: query.process_id },
        { metadata: { path: ['processId'], equals: query.process_id } },
      ];
    if (query.direction_id) {
      this.assertDirectionScope(ctx, query.direction_id);
      where.OR = [
        { resourceId: query.direction_id },
        { metadata: { path: ['direction_id'], equals: query.direction_id } },
      ];
    }
    if (!this.hasTenantWideRead(ctx) && !query.direction_id) {
      where.OR = ctx.directionIds.flatMap((id) => [
        { resourceId: id },
        { metadata: { path: ['direction_id'], equals: id } },
      ]);
    }
    return where;
  }

  private async ensureTask(ctx: TenantAccessContext, id: string) {
    const task = await this.prisma.taskItem.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!task) throw new NotFoundException('Tache introuvable.');
    if (task.directionId) this.assertDirectionScope(ctx, task.directionId);
    return task;
  }

  private taskScope(ctx: TenantAccessContext): Prisma.TaskItemWhereInput {
    if (this.hasTenantWideRead(ctx)) return {};
    const personal: Prisma.TaskItemWhereInput = {
      OR: [
        { assignedToUserId: ctx.actorUserId },
        ...(ctx.membershipId ? [{ assignedToMembershipId: ctx.membershipId }] : []),
        ...ctx.directionIds.map((directionId) => ({ directionId })),
      ],
    };
    return personal;
  }

  private processScope(ctx: TenantAccessContext): Prisma.ProcessWhereInput {
    if (this.hasTenantWideRead(ctx)) return {};
    return { directionId: { in: ctx.directionIds } };
  }

  private assertCanReadBusiness(ctx: TenantAccessContext) {
    if (ctx.isSupportAccess && ctx.permissions.includes('support_read')) return;
    if (ctx.tenantRoles.length) return;
    throw new ForbiddenException('Acces activite refuse.');
  }

  private assertCanReadAudit(ctx: TenantAccessContext) {
    if (ctx.isSupportAccess && ctx.permissions.includes('support_read')) return;
    if (ctx.tenantRoles.includes('tenant_admin')) return;
    if (ctx.tenantRoles.includes('validator')) return;
    throw new ForbiddenException('Acces audit refuse.');
  }

  private assertCanCreateTask(ctx: TenantAccessContext) {
    if (ctx.tenantRoles.includes('tenant_admin') || ctx.permissions.includes('manage_directions'))
      return;
    throw new ForbiddenException('Creation de tache refusee.');
  }

  private assertCanMutateTask(
    ctx: TenantAccessContext,
    task: { assignedToUserId: string | null; createdBy: string | null },
  ) {
    if (
      ctx.tenantRoles.includes('tenant_admin') ||
      ctx.actorUserId === task.assignedToUserId ||
      ctx.actorUserId === task.createdBy
    )
      return;
    throw new ForbiddenException('Modification de tache refusee.');
  }

  private assertDirectionScope(ctx: TenantAccessContext, directionId: string) {
    if (this.hasTenantWideRead(ctx)) return;
    if (ctx.directionIds.includes(directionId)) return;
    throw new ForbiddenException('Perimetre direction refuse.');
  }

  private hasTenantWideRead(ctx: TenantAccessContext) {
    return ctx.isSupportAccess || ctx.tenantRoles.includes('tenant_admin');
  }

  private notificationType(value: string): NotificationType {
    const key = value.toUpperCase() as keyof typeof NotificationType;
    const aliases: Record<string, NotificationType> = {
      PROCESS_READY_FOR_REVIEW: NotificationType.PROCESS_READY_FOR_REVIEW,
      PROCESS_SUBMITTED: NotificationType.PROCESS_SUBMITTED,
      EXPORT_COMPLETED: NotificationType.EXPORT_COMPLETED,
      EXPORT_FAILED: NotificationType.EXPORT_FAILED,
      AI_SUGGESTION_AVAILABLE: NotificationType.AI_SUGGESTION_AVAILABLE,
      PROCESS_INCOMPLETE: NotificationType.PROCESS_INCOMPLETE,
      CHANGES_REQUESTED: NotificationType.CHANGES_REQUESTED,
    };
    return aliases[key] ?? NotificationType[key] ?? NotificationType.PROCESS_INCOMPLETE;
  }

  private externalNotificationType(value: NotificationType) {
    return value.toLowerCase();
  }

  private notificationStatus(value: string) {
    return value.toUpperCase() as NotificationStatus;
  }

  private taskStatus(value: string) {
    return value.toUpperCase() as TaskItemStatus;
  }

  private taskPriority(value?: string) {
    return (value?.toUpperCase() ?? 'MEDIUM') as TaskItemPriority;
  }

  private serializeNotification(notification: Prisma.NotificationGetPayload<object>) {
    return {
      id: notification.id,
      tenant_id: notification.tenantId,
      recipient_user_id: notification.userId,
      recipient_membership_id: notification.recipientMembershipId,
      type: this.externalNotificationType(notification.type),
      title: notification.title,
      message: notification.body,
      severity: notification.severity,
      status: notification.status.toLowerCase(),
      read_at: notification.readAt,
      action_url: notification.actionUrl,
      resource_type: notification.resourceType,
      resource_id: notification.resourceId,
      metadata: notification.metadata,
      created_at: notification.createdAt,
      expires_at: notification.expiresAt,
    };
  }

  private serializeTask(task: Prisma.TaskItemGetPayload<object>) {
    return {
      id: task.id,
      assigned_to_user_id: task.assignedToUserId,
      assigned_to_membership_id: task.assignedToMembershipId,
      title: task.title,
      description: task.description,
      status: task.status.toLowerCase(),
      priority: task.priority.toLowerCase(),
      due_date: task.dueDate,
      direction_id: task.directionId,
      process_id: task.processId,
      resource_type: task.resourceType,
      resource_id: task.resourceId,
      action_url: task.actionUrl,
      completed_at: task.completedAt,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
    };
  }

  private serializeAudit(log: Prisma.AuditLogGetPayload<object>) {
    return {
      id: log.id,
      tenant_id: log.tenantId,
      actor_user_id: log.actorUserId,
      action: log.action,
      resource_type: log.resourceType,
      resource_id: log.resourceId,
      result: log.result,
      correlation_id: log.correlationId,
      metadata: this.redact(log.metadata),
      old_value: this.redact(log.oldValue),
      new_value: this.redact(log.newValue),
      created_at: log.createdAt,
    };
  }

  private redact(value: unknown): unknown {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        SENSITIVE_KEYS.some((sensitive) => key.toLowerCase().includes(sensitive))
          ? '[REDACTED]'
          : this.redact(entry),
      ]),
    );
  }

  private async audit(
    ctx: TenantAccessContext,
    action: string,
    resourceType: string,
    resourceId: string | null,
    data: Prisma.InputJsonObject,
    metadata: RequestMetadata,
  ) {
    const extendedMetadata = metadata as RequestMetadata & { correlationId?: string };
    await this.prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        actorUserId: ctx.actorUserId,
        supportGrantId: ctx.supportGrantId,
        action,
        resourceType,
        resourceId,
        result: 'success',
        metadata: data,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
        correlationId: extendedMetadata.correlationId,
      },
    });
  }

  private csv(value: unknown) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }
}
