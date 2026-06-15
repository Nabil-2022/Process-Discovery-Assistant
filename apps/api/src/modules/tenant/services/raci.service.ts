import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, RaciRole } from '../../../generated/prisma';
import { RequestMetadata } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { RaciValidationDto, UpdateRaciResponsibilitiesDto } from '../dto/raci.dto';
import { TenantAccessContext } from '../guards/tenant-access.guard';
import { evaluateRaci, RACI_RULE_VERSION, raciSourceHash } from './raci-rules';
import { RaciResult, RaciValidationStatus } from './raci.types';

const WRITE_PERMISSIONS = ['manage_directions', 'create_process', 'update_process_working_copy'];
const VALIDATE_PERMISSIONS = ['manage_directions', 'validate_process'];

const RACI_PROCESS_INCLUDE = {
  activities: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
  actorRoles: { include: { actor: true } },
  ownerActor: true,
  moroccoCompliance: true,
  risks: { where: { deletedAt: null } },
} satisfies Prisma.ProcessInclude;

@Injectable()
export class RaciService {
  constructor(private readonly prisma: PrismaService) {}

  async getRaci(ctx: TenantAccessContext, processId: string) {
    const process = await this.ensureProcess(ctx, processId);
    const latest = await this.latestAssessment(ctx, processId);
    if (latest) return this.assessmentToResult(latest);
    return this.calculate(process, 'DRAFT', 1);
  }

  async generate(ctx: TenantAccessContext, processId: string, metadata: RequestMetadata) {
    this.assertCanWrite(ctx);
    const process = await this.ensureProcess(ctx, processId);
    const result = this.calculate(process, 'DRAFT', await this.nextVersion(ctx, processId));
    const saved = await this.persist(ctx, processId, result, 'raci_generated', metadata);
    return this.assessmentToResult(saved);
  }

  async recalculate(ctx: TenantAccessContext, processId: string, metadata: RequestMetadata) {
    this.assertCanWrite(ctx);
    const process = await this.ensureProcess(ctx, processId);
    const current = await this.latestAssessment(ctx, processId);
    const nextStatus =
      current?.validationStatus === 'VALIDATED'
        ? 'INVALIDATED'
        : (current?.validationStatus ?? 'DRAFT');
    const result = this.calculate(
      process,
      nextStatus as RaciValidationStatus,
      await this.nextVersion(ctx, processId),
    );
    const saved = await this.persist(ctx, processId, result, 'raci_recalculated', metadata);
    return this.assessmentToResult(saved);
  }

  async updateResponsibilities(
    ctx: TenantAccessContext,
    processId: string,
    dto: UpdateRaciResponsibilitiesDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    await this.ensureResponsibilitiesInScope(ctx, processId, dto);
    await this.prisma.$transaction([
      this.prisma.processActorRole.deleteMany({ where: { tenantId: ctx.tenantId, processId } }),
      ...dto.items.map((item) =>
        this.prisma.processActorRole.create({
          data: {
            tenantId: ctx.tenantId,
            processId,
            activityId: item.activity_id,
            actorId: item.actor_id,
            raciRole: item.raci_role as RaciRole,
            notes: item.notes,
          },
        }),
      ),
    ]);
    await this.audit(
      ctx,
      'raci_responsibility_updated',
      'process_actor_roles',
      processId,
      { count: dto.items.length },
      metadata,
    );
    return this.recalculate(ctx, processId, metadata);
  }

  async validate(
    ctx: TenantAccessContext,
    processId: string,
    dto: RaciValidationDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanValidate(ctx);
    const current = await this.getPersistedOrGenerated(ctx, processId, metadata);
    if ((current.blockingIssues as RaciResult['blockingIssues']).length) {
      throw new BadRequestException('Validation RACI refusee: des blocages existent.');
    }
    const versionNumber = await this.nextVersion(ctx, processId);
    const updated = await this.prisma.raciAssessment.update({
      where: { id: current.id },
      data: {
        validationStatus: 'VALIDATED',
        versionNumber,
        validatedAt: new Date(),
        validatedBy: ctx.actorUserId,
        invalidatedAt: null,
        invalidatedBy: null,
        validationComment: dto.comment,
      },
    });
    await this.createVersion(ctx, updated);
    await this.audit(
      ctx,
      'raci_validated',
      'raci_assessments',
      updated.id,
      { old_status: current.validationStatus, new_status: 'VALIDATED', comment: dto.comment },
      metadata,
    );
    return this.assessmentToResult(updated);
  }

