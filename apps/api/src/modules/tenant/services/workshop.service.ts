import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { NotificationType, Prisma, RaciRole } from '../../../generated/prisma';
import { RequestMetadata } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkshopCommentDto, WorkshopCommentUpdateDto } from '../dto/workshop.dto';
import { TenantAccessContext } from '../guards/tenant-access.guard';
import { COMPLETENESS_PROCESS_INCLUDE, CompletenessService } from './completeness.service';

const WRITE_PERMISSIONS = ['manage_directions', 'create_process', 'update_process_working_copy'];

const WORKSHOP_PROCESS_INCLUDE = {
  ...COMPLETENESS_PROCESS_INCLUDE,
  validations: { orderBy: { createdAt: 'desc' }, take: 20 },
  snapshots: { orderBy: { createdAt: 'desc' }, take: 20 },
  versions: { orderBy: { versionNumber: 'desc' }, take: 20 },
  comments: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 20 },
  bpmnVersions: { orderBy: { versionNumber: 'desc' }, take: 10 },
  raciVersions: { orderBy: { versionNumber: 'desc' }, take: 10 },
} satisfies Prisma.ProcessInclude;

type WorkshopProcess = Prisma.ProcessGetPayload<{ include: typeof WORKSHOP_PROCESS_INCLUDE }>;

