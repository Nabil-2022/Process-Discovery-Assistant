import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import {
  NotificationStatus,
  NotificationType,
  TaskItemPriority,
  TaskItemStatus,
} from '../../../generated/prisma';
import { TenantAccessContext } from '../guards/tenant-access.guard';
import { ActivityService } from './activity.service';

const metadata = { ip: '127.0.0.1', userAgent: 'vitest', correlationId: 'corr-a' };

function createPrismaMock() {
  return {
    notification: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    notificationPreference: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    taskItem: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    exportJob: { findMany: vi.fn() },
    process: { findMany: vi.fn() },
  };
}

function createService() {
  const prisma = createPrismaMock();
  return { service: new ActivityService(prisma as never), prisma };
}

function tenantAdmin(overrides: Partial<TenantAccessContext> = {}): TenantAccessContext {
  return {
    tenantId: 'tenant-a',
    actorUserId: 'admin-a',
    membershipId: 'membership-a',
    tenantRoles: ['tenant_admin'],
    permissions: ['manage_directions'],
    directionIds: [],
    isSupportAccess: false,
    ...overrides,
  };
}

function readonly(overrides: Partial<TenantAccessContext> = {}): TenantAccessContext {
  return tenantAdmin({
    actorUserId: 'reader-a',
    membershipId: 'membership-reader',
    tenantRoles: ['readonly'],
    permissions: [],
    ...overrides,
  });
}

function directionReferent(overrides: Partial<TenantAccessContext> = {}): TenantAccessContext {
  return tenantAdmin({
    actorUserId: 'referent-a',
    membershipId: 'membership-ref',
    tenantRoles: ['direction_referent'],
    permissions: [],
    directionIds: ['direction-a'],
    ...overrides,
  });
}

function superAdminWithoutGrant(): TenantAccessContext {
  return {
    tenantId: 'tenant-a',
    actorUserId: 'super-a',
    tenantRoles: [],
    permissions: [],
    directionIds: [],
    isSupportAccess: false,
  };
}

function notification(overrides = {}) {
  return {
    id: 'notification-a',
    tenantId: 'tenant-a',
    userId: 'admin-a',
    recipientMembershipId: 'membership-a',
    type: NotificationType.EXPORT_COMPLETED,
    title: 'Export pret',
    body: 'Disponible',
    severity: 'success',
    status: NotificationStatus.UNREAD,
    readAt: null,
    actionUrl: '/tenant/exports',
    resourceType: 'export_jobs',
    resourceId: '11111111-1111-4111-8111-111111111111',
    metadata: {},
    expiresAt: null,
    createdAt: new Date('2026-06-15T10:00:00Z'),
    ...overrides,
  };
}

function task(overrides = {}) {
  return {
    id: 'task-a',
    tenantId: 'tenant-a',
    assignedToUserId: 'admin-a',
    assignedToMembershipId: 'membership-a',
    createdBy: 'admin-a',
    title: 'Completer le processus',
    description: 'Controle',
    status: TaskItemStatus.OPEN,
    priority: TaskItemPriority.MEDIUM,
    dueDate: null,
    directionId: 'direction-a',
    processId: 'process-a',
    resourceType: 'processes',
    resourceId: 'process-a',
    actionUrl: '/tenant/processes/process-a/wizard',
    completedAt: null,
    createdAt: new Date('2026-06-15T10:00:00Z'),
    updatedAt: new Date('2026-06-15T10:00:00Z'),
    ...overrides,
  };
}

function auditLog(overrides = {}) {
  return {
    id: 'audit-a',
    tenantId: 'tenant-a',
    actorUserId: 'admin-a',
    supportGrantId: null,
    action: 'process_submitted',
    resourceType: 'processes',
    resourceId: 'process-a',
    oldValue: { password: 'secret' },
    newValue: { status: 'SUBMITTED', token: 'hidden' },
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    correlationId: 'corr-a',
    result: 'success',
    metadata: { direction_id: 'direction-a', api_key: 'hidden' },
    createdAt: new Date('2026-06-15T10:00:00Z'),
    ...overrides,
  };
}