  async invalidate(
    ctx: TenantAccessContext,
    processId: string,
    dto: RaciValidationDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanValidate(ctx);
    const current = await this.getPersistedOrGenerated(ctx, processId, metadata);
    const versionNumber = await this.nextVersion(ctx, processId);
    const updated = await this.prisma.raciAssessment.update({
      where: { id: current.id },
      data: {
        validationStatus: 'INVALIDATED',
        versionNumber,
        invalidatedAt: new Date(),
        invalidatedBy: ctx.actorUserId,
        validationComment: dto.comment,
      },
    });
    await this.createVersion(ctx, updated);
    await this.audit(
      ctx,
      'raci_invalidated',
      'raci_assessments',
      updated.id,
      { old_status: current.validationStatus, new_status: 'INVALIDATED', comment: dto.comment },
      metadata,
    );
    return this.assessmentToResult(updated);
  }

  async issues(ctx: TenantAccessContext, processId: string) {
    const result = await this.getRaci(ctx, processId);
    return { blocking_issues: result.blockingIssues, warnings: result.warnings };
  }

  async history(ctx: TenantAccessContext, processId: string) {
    await this.ensureProcess(ctx, processId);
    return this.prisma.auditLog.findMany({
      where: {
        tenantId: ctx.tenantId,
        resourceId: processId,
        action: { startsWith: 'raci_' },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async versions(ctx: TenantAccessContext, processId: string) {
    await this.ensureProcess(ctx, processId);
    return this.prisma.raciVersion.findMany({
      where: { tenantId: ctx.tenantId, processId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async exportCsv(ctx: TenantAccessContext, processId: string, metadata: RequestMetadata) {
    const result = await this.getRaci(ctx, processId);
    const header = ['Activite', ...result.matrix.actors.map((actor) => actor.name)];
    const rows = result.matrix.activities.map((activity) => [
      activity.name,
      ...result.matrix.actors.map(
        (actor) =>
          result.matrix.cells
            .find((cell) => cell.activityId === activity.id && cell.actorId === actor.id)
            ?.roles.map((role) => role[0])
            .join('/') ?? '',
      ),
    ]);
    await this.audit(ctx, 'raci_exported', 'processes', processId, { format: 'csv' }, metadata);
    return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  }

  private calculate(
    process: Prisma.ProcessGetPayload<{ include: typeof RACI_PROCESS_INCLUDE }>,
    status: RaciValidationStatus,
    versionNumber: number,
  ): RaciResult {
    const actorsById = new Map<string, RaciResult['matrix']['actors'][number]>();
    for (const role of process.actorRoles) {
      actorsById.set(role.actorId, {
        id: role.actorId,
        name: role.actor.name,
        title: role.actor.title,
        directionId: role.actor.directionId,
        isPlatformUser: role.actor.isPlatformUser,
      });
    }
    if (process.ownerActor) {
      actorsById.set(process.ownerActor.id, {
        id: process.ownerActor.id,
        name: process.ownerActor.name,
        title: process.ownerActor.title,
        directionId: process.ownerActor.directionId,
        isPlatformUser: process.ownerActor.isPlatformUser,
      });
    }
    const sourceActors = [...actorsById.values()];
    const grouped = new Map<string, Set<RaciRole>>();
    for (const role of process.actorRoles) {
      const key = `${role.activityId}:${role.actorId}`;
      grouped.set(key, new Set([...(grouped.get(key) ?? []), role.raciRole]));
    }
    const cells = [...grouped.entries()].map(([key, roles]) => {
      const [activityId, actorId] = key.split(':');
      return {
        activityId: activityId ?? '',
        actorId: actorId ?? '',
        roles: [...roles] as RaciRole[],
      };
    });
    const input = {
      activities: process.activities.map((activity) => ({
        id: activity.id,
        name: activity.name,
        activityType: activity.activityType,
        isAutomated: activity.isAutomated,
      })),
      actors: sourceActors.length ? sourceActors : [...actorsById.values()],
      cells,
      isUserFacingProcess: process.moroccoCompliance?.isUserFacingProcess,
      law5519Applicable: process.moroccoCompliance?.law5519Applicable,
      hasProcessOwner: Boolean(process.processOwnerActorId),
      hasCourtOfAccountsRisk: process.risks.some((risk) => risk.courtOfAccountsRelevance),
      hasFinancialRisk: process.risks.some((risk) =>
        `${risk.category ?? ''} ${risk.riskFamily ?? ''} ${risk.description}`
          .toLowerCase()
          .includes('fin'),
      ),
    };
    const evaluation = evaluateRaci(input);
    const sourceHash = raciSourceHash({ ruleVersion: RACI_RULE_VERSION, input });
    return {
      ruleVersion: RACI_RULE_VERSION,
      matrix: evaluation.matrix,
      blockingIssues: evaluation.blockingIssues,
      warnings: evaluation.warnings,
      recommendations: evaluation.recommendations,
      qualityScore: evaluation.qualityScore,
      validationStatus: status,
      versionNumber,
      generatedAt: new Date().toISOString(),
      sourceHash,
      canValidate: evaluation.blockingIssues.length === 0,
    };
  }

  private async persist(
    ctx: TenantAccessContext,
    processId: string,
    result: RaciResult,
    action: string,
    metadata: RequestMetadata,
  ) {
    const existing = await this.latestAssessment(ctx, processId);
    if (existing?.sourceHash === result.sourceHash && existing.ruleVersion === result.ruleVersion) {
      return existing;
    }
    const created = await this.prisma.raciAssessment.create({
      data: {
        tenantId: ctx.tenantId,
        processId,
        ruleVersion: result.ruleVersion,
        matrix: this.toJsonValue(result.matrix),
        activities: this.toJsonValue(result.matrix.activities),
        actors: this.toJsonValue(result.matrix.actors),
        blockingIssues: this.toJsonValue(result.blockingIssues),
        warnings: this.toJsonValue(result.warnings),
        recommendations: this.toJsonValue(result.recommendations),
        qualityScore: new Prisma.Decimal(result.qualityScore),
        validationStatus: result.validationStatus,
        sourceHash: result.sourceHash,
        versionNumber: result.versionNumber,
        generatedBy: ctx.actorUserId,
      },
    });
    await this.createVersion(ctx, created);
    await this.audit(
      ctx,
      action,
      'raci_assessments',
      created.id,
      { process_id: processId, source_hash: result.sourceHash, rule_version: result.ruleVersion },
      metadata,
    );
    return created;
  }

  private async getPersistedOrGenerated(
    ctx: TenantAccessContext,
    processId: string,
    metadata: RequestMetadata,
  ) {
    const existing = await this.latestAssessment(ctx, processId);
    if (existing) return existing;
    this.assertCanWrite(ctx);
    const process = await this.ensureProcess(ctx, processId);
    const result = this.calculate(process, 'DRAFT', await this.nextVersion(ctx, processId));
    return this.persist(ctx, processId, result, 'raci_generated', metadata);
  }

  private assessmentToResult(assessment: {
    ruleVersion: string;
    matrix: unknown;
    blockingIssues: unknown;
    warnings: unknown;
    recommendations: unknown;
    qualityScore: Prisma.Decimal | number;
    validationStatus: string;
    versionNumber: number;
    generatedAt: Date;
    sourceHash: string;
  }): RaciResult {
    const matrix = assessment.matrix as RaciResult['matrix'];
    const blockingIssues = assessment.blockingIssues as RaciResult['blockingIssues'];
    return {
      ruleVersion: assessment.ruleVersion,
      matrix,
      blockingIssues,
      warnings: assessment.warnings as RaciResult['warnings'],
      recommendations: assessment.recommendations as string[],
      qualityScore: Number(assessment.qualityScore),
      validationStatus: assessment.validationStatus as RaciValidationStatus,
      versionNumber: assessment.versionNumber,
      generatedAt: assessment.generatedAt.toISOString(),
      sourceHash: assessment.sourceHash,
      canValidate: blockingIssues.length === 0,
    };
  }

  private async ensureProcess(ctx: TenantAccessContext, id: string) {
    this.assertCanRead(ctx);
    const process = await this.prisma.process.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null, ...this.directionScope(ctx) },
      include: RACI_PROCESS_INCLUDE,
    });
    if (!process) throw new NotFoundException('Processus introuvable.');
    return process;
  }

  private async ensureResponsibilitiesInScope(
    ctx: TenantAccessContext,
    processId: string,
    dto: UpdateRaciResponsibilitiesDto,
  ) {
    const activityIds = new Set(
      (
        await this.prisma.processActivity.findMany({
          where: { tenantId: ctx.tenantId, processId, deletedAt: null },
          select: { id: true },
        })
      ).map((item) => item.id),
    );
    const actorIds = new Set(
      (
        await this.prisma.actor.findMany({
          where: { tenantId: ctx.tenantId, deletedAt: null },
          select: { id: true },
        })
      ).map((item) => item.id),
    );
    for (const item of dto.items) {
      if (!activityIds.has(item.activity_id) || !actorIds.has(item.actor_id)) {
        throw new BadRequestException('Responsabilite hors tenant ou hors processus.');
      }
    }
  }

  private latestAssessment(ctx: TenantAccessContext, processId: string) {
    return this.prisma.raciAssessment.findFirst({
      where: { tenantId: ctx.tenantId, processId },
      orderBy: { generatedAt: 'desc' },
    });
  }

  private async nextVersion(ctx: TenantAccessContext, processId: string) {
    const latest = await this.prisma.raciVersion.findFirst({
      where: { tenantId: ctx.tenantId, processId },
      orderBy: { versionNumber: 'desc' },
    });
    return (latest?.versionNumber ?? 0) + 1;
  }

  private createVersion(
    ctx: TenantAccessContext,
    assessment: {
      id: string;
      processId: string;
      versionNumber: number;
      ruleVersion: string;
      sourceHash: string;
      validationStatus: string;
      matrix: unknown;
      blockingIssues: unknown;
      warnings: unknown;
      recommendations: unknown;
    },
  ) {
    return this.prisma.raciVersion.create({
      data: {
        tenantId: ctx.tenantId,
        processId: assessment.processId,
        assessmentId: assessment.id,
        versionNumber: assessment.versionNumber,
        ruleVersion: assessment.ruleVersion,
        sourceHash: assessment.sourceHash,
        validationStatus: assessment.validationStatus,
        snapshot: this.toJsonValue({
          matrix: assessment.matrix,
          blockingIssues: assessment.blockingIssues,
          warnings: assessment.warnings,
          recommendations: assessment.recommendations,
        }),
        createdBy: ctx.actorUserId,
      },
    });
  }

  private directionScope(ctx: TenantAccessContext) {
    if (ctx.isSupportAccess || this.hasTenantWideRead(ctx)) return {};
    return { directionId: { in: ctx.directionIds } };
  }

  private hasTenantWideRead(ctx: TenantAccessContext) {
    return ctx.tenantRoles.some((role) => ['tenant_admin', 'validator', 'readonly'].includes(role));
  }

  private hasTenantWideWrite(ctx: TenantAccessContext) {
    return (
      ctx.tenantRoles.includes('tenant_admin') || ctx.permissions.includes('manage_directions')
    );
  }

  private assertCanRead(ctx: TenantAccessContext) {
    if (ctx.isSupportAccess) return;
    if (!ctx.tenantRoles.length) throw new ForbiddenException('Lecture refusee.');
  }

  private assertCanWrite(ctx: TenantAccessContext) {
    if (
      ctx.isSupportAccess ||
      !WRITE_PERMISSIONS.some((permission) => ctx.permissions.includes(permission))
    ) {
      throw new ForbiddenException('Ecriture RACI refusee.');
    }
  }

  private assertCanValidate(ctx: TenantAccessContext) {
    if (
      ctx.isSupportAccess ||
      ctx.tenantRoles.includes('consultant') ||
      !VALIDATE_PERMISSIONS.some((permission) => ctx.permissions.includes(permission))
    ) {
      throw new ForbiddenException('Validation RACI refusee.');
    }
  }

  private toJsonValue(value: unknown) {
    return value as Prisma.InputJsonValue;
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
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