@Injectable()
export class WorkshopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly completenessService: CompletenessService,
  ) {}

  async overview(ctx: TenantAccessContext, processId: string) {
    const process = await this.ensureProcess(ctx, processId);
    const quality = this.completenessService.calculate(process);
    const latestRaci = process.raciAssessments[0];
    const latestBpmn = process.bpmnModels[0];
    return {
      process: this.processSummary(process),
      quality,
      raci: latestRaci
        ? {
            status: latestRaci.validationStatus,
            score: Number(latestRaci.qualityScore),
            version: latestRaci.versionNumber,
            generated_at: latestRaci.generatedAt,
          }
        : null,
      bpmn: latestBpmn
        ? {
            status: latestBpmn.validationStatus,
            version: latestBpmn.versionNumber,
            generated_at: latestBpmn.generatedAt,
            blocking_issues: this.jsonArray(latestBpmn.blockingIssues).length,
            warnings: this.jsonArray(latestBpmn.warnings).length,
          }
        : null,
      morocco: process.moroccoCompliance
        ? {
            is_user_facing_process: process.moroccoCompliance.isUserFacingProcess,
            law_55_19_applicable: process.moroccoCompliance.law5519Applicable,
            target_channel: process.moroccoCompliance.targetChannel,
            target_processing_time_days: process.moroccoCompliance.targetProcessingTimeDays,
          }
        : null,
      workflow: {
        status: process.status,
        last_submission: process.validations.find((item) => item.decision === 'SUBMITTED') ?? null,
        last_validation:
          process.validations.find((item) =>
            ['APPROVED', 'PUBLISHED', 'CHANGES_REQUESTED'].includes(item.decision),
          ) ?? null,
        current_published_version: process.versions.find((version) => version.publishedAt) ?? null,
      },
      alerts: {
        blocking: quality.blockingIssueDetails,
        warnings: quality.warningDetails,
        recommendations: quality.recommendations,
      },
      actions: this.actions(ctx, process, quality.canSubmit),
    };
  }

  async quality(ctx: TenantAccessContext, processId: string) {
    const process = await this.ensureProcess(ctx, processId);
    return this.completenessService.calculate(process);
  }

  async procedure(ctx: TenantAccessContext, processId: string, metadata: RequestMetadata) {
    const process = await this.ensureProcess(ctx, processId);
    await this.audit(ctx, 'procedure_viewed', 'processes', processId, {}, metadata);
    return {
      status: 'draft_deterministic',
      disclaimer: 'Structure deterministe a valider humainement avant toute procedure officielle.',
      sections: [
        this.section('objet', 'Objet', process.objective ?? process.name, 'deterministic'),
        this.section('perimetre', 'Perimetre', process.scope ?? '', 'deterministic'),
        this.section(
          'responsabilites',
          'Responsabilites',
          process.actorRoles.map((role) => ({
            activity_id: role.activityId,
            actor_id: role.actorId,
            role: role.raciRole,
          })),
          'deterministic',
        ),
        this.section('entrees', 'Entrees', process.inputs, 'deterministic'),
        this.section('sorties', 'Sorties', process.outputs, 'deterministic'),
        this.section('activites', 'Description des activites', process.activities, 'deterministic'),
        this.section('documents', 'Documents associes', process.documents, 'deterministic'),
        this.section('applications', 'Applications', process.applications, 'deterministic'),
        this.section('kpi', 'KPI', process.kpis, 'deterministic'),
        this.section('risques', 'Risques', process.risks, 'deterministic'),
        this.section(
          'controles',
          'Controles',
          process.risks.flatMap((risk) => risk.controls),
          'deterministic',
        ),
        this.section('enregistrements', 'Enregistrements', [], 'editable'),
        this.section('versions', 'Versions', process.versions, 'deterministic'),
        this.section('approbations', 'Approbations', process.validations, 'deterministic'),
      ],
    };
  }

  async backlog(ctx: TenantAccessContext, processId: string, metadata: RequestMetadata) {
    const process = await this.ensureProcess(ctx, processId);
    const quality = this.completenessService.calculate(process);
    const latestRaci = process.raciAssessments[0];
    const latestBpmn = process.bpmnModels[0];
    const items = [
      ...process.painPoints.map((item) =>
        this.backlogItem(
          item.description,
          'pain_point',
          'Pain points',
          item.impact,
          item.frequency,
        ),
      ),
      ...process.automationNeeds.map((item) =>
        this.backlogItem(
          item.description,
          'automation',
          'Besoins automatisation',
          item.expectedGain,
          item.complexity,
          item.priority,
        ),
      ),
      ...quality.recommendations.map((item) =>
        this.backlogItem(item, 'quality', 'Controle qualite', 'Moyen', 'Moyenne'),
      ),
      ...this.jsonArray<{ message?: string }>(latestRaci?.recommendations).map((item) =>
        this.backlogItem(item.message ?? String(item), 'raci', 'RACI', 'Moyen', 'Faible'),
      ),
      ...this.jsonArray<{ message?: string }>(latestBpmn?.recommendations).map((item) =>
        this.backlogItem(item.message ?? String(item), 'bpmn', 'BPMN', 'Moyen', 'Faible'),
      ),
    ];
    if (process.moroccoCompliance?.law5519Applicable) {
      items.push(
        this.backlogItem(
          'Verifier simplification, digitalisation, delais et pieces demandees Loi 55-19.',
          'morocco',
          'Conformite Maroc',
          'Eleve',
          'Moyenne',
          'HIGH',
        ),
      );
    }
    if (process.eventLogImports.length) {
      items.push(
        this.backlogItem(
          'Comparer plus tard le modele theorique aux event logs valides.',
          'process_mining',
          'Process mining',
          'Moyen',
          'Moyenne',
        ),
      );
    }
    await this.audit(
      ctx,
      'backlog_viewed',
      'processes',
      processId,
      { count: items.length },
      metadata,
    );
    return { items };
  }

  async versions(ctx: TenantAccessContext, processId: string) {
    const process = await this.ensureProcess(ctx, processId);
    return {
      published_versions: process.versions,
      snapshots: process.snapshots,
      raci_versions: process.raciVersions,
      bpmn_versions: process.bpmnVersions,
      procedure_versions: [],
    };
  }

  async auditLogs(ctx: TenantAccessContext, processId: string, metadata: RequestMetadata) {
    await this.ensureProcess(ctx, processId);
    if (ctx.tenantRoles.includes('consultant') && !ctx.permissions.includes('export_process')) {
      throw new ForbiddenException('Audit limite pour consultant.');
    }
    const logs = await this.prisma.auditLog.findMany({
      where: {
        tenantId: ctx.tenantId,
        OR: [{ resourceId: processId }, { metadata: { path: ['process_id'], equals: processId } }],
      },
      orderBy: { createdAt: 'desc' },
      take: ctx.tenantRoles.includes('readonly') ? 50 : 100,
    });
    await this.audit(ctx, 'audit_viewed', 'processes', processId, { count: logs.length }, metadata);
    return logs;
  }

  async comments(ctx: TenantAccessContext, processId: string) {
    await this.ensureProcess(ctx, processId);
    return this.prisma.comment.findMany({
      where: { tenantId: ctx.tenantId, processId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createComment(
    ctx: TenantAccessContext,
    processId: string,
    dto: WorkshopCommentDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanComment(ctx);
    await this.ensureProcess(ctx, processId);
    const comment = await this.prisma.comment.create({
      data: {
        tenantId: ctx.tenantId,
        processId,
        resourceType: dto.resource_type ?? dto.section,
        resourceId: dto.resource_id,
        body: dto.body,
        createdBy: ctx.actorUserId,
      },
    });
    await this.audit(
      ctx,
      'comment_created',
      'comments',
      comment.id,
      { process_id: processId },
      metadata,
    );
    await this.notify(ctx, {
      type: NotificationType.COMMENT_CREATED,
      title: 'Commentaire cree',
      body: dto.body,
      actionUrl: `/tenant/processes/${processId}/workshop`,
      resourceType: 'comments',
      resourceId: comment.id,
    });
    return comment;
  }

  async updateComment(
    ctx: TenantAccessContext,
    processId: string,
    commentId: string,
    dto: WorkshopCommentUpdateDto,
  ) {
    this.assertCanComment(ctx);
    await this.ensureProcess(ctx, processId);
    await this.ensureComment(ctx, processId, commentId);
    return this.prisma.comment.update({
      where: { id: commentId },
      data: { body: dto.body, status: dto.status },
    });
  }

  async deleteComment(ctx: TenantAccessContext, processId: string, commentId: string) {
    this.assertCanComment(ctx);
    await this.ensureProcess(ctx, processId);
    await this.ensureComment(ctx, processId, commentId);
    return this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }

  async resolveComment(
    ctx: TenantAccessContext,
    processId: string,
    commentId: string,
    metadata: RequestMetadata,
  ) {
    this.assertCanComment(ctx);
    await this.ensureProcess(ctx, processId);
    await this.ensureComment(ctx, processId, commentId);
    const comment = await this.prisma.comment.update({
      where: { id: commentId },
      data: { status: 'resolved', resolvedAt: new Date(), resolvedBy: ctx.actorUserId },
    });
    await this.audit(
      ctx,
      'comment_resolved',
      'comments',
      commentId,
      { process_id: processId },
      metadata,
    );
    return comment;
  }

  private processSummary(process: WorkshopProcess) {
    return {
      id: process.id,
      name: process.name,
      code: process.code,
      description: process.description,
      direction: process.direction,
      owner: process.ownerActor,
      status: process.status,
      publication_status: process.versions.some((version) => version.publishedAt)
        ? 'PUBLISHED'
        : 'UNPUBLISHED',
      completeness_score: Number(process.completenessScore),
      updated_at: process.updatedAt,
      last_submitted_snapshot_id: process.lastSubmittedSnapshotId,
      last_submitted_version_id: process.lastSubmittedVersionId,
      lock_version: process.lockVersion,
    };
  }

  private actions(ctx: TenantAccessContext, process: WorkshopProcess, canSubmit: boolean) {
    const canWrite =
      !ctx.isSupportAccess &&
      WRITE_PERMISSIONS.some((permission) => ctx.permissions.includes(permission));
    return {
      open_wizard: true,
      submit: canWrite && canSubmit,
      open_review: ctx.permissions.includes('validate_process'),
      generate_bpmn: canWrite,
      generate_raci: canWrite,
      recalculate_quality: canWrite,
      export_available: process.versions.length > 0 || Boolean(process.bpmnModels[0]),
      back_to_list: true,
    };
  }

  private section(key: string, title: string, content: unknown, source: string) {
    return { key, title, content, source, editable: source === 'editable', validated: false };
  }

  private backlogItem(
    title: string,
    type: string,
    source: string,
    impact?: string | null,
    complexity?: string | null,
    priority?: string | null,
  ) {
    return {
      id: `${type}-${this.slug(title).slice(0, 40)}`,
      title,
      type,
      source,
      priority: priority ?? 'MEDIUM',
      impact: impact ?? 'Moyen',
      complexity: complexity ?? 'Moyenne',
      status: 'OPEN',
      owner: null,
      due_date: null,
    };
  }

  private async ensureProcess(ctx: TenantAccessContext, id: string) {
    this.assertCanRead(ctx);
    const process = await this.prisma.process.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null, ...this.directionScope(ctx) },
      include: WORKSHOP_PROCESS_INCLUDE,
    });
    if (!process) throw new NotFoundException('Processus introuvable.');
    return process;
  }

  private async ensureComment(ctx: TenantAccessContext, processId: string, commentId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, tenantId: ctx.tenantId, processId, deletedAt: null },
    });
    if (!comment) throw new NotFoundException('Commentaire introuvable.');
    return comment;
  }

  private directionScope(ctx: TenantAccessContext) {
    if (ctx.isSupportAccess || this.hasTenantWideRead(ctx)) return {};
    return { directionId: { in: ctx.directionIds } };
  }

  private hasTenantWideRead(ctx: TenantAccessContext) {
    return ctx.tenantRoles.some((role) => ['tenant_admin', 'validator', 'readonly'].includes(role));
  }

  private assertCanRead(ctx: TenantAccessContext) {
    if (ctx.isSupportAccess) return;
    if (!ctx.tenantRoles.length) throw new ForbiddenException('Lecture refusee.');
  }

  private assertCanComment(ctx: TenantAccessContext) {
    if (ctx.isSupportAccess || ctx.tenantRoles.includes('readonly')) {
      throw new ForbiddenException('Commentaire refuse.');
    }
    if (!WRITE_PERMISSIONS.some((permission) => ctx.permissions.includes(permission))) {
      throw new ForbiddenException('Commentaire refuse.');
    }
  }

  private jsonArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
  }

  private slug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
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
        metadata: metadataValue as Prisma.InputJsonObject,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
      },
    });
  }

  private async notify(
    ctx: TenantAccessContext,
    payload: {
      type: NotificationType;
      title: string;
      body: string;
      actionUrl: string;
      resourceType: string;
      resourceId: string;
    },
  ) {
    const notification = (
      this.prisma as unknown as {
        notification?: { create: (args: unknown) => Promise<unknown> };
      }
    ).notification;
    await notification?.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.actorUserId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        severity: 'info',
        actionUrl: payload.actionUrl,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
      },
    });
  }
}