describe('ActivityService', () => {
  it('creates a notification and lists only the current user notifications', async () => {
    const { service, prisma } = createService();
    prisma.notification.create.mockResolvedValue(notification());
    prisma.notification.count.mockResolvedValue(1);
    prisma.notification.findMany.mockResolvedValue([notification()]);

    await service.createNotification(tenantAdmin(), {
      recipientUserId: 'admin-a',
      type: 'EXPORT_COMPLETED',
      title: 'Export pret',
    });
    const result = await service.listNotifications(tenantAdmin(), {});

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-a', userId: 'admin-a' }),
      }),
    );
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-a', userId: 'admin-a' }),
      }),
    );
    expect(result.items[0]!.type).toBe('export_completed');
  });

  it('marks one notification and all notifications as read with audit', async () => {
    const { service, prisma } = createService();
    prisma.notification.findFirst.mockResolvedValue(notification());
    prisma.notification.update.mockResolvedValue(
      notification({ status: NotificationStatus.READ, readAt: new Date() }),
    );
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });

    await service.markRead(tenantAdmin(), 'notification-a', metadata);
    const all = await service.markAllRead(tenantAdmin(), metadata);

    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: NotificationStatus.READ }),
      }),
    );
    expect(all.updated).toBe(3);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'notification_read_all' }),
      }),
    );
  });

  it('returns unread count and refuses another tenant notification', async () => {
    const { service, prisma } = createService();
    prisma.notification.count.mockResolvedValue(2);
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(service.unreadCount(tenantAdmin())).resolves.toEqual({ unread_count: 2 });
    await expect(
      service.markRead(tenantAdmin(), 'other-notification', metadata),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates notification preferences for in-app and email channels', async () => {
    const { service, prisma } = createService();
    prisma.notificationPreference.findMany.mockResolvedValue([]);
    prisma.notificationPreference.upsert.mockResolvedValue({});

    await service.updatePreferences(
      tenantAdmin(),
      {
        in_app_enabled: true,
        email_enabled: false,
        frequency: 'daily_digest',
        disabled_types: ['export_failed'],
      },
      metadata,
    );

    expect(prisma.notificationPreference.upsert).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'notification_preferences_updated' }),
      }),
    );
  });

  it('filters activity and audit by tenant and redacts sensitive metadata', async () => {
    const { service, prisma } = createService();
    prisma.auditLog.findMany.mockResolvedValue([auditLog()]);

    const activity = await service.activity(tenantAdmin(), { process_id: 'process-a' }, metadata);
    const audit = await service.auditLogs(tenantAdmin(), { action: 'process_submitted' }, metadata);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) }),
    );
    expect(activity[0]!.metadata).toEqual({ direction_id: 'direction-a', api_key: '[REDACTED]' });
    expect(audit[0]!.new_value).toEqual({ status: 'SUBMITTED', token: '[REDACTED]' });
  });

  it('exports audit CSV and records the export audit action', async () => {
    const { service, prisma } = createService();
    prisma.auditLog.findMany.mockResolvedValue([auditLog()]);

    const file = await service.auditCsv(tenantAdmin(), {}, metadata);

    expect(file).toBeDefined();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'audit_exported' }) }),
    );
  });

  it('creates, assigns, completes and deletes tasks with notification', async () => {
    const { service, prisma } = createService();
    prisma.taskItem.create.mockResolvedValue(task());
    prisma.taskItem.findFirst.mockResolvedValue(task());
    prisma.taskItem.update.mockResolvedValue(
      task({ status: TaskItemStatus.COMPLETED, completedAt: new Date() }),
    );
    prisma.notification.create.mockResolvedValue(notification());

    const created = await service.createTask(
      tenantAdmin(),
      { title: 'Completer', direction_id: 'direction-a' },
      metadata,
    );
    const completed = await service.completeTask(tenantAdmin(), 'task-a', metadata);
    await service.deleteTask(tenantAdmin(), 'task-a', metadata);

    expect(created.priority).toBe('medium');
    expect(completed.status).toBe('completed');
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(prisma.taskItem.delete).toHaveBeenCalledWith({ where: { id: 'task-a' } });
  });

  it('refuses task creation for readonly and filters other direction tasks for direction referent', async () => {
    const { service, prisma } = createService();
    prisma.taskItem.findMany.mockResolvedValue([]);

    await expect(
      service.createTask(readonly(), { title: 'Interdit' }, metadata),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.listTasks(directionReferent(), { direction_id: 'direction-b' }),
    ).resolves.toEqual([]);
    expect(prisma.taskItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-a',
          directionId: 'direction-b',
          OR: expect.arrayContaining([expect.objectContaining({ directionId: 'direction-a' })]),
        }),
      }),
    );
  });

  it('refuses business activity for super admin without support grant', async () => {
    const { service } = createService();

    await expect(service.activity(superAdminWithoutGrant(), {}, metadata)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('builds my actions from scoped tasks, notifications, exports and processes', async () => {
    const { service, prisma } = createService();
    prisma.taskItem.findMany.mockResolvedValue([task()]);
    prisma.notification.count.mockResolvedValue(1);
    prisma.notification.findMany.mockResolvedValue([notification()]);
    prisma.exportJob.findMany.mockResolvedValue([{ id: 'export-a', status: 'COMPLETED' }]);
    prisma.process.findMany.mockResolvedValue([
      { id: 'process-a', name: 'Cloture', status: 'DRAFT', completenessScore: 45 },
    ]);

    const result = await service.myActions(tenantAdmin());

    expect(result.tasks).toHaveLength(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.exports_ready).toHaveLength(1);
    expect(result.processes_to_complete).toHaveLength(1);
  });
});
