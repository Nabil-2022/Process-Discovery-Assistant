import { ForbiddenException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';

import {
  NotificationType,
  Prisma,
  ProcessStatus,
  RiskLevel,
  ValidationDecision,
} from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestMetadata } from '../../auth/auth.types';
import {
  AssignReferentDto,
  CreateDirectionDto,
  ListDirectionsQueryDto,
  RemindReferentDto,
  TenantDashboardQueryDto,
  UpdateDirectionDto,
} from '../dto/tenant.dto';
import { TenantAccessContext } from '../guards/tenant-access.guard';

const writePermissions = ['manage_directions', 'manage_users'];
const readPermissionRoles = [
  'tenant_admin',
  'direction_referent',
  'validator',
  'consultant',
  'readonly',
];

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboardSummary(ctx: TenantAccessContext, query: TenantDashboardQueryDto) {
    this.assertCanRead(ctx);
    const where = this.processWhere(ctx, query);
    const [
      directions,
      processes,
      draft,
      submitted,
      corrections,
      validated,
      completeness,
      pendingValidations,
      criticalRisks,
      automationNeeds,
    ] = await Promise.all([
      this.prisma.direction.count({ where: this.directionWhere(ctx) }),
      this.prisma.process.count({ where }),
      this.prisma.process.count({ where: { ...where, status: ProcessStatus.DRAFT } }),
      this.prisma.process.count({
        where: { ...where, status: { in: [ProcessStatus.SUBMITTED, ProcessStatus.RESUBMITTED] } },
      }),
      this.prisma.process.count({
        where: { ...where, status: ProcessStatus.CHANGES_REQUESTED },
      }),
      this.prisma.process.count({
        where: { ...where, status: { in: [ProcessStatus.APPROVED, ProcessStatus.PUBLISHED] } },
      }),
      this.prisma.process.aggregate({ where, _avg: { completenessScore: true } }),
      this.prisma.processValidation.count({
        where: {
          tenantId: ctx.tenantId,
          decision: { in: [ValidationDecision.SUBMITTED, ValidationDecision.RESUBMITTED] },
          ...(query.direction_id ? { process: { directionId: query.direction_id } } : {}),
        },
      }),
      this.prisma.risk.count({
        where: { tenantId: ctx.tenantId, deletedAt: null, inherentLevel: RiskLevel.CRITICAL },
      }),
      this.prisma.automationNeed.count({
        where: {
          tenantId: ctx.tenantId,
          ...(query.direction_id ? { process: { directionId: query.direction_id } } : {}),
        },
      }),
    ]);

    return {
      directions,
      processes,
      draft_processes: draft,
      submitted_processes: submitted,
      correction_processes: corrections,
      validated_processes: validated,
      average_completeness: Number(completeness._avg.completenessScore ?? 0),
      pending_validations: pendingValidations,
      critical_risks: criticalRisks,
      automation_opportunities: automationNeeds,
    };
  }

  async progressByDirection(ctx: TenantAccessContext, query: TenantDashboardQueryDto) {
    this.assertCanRead(ctx);
    const directions = await this.prisma.direction.findMany({
      where: this.directionWhere(ctx, query),
      orderBy: { name: 'asc' },
      include: {
        processes: {
          where: {
            deletedAt: null,
            ...(query.campaign_id ? { campaignId: query.campaign_id } : {}),
          },
          select: { status: true, completenessScore: true },
        },
        campaignDirections: query.campaign_id
          ? { where: { campaignId: query.campaign_id }, select: { progress: true } }
          : { select: { progress: true } },
      },
    });
    return directions.map((direction) => {
      const processCount = direction.processes.length;
      const validated = direction.processes.filter((process) =>
        this.isValidatedStatus(process.status),
      ).length;
      return {
        id: direction.id,
        name: direction.name,
        code: direction.code,
        processes: processCount,
        validated_processes: validated,
        average_completeness: this.average(
          direction.processes.map((process) => process.completenessScore),
        ),
        campaign_progress: Number(direction.campaignDirections[0]?.progress ?? 0),
        progress: processCount ? Math.round((validated / processCount) * 100) : 0,
      };
    });
  }

  async processStatusDistribution(ctx: TenantAccessContext, query: TenantDashboardQueryDto) {
    return this.groupProcesses(ctx, query, ['status']);
  }

  async processCategoryDistribution(ctx: TenantAccessContext, query: TenantDashboardQueryDto) {
    this.assertCanRead(ctx);
    const groups = await this.prisma.process.groupBy({
      by: ['categoryId'],
      where: this.processWhere(ctx, query),
      _count: { _all: true },
    });
    const categories = await this.prisma.processCategory.findMany({
      where: {
        tenantId: ctx.tenantId,
        id: { in: groups.map((group) => group.categoryId).filter(Boolean) as string[] },
      },
    });
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    return groups.map((group) => ({
      category_id: group.categoryId,
      label: group.categoryId
        ? (categoryById.get(group.categoryId)?.type ?? 'Non classe')
        : 'Non classe',
      count: group._count._all,
    }));
  }

  async risksByCriticality(ctx: TenantAccessContext) {
    this.assertCanRead(ctx);
    const groups = await this.prisma.risk.groupBy({
      by: ['inherentLevel'],
      where: { tenantId: ctx.tenantId, deletedAt: null },
      _count: { _all: true },
    });
    return groups.map((group) => ({
      level: group.inherentLevel ?? 'UNSPECIFIED',
      count: group._count._all,
    }));
  }

  async maturityOverview(ctx: TenantAccessContext, query: TenantDashboardQueryDto) {
    this.assertCanRead(ctx);
    const groups = await this.prisma.process.groupBy({
      by: ['status'],
      where: this.processWhere(ctx, query),
      _avg: { completenessScore: true },
      _count: { _all: true },
    });
    return groups.map((group) => ({
      status: group.status,
      processes: group._count._all,
      average_completeness: Number(group._avg.completenessScore ?? 0),
    }));
  }

  async actionsPriority(ctx: TenantAccessContext, query: TenantDashboardQueryDto) {
    this.assertCanRead(ctx);
    const processes = await this.prisma.process.findMany({
      where: {
        ...this.processWhere(ctx, query),
        OR: [
          { status: ProcessStatus.CHANGES_REQUESTED },
          { completenessScore: { lt: 60 } },
          { risks: { some: { inherentLevel: RiskLevel.CRITICAL, deletedAt: null } } },
        ],
      },
      take: 20,
      orderBy: [{ completenessScore: 'asc' }, { updatedAt: 'desc' }],
      include: { direction: true },
    });
    return processes.map((process) => ({
      process_id: process.id,
      process_name: process.name,
      direction_id: process.directionId,
      direction_name: process.direction.name,
      status: process.status,
      completeness_score: Number(process.completenessScore),
      priority: process.status === ProcessStatus.CHANGES_REQUESTED ? 'correction' : 'completion',
    }));
  }

  async listDirections(ctx: TenantAccessContext, query: ListDirectionsQueryDto) {
    this.assertCanRead(ctx);
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const where = this.directionWhere(ctx, query);
    const [total, directions] = await Promise.all([
      this.prisma.direction.count({ where }),
      this.prisma.direction.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          membershipDirections: {
            include: {
              membership: { include: { user: true, roles: { include: { role: true } } } },
            },
          },
          processes: {
            where: { deletedAt: null },
            select: { status: true, completenessScore: true, updatedAt: true },
          },
          campaignDirections: query.campaign_id
            ? { where: { campaignId: query.campaign_id } }
            : true,
        },
      }),
    ]);
    return {
      page,
      page_size: pageSize,
      total,
      items: directions.map((direction) => this.serializeDirection(direction)),
    };
  }

  async getDirection(ctx: TenantAccessContext, id: string) {
    await this.assertCanReadDirection(ctx, id);
    const direction = await this.prisma.direction.findFirst({
      where: { id, ...this.directionWhere(ctx) },
      include: {
        membershipDirections: {
          include: { membership: { include: { user: true, roles: { include: { role: true } } } } },
        },
        processes: { where: { deletedAt: null }, include: { category: true } },
        campaignDirections: { include: { campaign: true } },
      },
    });
    if (!direction) throw new NotFoundException('Direction introuvable.');
    return this.serializeDirection(direction, true);
  }

  async createDirection(
    ctx: TenantAccessContext,
    dto: CreateDirectionDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    const direction = await this.prisma.direction.create({
      data: {
        tenantId: ctx.tenantId,
        name: dto.name,
        code: dto.code ?? this.codeFromName(dto.name),
        parentId: dto.parent_id,
        createdBy: ctx.actorUserId,
        updatedBy: ctx.actorUserId,
      },
    });
    await this.audit(
      ctx,
      'direction_created',
      'directions',
      direction.id,
      { name: dto.name },
      metadata,
    );
    return this.getDirection(ctx, direction.id);
  }

  async updateDirection(
    ctx: TenantAccessContext,
    id: string,
    dto: UpdateDirectionDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureDirection(ctx, id);
    await this.prisma.direction.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        status: dto.status,
        updatedBy: ctx.actorUserId,
      },
    });
    await this.audit(
      ctx,
      'direction_updated',
      'directions',
      id,
      this.withoutUndefined({ ...dto }),
      metadata,
    );
    return this.getDirection(ctx, id);
  }

  async deleteDirection(ctx: TenantAccessContext, id: string, metadata: RequestMetadata) {
    this.assertCanWrite(ctx);
    await this.ensureDirection(ctx, id);
    await this.prisma.direction.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'deleted', updatedBy: ctx.actorUserId },
    });
    await this.audit(ctx, 'direction_deleted', 'directions', id, {}, metadata);
  }

  async assignReferent(
    ctx: TenantAccessContext,
    directionId: string,
    dto: AssignReferentDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureDirection(ctx, directionId);
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { tenantId: ctx.tenantId, userId: dto.user_id, status: 'ACTIVE' },
    });
    if (!membership) {
      throw new ForbiddenException('Le referent doit appartenir au meme tenant et etre actif.');
    }
    await this.prisma.membershipDirection.upsert({
      where: { membershipId_directionId: { membershipId: membership.id, directionId } },
      create: { membershipId: membership.id, directionId },
      update: {},
    });
    await this.prisma.notification.create({
      data: {
        tenantId: ctx.tenantId,
        userId: dto.user_id,
        type: NotificationType.ASSIGNMENT,
        title: 'Direction affectee',
        body: 'Vous avez ete affecte comme referent de direction.',
        metadata: this.toJsonObject({ direction_id: directionId }),
      },
    });
    await this.audit(
      ctx,
      'direction_referent_assigned',
      'membership_directions',
      directionId,
      { user_id: dto.user_id },
      metadata,
    );
  }

  async removeReferent(
    ctx: TenantAccessContext,
    directionId: string,
    dto: AssignReferentDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureDirection(ctx, directionId);
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { tenantId: ctx.tenantId, userId: dto.user_id },
    });
    if (membership) {
      await this.prisma.membershipDirection.deleteMany({
        where: { membershipId: membership.id, directionId },
      });
    }
    await this.audit(
      ctx,
      'direction_referent_removed',
      'membership_directions',
      directionId,
      { user_id: dto.user_id },
      metadata,
    );
  }

  async remindReferent(
    ctx: TenantAccessContext,
    directionId: string,
    dto: RemindReferentDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    const direction = await this.ensureDirection(ctx, directionId);
    const assignments = await this.prisma.membershipDirection.findMany({
      where: { directionId },
      include: { membership: true },
    });
    for (const assignment of assignments) {
      await this.prisma.notification.create({
        data: {
          tenantId: ctx.tenantId,
          userId: assignment.membership.userId,
          type: NotificationType.CAMPAIGN_LATE,
          title: `Relance ${direction.name}`,
          body: dto.message ?? 'Merci de mettre a jour la cartographie de votre direction.',
          metadata: this.toJsonObject({ direction_id: directionId }),
        },
      });
    }
    await this.audit(
      ctx,
      'direction_referent_reminded',
      'directions',
      directionId,
      { referents: assignments.length },
      metadata,
    );
  }

  async directionProgress(ctx: TenantAccessContext, id: string) {
    const direction = await this.getDirection(ctx, id);
    return {
      direction_id: id,
      processes: direction.processes,
      validated_processes: direction.validated_processes,
      average_completeness: direction.average_completeness,
      progression: direction.progression,
      campaign_progress: direction.campaign_progress,
      pending_validations: direction.pending_validations,
    };
  }

  async directionActivity(ctx: TenantAccessContext, id: string) {
    await this.ensureDirection(ctx, id);
    const logs = await this.prisma.auditLog.findMany({
      where: { tenantId: ctx.tenantId, resourceId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      result: log.result,
      created_at: log.createdAt,
    }));
  }

  async directionProcesses(ctx: TenantAccessContext, id: string) {
    await this.assertCanReadDirection(ctx, id);
    return this.prisma.process.findMany({
      where: { tenantId: ctx.tenantId, directionId: id, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        completenessScore: true,
        updatedAt: true,
      },
    });
  }

  async exportDirectionsCsv(ctx: TenantAccessContext, metadata: RequestMetadata) {
    this.assertCanRead(ctx);
    const directions = await this.listDirections(ctx, { page: 1, page_size: 100 });
    const rows = [
      ['Direction', 'Code', 'Referent', 'Processus', 'Valides', 'Completude', 'Progression'].join(
        ',',
      ),
      ...directions.items.map((direction) =>
        [
          this.csv(direction.name),
          this.csv(direction.code ?? ''),
          this.csv(direction.referent?.email ?? ''),
          direction.processes,
          direction.validated_processes,
          direction.average_completeness,
          direction.progression,
        ].join(','),
      ),
    ];
    await this.audit(
      ctx,
      'directions_exported',
      'directions',
      null,
      { count: directions.total },
      metadata,
    );
    return new StreamableFile(Buffer.from(rows.join('\n'), 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="directions.csv"',
    });
  }

  private async groupProcesses(
    ctx: TenantAccessContext,
    query: TenantDashboardQueryDto,
    by: ['status'],
  ) {
    this.assertCanRead(ctx);
    const groups = await this.prisma.process.groupBy({
      by,
      where: this.processWhere(ctx, query),
      _count: { _all: true },
    });
    return groups.map((group) => ({ label: group.status, count: group._count._all }));
  }

  private processWhere(ctx: TenantAccessContext, query: TenantDashboardQueryDto = {}) {
    return {
      tenantId: ctx.tenantId,
      deletedAt: null,
      ...(query.direction_id ? { directionId: query.direction_id } : this.directionScopeWhere(ctx)),
      ...(query.campaign_id ? { campaignId: query.campaign_id } : {}),
      ...(query.category_id ? { categoryId: query.category_id } : {}),
      ...(query.process_status ? { status: query.process_status as ProcessStatus } : {}),
    } satisfies Prisma.ProcessWhereInput;
  }

  private directionWhere(
    ctx: TenantAccessContext,
    query: Pick<ListDirectionsQueryDto, 'search' | 'direction_id'> = {},
  ) {
    return {
      tenantId: ctx.tenantId,
      deletedAt: null,
      ...(query.direction_id ? { id: query.direction_id } : this.directionScopeWhere(ctx)),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    } satisfies Prisma.DirectionWhereInput;
  }

  private directionScopeWhere(ctx: TenantAccessContext) {
    if (this.hasTenantWideRead(ctx)) {
      return {};
    }
    return { id: { in: ctx.directionIds } };
  }

  private hasTenantWideRead(ctx: TenantAccessContext) {
    return (
      ctx.isSupportAccess ||
      ctx.tenantRoles.includes('tenant_admin') ||
      ctx.tenantRoles.includes('validator') ||
      ctx.tenantRoles.includes('readonly')
    );
  }

  private assertCanRead(ctx: TenantAccessContext) {
    if (ctx.isSupportAccess) return;
    if (!ctx.tenantRoles.some((role) => readPermissionRoles.includes(role))) {
      throw new ForbiddenException('Lecture tenant refusee.');
    }
  }

  private async assertCanReadDirection(ctx: TenantAccessContext, directionId: string) {
    this.assertCanRead(ctx);
    if (!this.hasTenantWideRead(ctx) && !ctx.directionIds.includes(directionId)) {
      throw new ForbiddenException('Direction hors perimetre.');
    }
  }

  private assertCanWrite(ctx: TenantAccessContext) {
    if (
      ctx.isSupportAccess ||
      !writePermissions.some((permission) => ctx.permissions.includes(permission))
    ) {
      throw new ForbiddenException('Permission direction manquante.');
    }
  }

  private async ensureDirection(ctx: TenantAccessContext, directionId: string) {
    await this.assertCanReadDirection(ctx, directionId);
    const direction = await this.prisma.direction.findFirst({
      where: { id: directionId, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!direction) throw new NotFoundException('Direction introuvable.');
    return direction;
  }

  private serializeDirection(
    direction: {
      id: string;
      name: string;
      code: string | null;
      status: string;
      createdAt: Date;
      updatedAt: Date;
      membershipDirections: {
        membership: {
          user: { id: string; email: string; fullName: string };
          roles?: { role: { code: string } }[];
        };
      }[];
      processes: { status: ProcessStatus; completenessScore: Prisma.Decimal; updatedAt?: Date }[];
      campaignDirections: {
        progress: Prisma.Decimal;
        campaign?: { id: string; name: string; status: string };
      }[];
    },
    detailed = false,
  ) {
    const referentAssignment =
      direction.membershipDirections.find((item) =>
        item.membership.roles?.some((role) => role.role.code === 'direction_referent'),
      ) ?? direction.membershipDirections[0];
    const processCount = direction.processes.length;
    const validated = direction.processes.filter((process) =>
      this.isValidatedStatus(process.status),
    ).length;
    const averageCompleteness = this.average(
      direction.processes.map((process) => process.completenessScore),
    );
    return {
      id: direction.id,
      name: direction.name,
      code: direction.code,
      status: direction.status,
      referent: referentAssignment
        ? {
            id: referentAssignment.membership.user.id,
            email: referentAssignment.membership.user.email,
            full_name: referentAssignment.membership.user.fullName,
          }
        : null,
      processes: processCount,
      validated_processes: validated,
      average_completeness: averageCompleteness,
      progression: processCount ? Math.round((validated / processCount) * 100) : 0,
      campaign_progress: Number(direction.campaignDirections[0]?.progress ?? 0),
      validation: validated === processCount && processCount > 0 ? 'validated' : 'pending',
      last_activity_at:
        direction.processes
          .map((process) => process.updatedAt)
          .filter(Boolean)
          .sort()
          .at(-1) ?? direction.updatedAt,
      pending_validations: direction.processes.filter(
        (process) => process.status === ProcessStatus.SUBMITTED,
      ).length,
      campaign: direction.campaignDirections[0]?.campaign ?? null,
      ...(detailed
        ? {
            referents: direction.membershipDirections.map((item) => ({
              id: item.membership.user.id,
              email: item.membership.user.email,
              full_name: item.membership.user.fullName,
            })),
            process_statuses: direction.processes.reduce<Record<string, number>>((acc, process) => {
              acc[process.status] = (acc[process.status] ?? 0) + 1;
              return acc;
            }, {}),
            create_process_available: false,
            create_process_message: 'Disponible au Lot 6',
          }
        : {}),
    };
  }

  private average(values: Prisma.Decimal[]) {
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + Number(value), 0) / values.length);
  }

  private isValidatedStatus(status: ProcessStatus) {
    return status === ProcessStatus.APPROVED || status === ProcessStatus.PUBLISHED;
  }

  private codeFromName(name: string) {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }

  private csv(value: string) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  private withoutUndefined<T extends Record<string, unknown>>(value: T) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
  }

  private toJsonObject(value: Record<string, unknown>) {
    return value as Prisma.InputJsonObject;
  }

  private async audit(
    ctx: TenantAccessContext,
    action: string,
    resourceType: string,
    resourceId: string | null,
    metadataValue: Record<string, unknown>,
    metadata: RequestMetadata,
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        actorUserId: ctx.actorUserId,
        supportGrantId: ctx.supportGrantId,
        action,
        resourceType,
        resourceId,
        result: 'success',
        metadata: this.toJsonObject(metadataValue),
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });
  }
}
