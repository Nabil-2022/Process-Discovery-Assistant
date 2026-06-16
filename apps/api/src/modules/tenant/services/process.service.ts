import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';

import {
  DocumentStatus,
  NotificationType,
  Prisma,
  ProcessStatus,
  RiskLevel,
  SnapshotType,
} from '../../../generated/prisma';
import { RequestMetadata } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ActivityDto,
  ActorDto,
  ApplicationDto,
  AutomationNeedDto,
  ControlDto,
  CreateProcessDto,
  DocumentDto,
  KpiDto,
  ListProcessesQueryDto,
  PainPointDto,
  ReorderActivitiesDto,
  ResponsibilitiesDto,
  RiskDto,
  SubmitProcessDto,
  UpdateProcessDto,
  WizardStepDto,
} from '../dto/process.dto';
import { TenantAccessContext } from '../guards/tenant-access.guard';
import {
  COMPLETENESS_PROCESS_INCLUDE,
  CompletenessProcess,
  CompletenessService,
} from './completeness.service';

const WRITE_PERMISSIONS = ['manage_directions', 'create_process', 'update_process_working_copy'];

@Injectable()
export class ProcessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly completenessService: CompletenessService,
  ) {}

  async listProcesses(ctx: TenantAccessContext, query: ListProcessesQueryDto) {
    this.assertCanRead(ctx);
    return this.prisma.process.findMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        ...(query.direction_id ? { directionId: query.direction_id } : this.directionScope(ctx)),
        ...(query.status ? { status: query.status as ProcessStatus } : {}),
        ...(query.is_user_facing_process !== undefined ||
        query.law_55_19_applicable !== undefined ||
        query.simplification_priority ||
        query.digitalization_priority
          ? {
              moroccoCompliance: {
                ...(query.is_user_facing_process !== undefined
                  ? { isUserFacingProcess: query.is_user_facing_process }
                  : {}),
                ...(query.law_55_19_applicable !== undefined
                  ? { law5519Applicable: query.law_55_19_applicable }
                  : {}),
                ...(query.simplification_priority
                  ? { simplificationPriority: query.simplification_priority }
                  : {}),
                ...(query.digitalization_priority
                  ? { digitalizationPriority: query.digitalization_priority }
                  : {}),
              },
            }
          : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        direction: true,
        category: true,
        ownerActor: true,
        moroccoCompliance: true,
        raciAssessments: { orderBy: { generatedAt: 'desc' }, take: 1 },
        assessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
      },
    });
  }

  async createProcess(ctx: TenantAccessContext, dto: CreateProcessDto, metadata: RequestMetadata) {
    this.assertCanWrite(ctx);
    await this.assertDirectionAllowed(ctx, dto.direction_id);
    await this.ensureDirection(ctx, dto.direction_id);
    if (dto.category_id) await this.ensureCategory(ctx, dto.category_id);
    if (dto.owner_actor_id) await this.ensureActor(ctx, dto.owner_actor_id);

    const process = await this.prisma.process.create({
      data: {
        tenantId: ctx.tenantId,
        directionId: dto.direction_id,
        categoryId: dto.category_id,
        processOwnerActorId: dto.owner_actor_id,
        name: dto.name,
        code: dto.code,
        description: dto.description,
        createdBy: ctx.actorUserId,
        updatedBy: ctx.actorUserId,
      },
    });
    await this.audit(ctx, 'process_created', 'processes', process.id, { name: dto.name }, metadata);
    return this.getProcess(ctx, process.id);
  }

  async getProcess(ctx: TenantAccessContext, id: string) {
    return this.ensureProcess(ctx, id, true);
  }

  async updateProcess(
    ctx: TenantAccessContext,
    id: string,
    dto: UpdateProcessDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    const process = await this.ensureProcess(ctx, id);
    this.assertLock(process.lockVersion, dto.lock_version);
    if (dto.direction_id) {
      await this.assertDirectionAllowed(ctx, dto.direction_id);
      await this.ensureDirection(ctx, dto.direction_id);
    }
    if (dto.category_id) await this.ensureCategory(ctx, dto.category_id);
    if (dto.owner_actor_id) await this.ensureActor(ctx, dto.owner_actor_id);

    const updated = await this.prisma.process.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        directionId: dto.direction_id,
        categoryId: dto.category_id,
        processOwnerActorId: dto.owner_actor_id,
        description: dto.description,
        objective: dto.objective,
        scope: dto.scope,
        triggerEvent: dto.trigger_event,
        updatedBy: ctx.actorUserId,
        lockVersion: { increment: 1 },
      },
    });
    await this.refreshCompleteness(ctx, id);
    await this.audit(
      ctx,
      'process_updated',
      'processes',
      id,
      { lock_version: updated.lockVersion },
      metadata,
    );
    return this.getProcess(ctx, id);
  }

  async deleteProcess(ctx: TenantAccessContext, id: string, metadata: RequestMetadata) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, id);
    await this.prisma.process.update({
      where: { id },
      data: { deletedAt: new Date(), status: ProcessStatus.ARCHIVED, updatedBy: ctx.actorUserId },
    });
    await this.audit(ctx, 'process_deleted', 'processes', id, {}, metadata);
  }

  async getWizard(ctx: TenantAccessContext, id: string) {
    const process = await this.getProcess(ctx, id);
    const completeness = await this.calculateCompleteness(ctx, id);
    return { process, steps: WIZARD_STEPS, completeness };
  }

  async saveWizardStep(
    ctx: TenantAccessContext,
    id: string,
    step: number,
    dto: WizardStepDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    const process = await this.ensureProcess(ctx, id);
    this.assertLock(process.lockVersion, dto.lock_version);
    if (step < 1 || step > 11) throw new NotFoundException('Etape wizard introuvable.');

    await this.applyStepPayload(ctx, id, step, dto.payload);
    const updated = await this.prisma.process.update({
      where: { id },
      data: { lockVersion: { increment: 1 }, updatedBy: ctx.actorUserId },
    });
    const completeness = await this.refreshCompleteness(ctx, id);
    await this.audit(
      ctx,
      'wizard_step_saved',
      'processes',
      id,
      { step, lock_version: updated.lockVersion, score: completeness.score },
      metadata,
    );
    return { lock_version: updated.lockVersion, saved_at: updated.updatedAt, completeness };
  }

  async submitProcess(
    ctx: TenantAccessContext,
    id: string,
    dto: SubmitProcessDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    const process = await this.ensureProcess(ctx, id, true);
    this.assertLock(process.lockVersion, dto.lock_version);
    await this.audit(ctx, 'process_submit_attempted', 'processes', id, {}, metadata);
    const completeness = this.completenessService.calculate(process as CompletenessProcess);
    if (!completeness.canSubmit) {
      await this.audit(ctx, 'process_submit_blocked', 'processes', id, completeness, metadata);
      throw new ForbiddenException({
        message: 'Soumission impossible: score insuffisant ou blocages.',
        score: completeness.score,
        blockingIssues: completeness.blockingIssues,
      });
    }
    const snapshotHash = createHash('sha256')
      .update(JSON.stringify({ processId: id, lockVersion: process.lockVersion, completeness }))
      .digest('hex');
    const snapshot = await this.prisma.processSnapshot.create({
      data: {
        tenantId: ctx.tenantId,
        processId: id,
        snapshotType: SnapshotType.SUBMITTED,
        payload: this.toJsonObject({ process, completeness, comment: dto.comment ?? null }),
        snapshotHash,
        createdBy: ctx.actorUserId,
      },
    });
    await this.completenessService.persist(
      ctx,
      process as CompletenessProcess,
      completeness,
      snapshotHash,
    );
    await this.prisma.process.update({
      where: { id },
      data: {
        status: ProcessStatus.SUBMITTED,
        lastSubmittedSnapshotId: snapshot.id,
        submissionNumber: { increment: 1 },
        lockVersion: { increment: 1 },
      },
    });
    await this.audit(
      ctx,
      'process_submitted',
      'processes',
      id,
      { snapshot_id: snapshot.id },
      metadata,
    );
    await this.notify(ctx, {
      type: NotificationType.PROCESS_SUBMITTED,
      title: 'Processus soumis',
      body: `${process.name} est soumis pour revue.`,
      actionUrl: `/tenant/processes/${id}`,
      resourceType: 'processes',
      resourceId: id,
    });
    return this.getProcess(ctx, id);
  }

  async calculateCompleteness(ctx: TenantAccessContext, id: string) {
    const process = (await this.ensureProcess(ctx, id, true)) as CompletenessProcess;
    return this.completenessService.calculate(process);
  }

  async recalculateCompleteness(ctx: TenantAccessContext, id: string, metadata: RequestMetadata) {
    this.assertCanWrite(ctx);
    const process = (await this.ensureProcess(ctx, id, true)) as CompletenessProcess;
    const completeness = this.completenessService.calculate(process);
    await this.completenessService.persist(ctx, process, completeness);
    await this.audit(
      ctx,
      'completeness_recalculated',
      'processes',
      id,
      { score: completeness.score, canSubmit: completeness.canSubmit },
      metadata,
    );
    return completeness;
  }

  async qualityCheck(ctx: TenantAccessContext, id: string) {
    return this.calculateCompleteness(ctx, id);
  }

  async blockingIssues(ctx: TenantAccessContext, id: string) {
    const completeness = await this.calculateCompleteness(ctx, id);
    return {
      score: completeness.score,
      canSubmit: completeness.canSubmit,
      blockingIssues: completeness.blockingIssues,
      items: completeness.blockingIssueDetails,
    };
  }

  async warnings(ctx: TenantAccessContext, id: string) {
    const completeness = await this.calculateCompleteness(ctx, id);
    return {
      score: completeness.score,
      warnings: completeness.warnings,
      items: completeness.warningDetails,
      recommendations: completeness.recommendations,
    };
  }

  async createActivity(
    ctx: TenantAccessContext,
    processId: string,
    dto: ActivityDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    const count = await this.prisma.processActivity.count({
      where: { tenantId: ctx.tenantId, processId },
    });
    const activity = await this.prisma.processActivity.create({
      data: {
        tenantId: ctx.tenantId,
        processId,
        name: dto.name,
        description: dto.description,
        activityType: dto.activity_type,
        inputText: dto.input_text,
        outputText: dto.output_text,
        condition: dto.condition,
        duration: dto.duration,
        isAutomated: dto.is_automated ?? false,
        sortOrder: count + 1,
        createdBy: ctx.actorUserId,
        updatedBy: ctx.actorUserId,
      },
    });
    await this.refreshCompleteness(ctx, processId);
    await this.audit(ctx, 'activity_created', 'process_activities', activity.id, {}, metadata);
    return activity;
  }

  async listActivities(ctx: TenantAccessContext, processId: string) {
    await this.ensureProcess(ctx, processId);
    return this.prisma.processActivity.findMany({
      where: { tenantId: ctx.tenantId, processId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: { actorRoles: true },
    });
  }

  async updateActivity(
    ctx: TenantAccessContext,
    processId: string,
    activityId: string,
    dto: ActivityDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    const activity = await this.prisma.processActivity.update({
      where: { id: activityId },
      data: {
        name: dto.name,
        description: dto.description,
        activityType: dto.activity_type,
        inputText: dto.input_text,
        outputText: dto.output_text,
        condition: dto.condition,
        duration: dto.duration,
        isAutomated: dto.is_automated,
        updatedBy: ctx.actorUserId,
        lockVersion: { increment: 1 },
      },
    });
    await this.refreshCompleteness(ctx, processId);
    await this.audit(ctx, 'activity_updated', 'process_activities', activityId, {}, metadata);
    return activity;
  }

  async deleteActivity(
    ctx: TenantAccessContext,
    processId: string,
    activityId: string,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    await this.prisma.processActivity.update({
      where: { id: activityId },
      data: { deletedAt: new Date() },
    });
    await this.refreshCompleteness(ctx, processId);
    await this.audit(ctx, 'activity_deleted', 'process_activities', activityId, {}, metadata);
  }

  async reorderActivities(
    ctx: TenantAccessContext,
    processId: string,
    dto: ReorderActivitiesDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    await this.prisma.$transaction(
      dto.activity_ids.map((id, index) =>
        this.prisma.processActivity.update({ where: { id }, data: { sortOrder: index + 1 } }),
      ),
    );
    await this.audit(
      ctx,
      'activity_reordered',
      'processes',
      processId,
      { activity_ids: dto.activity_ids },
      metadata,
    );
  }

  async duplicateActivity(
    ctx: TenantAccessContext,
    processId: string,
    activityId: string,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    const source = await this.prisma.processActivity.findFirstOrThrow({
      where: { id: activityId, tenantId: ctx.tenantId, processId },
    });
    const count = await this.prisma.processActivity.count({
      where: { tenantId: ctx.tenantId, processId },
    });
    const duplicate = await this.prisma.processActivity.create({
      data: {
        tenantId: ctx.tenantId,
        processId,
        name: `${source.name} copie`,
        description: source.description,
        activityType: source.activityType,
        inputText: source.inputText,
        outputText: source.outputText,
        condition: source.condition,
        duration: source.duration,
        isAutomated: source.isAutomated,
        sortOrder: count + 1,
        createdBy: ctx.actorUserId,
        updatedBy: ctx.actorUserId,
      },
    });
    await this.audit(
      ctx,
      'activity_created',
      'process_activities',
      duplicate.id,
      { duplicated_from: activityId },
      metadata,
    );
    return duplicate;
  }

  async getActors(ctx: TenantAccessContext, processId: string) {
    await this.ensureProcess(ctx, processId);
    return this.prisma.actor.findMany({ where: { tenantId: ctx.tenantId, deletedAt: null } });
  }

  async createActor(
    ctx: TenantAccessContext,
    processId: string,
    dto: ActorDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    const actor = await this.prisma.actor.create({
      data: {
        tenantId: ctx.tenantId,
        directionId: dto.direction_id,
        name: dto.name,
        title: dto.title,
        email: dto.email,
        isPlatformUser: dto.is_platform_user ?? false,
      },
    });
    await this.audit(ctx, 'actor_created', 'actors', actor.id, {}, metadata);
    return actor;
  }

  async updateActor(ctx: TenantAccessContext, processId: string, actorId: string, dto: ActorDto) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    return this.prisma.actor.update({
      where: { id: actorId },
      data: { directionId: dto.direction_id, name: dto.name, title: dto.title, email: dto.email },
    });
  }

  async deleteActor(ctx: TenantAccessContext, processId: string, actorId: string) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    await this.prisma.actor.update({ where: { id: actorId }, data: { deletedAt: new Date() } });
  }

  async updateResponsibilities(
    ctx: TenantAccessContext,
    processId: string,
    dto: ResponsibilitiesDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    await this.prisma.$transaction([
      this.prisma.processActorRole.deleteMany({ where: { tenantId: ctx.tenantId, processId } }),
      ...dto.items.map((item) =>
        this.prisma.processActorRole.create({
          data: {
            tenantId: ctx.tenantId,
            processId,
            activityId: item.activity_id,
            actorId: item.actor_id,
            raciRole: item.raci_role,
            notes: item.notes,
          },
        }),
      ),
    ]);
    await this.refreshCompleteness(ctx, processId);
    await this.audit(
      ctx,
      'responsibility_updated',
      'process_actor_roles',
      processId,
      { count: dto.items.length },
      metadata,
    );
    return this.calculateCompleteness(ctx, processId);
  }

  async listRelation(ctx: TenantAccessContext, processId: string, kind: RelationKind) {
    await this.ensureProcess(ctx, processId);
    return this.findManyRelation(ctx, processId, kind);
  }

  async createRelation(
    ctx: TenantAccessContext,
    processId: string,
    kind: RelationKind,
    dto: unknown,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    const result = await this.createRelationRecord(
      ctx,
      processId,
      kind,
      dto as Record<string, unknown>,
    );
    await this.refreshCompleteness(ctx, processId);
    await this.audit(
      ctx,
      relationAuditAction(kind, 'created'),
      relationResource(kind),
      result.id,
      {},
      metadata,
    );
    return result;
  }

  async updateRelation(
    ctx: TenantAccessContext,
    processId: string,
    kind: RelationKind,
    id: string,
    dto: unknown,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    return this.updateRelationRecord(ctx, processId, kind, id, dto as Record<string, unknown>);
  }

  async deleteRelation(
    ctx: TenantAccessContext,
    processId: string,
    kind: RelationKind,
    id: string,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    await this.deleteRelationRecord(ctx, processId, kind, id);
  }

  private async applyStepPayload(
    ctx: TenantAccessContext,
    processId: string,
    step: number,
    payload: Record<string, unknown>,
  ) {
    if (step === 1 || step === 2) {
      await this.updateProcessFields(ctx, processId, payload as UpdateProcessDto);
    }
    if (step === 2) {
      await this.replaceInputsOutputs(ctx, processId, payload);
    }
    if (step === 3 && Array.isArray(payload.activities)) {
      for (const item of payload.activities as ActivityDto[])
        await this.createActivity(ctx, processId, item, {});
    }
    if (step === 4 && Array.isArray(payload.responsibilities)) {
      await this.updateResponsibilities(
        ctx,
        processId,
        { items: payload.responsibilities as never[] },
        {},
      );
    }
  }

  private async updateProcessFields(
    ctx: TenantAccessContext,
    processId: string,
    dto: UpdateProcessDto,
  ) {
    if (dto.direction_id) {
      await this.assertDirectionAllowed(ctx, dto.direction_id);
      await this.ensureDirection(ctx, dto.direction_id);
    }
    if (dto.category_id) await this.ensureCategory(ctx, dto.category_id);
    if (dto.owner_actor_id) await this.ensureActor(ctx, dto.owner_actor_id);
    await this.prisma.process.update({
      where: { id: processId },
      data: {
        name: dto.name,
        code: dto.code,
        directionId: dto.direction_id,
        categoryId: dto.category_id,
        processOwnerActorId: dto.owner_actor_id,
        description: dto.description,
        objective: dto.objective,
        scope: dto.scope,
        triggerEvent: dto.trigger_event,
        updatedBy: ctx.actorUserId,
      },
    });
  }

  private async replaceInputsOutputs(
    ctx: TenantAccessContext,
    processId: string,
    payload: Record<string, unknown>,
  ) {
    const inputs = this.normalizeNamedItems(payload.inputs, payload.input_name ?? payload.input);
    const outputs = this.normalizeNamedItems(
      payload.outputs,
      payload.output_name ?? payload.output,
    );
    const actions = [];
    if (inputs.length) {
      actions.push(
        this.prisma.processInput.deleteMany({ where: { tenantId: ctx.tenantId, processId } }),
      );
      actions.push(
        ...inputs.map((item, index) =>
          this.prisma.processInput.create({
            data: {
              tenantId: ctx.tenantId,
              processId,
              name: item.name,
              description: item.description,
              source: item.source,
              sortOrder: index + 1,
            },
          }),
        ),
      );
    }
    if (outputs.length) {
      actions.push(
        this.prisma.processOutput.deleteMany({ where: { tenantId: ctx.tenantId, processId } }),
      );
      actions.push(
        ...outputs.map((item, index) =>
          this.prisma.processOutput.create({
            data: {
              tenantId: ctx.tenantId,
              processId,
              name: item.name,
              description: item.description,
              destination: item.destination,
              sortOrder: index + 1,
            },
          }),
        ),
      );
    }
    if (actions.length) await this.prisma.$transaction(actions);
  }

  private normalizeNamedItems(value: unknown, fallback: unknown) {
    const rawItems = Array.isArray(value) ? value : fallback ? [fallback] : [];
    return rawItems
      .map((item) => {
        if (typeof item === 'string') return { name: item.trim() };
        if (!item || typeof item !== 'object') return null;
        const record = item as Record<string, unknown>;
        const name = String(record.name ?? '').trim();
        if (!name) return null;
        return {
          name,
          description: record.description ? String(record.description) : undefined,
          source: record.source ? String(record.source) : undefined,
          destination: record.destination ? String(record.destination) : undefined,
        };
      })
      .filter(
        (
          item,
        ): item is { name: string; description?: string; source?: string; destination?: string } =>
          Boolean(item),
      );
  }

  private async refreshCompleteness(ctx: TenantAccessContext, processId: string) {
    const process = (await this.ensureProcess(ctx, processId, true)) as CompletenessProcess;
    const completeness = this.completenessService.calculate(process);
    await this.completenessService.persist(ctx, process, completeness);
    return completeness;
  }

  private async ensureProcess(ctx: TenantAccessContext, id: string, include = false) {
    const process = await this.prisma.process.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null, ...this.directionScope(ctx) },
      include: include ? COMPLETENESS_PROCESS_INCLUDE : undefined,
    });
    if (!process) throw new NotFoundException('Processus introuvable.');
    return process;
  }

  private async ensureDirection(ctx: TenantAccessContext, directionId: string) {
    const direction = await this.prisma.direction.findFirst({
      where: { id: directionId, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!direction) throw new NotFoundException('Direction introuvable.');
  }

  private async ensureCategory(ctx: TenantAccessContext, categoryId: string) {
    const category = await this.prisma.processCategory.findFirst({
      where: { id: categoryId, tenantId: ctx.tenantId },
    });
    if (!category) throw new NotFoundException('Categorie introuvable.');
  }

  private async ensureActor(ctx: TenantAccessContext, actorId: string) {
    const actor = await this.prisma.actor.findFirst({
      where: { id: actorId, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!actor) throw new NotFoundException('Acteur introuvable.');
  }

  private async assertDirectionAllowed(ctx: TenantAccessContext, directionId: string) {
    if (this.hasTenantWideWrite(ctx)) return;
    if (!ctx.directionIds.includes(directionId))
      throw new ForbiddenException('Direction hors perimetre.');
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
    if (process.env.LOCAL_AUTH_BYPASS === 'true') return;
    if (
      ctx.isSupportAccess ||
      !WRITE_PERMISSIONS.some((permission) => ctx.permissions.includes(permission))
    ) {
      throw new ForbiddenException('Ecriture processus refusee.');
    }
  }

  private assertLock(current: number, provided?: number) {
    if (process.env.LOCAL_AUTH_BYPASS === 'true') return;
    if (provided && provided !== current)
      throw new ConflictException('Conflit de modification detecte.');
  }

  private toJsonObject(value: Record<string, unknown>) {
    return value as Prisma.InputJsonObject;
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
        metadata: this.toJsonObject(metadataValue),
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

  private async findManyRelation(ctx: TenantAccessContext, processId: string, kind: RelationKind) {
    if (kind === 'documents')
      return this.prisma.processDocument.findMany({
        where: { tenantId: ctx.tenantId, processId },
        include: { document: true },
      });
    if (kind === 'applications')
      return this.prisma.processApplication.findMany({
        where: { tenantId: ctx.tenantId, processId },
        include: { application: true },
      });
    if (kind === 'kpis')
      return this.prisma.kpi.findMany({
        where: { tenantId: ctx.tenantId, processId, deletedAt: null },
      });
    if (kind === 'risks')
      return this.prisma.risk.findMany({
        where: { tenantId: ctx.tenantId, processId, deletedAt: null },
        include: { controls: { include: { control: true } } },
      });
    if (kind === 'pain-points')
      return this.prisma.painPoint.findMany({ where: { tenantId: ctx.tenantId, processId } });
    return this.prisma.automationNeed.findMany({ where: { tenantId: ctx.tenantId, processId } });
  }

  private async createRelationRecord(
    ctx: TenantAccessContext,
    processId: string,
    kind: RelationKind,
    dto: Record<string, unknown>,
  ) {
    if (kind === 'documents') {
      const document = await this.prisma.document.create({
        data: {
          tenantId: ctx.tenantId,
          title: String(dto.title),
          documentType: dto.document_type as string,
          reference: dto.reference as string,
          version: dto.version as string,
          status: DocumentStatus.DRAFT,
        },
      });
      await this.prisma.processDocument.create({
        data: {
          tenantId: ctx.tenantId,
          processId,
          documentId: document.id,
          usageType: dto.usage_type as string,
        },
      });
      return document;
    }
    if (kind === 'applications') {
      const app = await this.prisma.application.create({
        data: {
          tenantId: ctx.tenantId,
          name: String(dto.name),
          code: dto.code as string,
          owner: dto.owner as string,
          criticality: dto.criticality as RiskLevel,
        },
      });
      await this.prisma.processApplication.create({
        data: {
          tenantId: ctx.tenantId,
          processId,
          applicationId: app.id,
          usage: dto.usage as string,
        },
      });
      return app;
    }
    if (kind === 'kpis')
      return this.prisma.kpi.create({
        data: {
          tenantId: ctx.tenantId,
          processId,
          name: String(dto.name),
          objective: dto.objective as string,
          definition: dto.definition as string,
          formula: dto.formula as string,
          unit: dto.unit as string,
        },
      });
    if (kind === 'risks')
      return this.prisma.risk.create({
        data: {
          tenantId: ctx.tenantId,
          processId,
          description: String(dto.description),
          category: dto.category as string,
          probability: dto.probability as number,
          impact: dto.impact as number,
          inherentLevel: this.riskLevel(dto.probability as number, dto.impact as number),
        },
      });
    if (kind === 'pain-points')
      return this.prisma.painPoint.create({
        data: {
          tenantId: ctx.tenantId,
          processId,
          description: String(dto.description),
          frequency: dto.frequency as string,
          impact: dto.impact as string,
        },
      });
    return this.prisma.automationNeed.create({
      data: {
        tenantId: ctx.tenantId,
        processId,
        activityId: dto.activity_id as string,
        description: String(dto.description),
        expectedGain: dto.expected_gain as string,
        complexity: dto.complexity as string,
        priority: dto.priority as string,
      },
    });
  }

  private async updateRelationRecord(
    ctx: TenantAccessContext,
    processId: string,
    kind: RelationKind,
    id: string,
    dto: Record<string, unknown>,
  ) {
    if (kind === 'documents') {
      const link = await this.prisma.processDocument.findFirst({
        where: { id, tenantId: ctx.tenantId, processId },
      });
      if (!link) throw new NotFoundException('Document introuvable pour ce processus.');
      return this.prisma.document.update({
        where: { id: link.documentId },
        data: {
          title: dto.title as string,
          documentType: dto.document_type as string,
          reference: dto.reference as string,
          version: dto.version as string,
        },
      });
    }
    if (kind === 'applications') {
      const link = await this.prisma.processApplication.findFirst({
        where: { id, tenantId: ctx.tenantId, processId },
      });
      if (!link) throw new NotFoundException('Application introuvable pour ce processus.');
      return this.prisma.application.update({
        where: { id: link.applicationId },
        data: {
          name: dto.name as string,
          code: dto.code as string,
          owner: dto.owner as string,
          criticality: dto.criticality as RiskLevel,
        },
      });
    }
    if (kind === 'kpis')
      return this.prisma.kpi.update({
        where: { id },
        data: {
          name: dto.name as string,
          objective: dto.objective as string,
          definition: dto.definition as string,
          formula: dto.formula as string,
          unit: dto.unit as string,
        },
      });
    if (kind === 'risks')
      return this.prisma.risk.update({
        where: { id },
        data: {
          description: dto.description as string,
          category: dto.category as string,
          probability: dto.probability as number,
          impact: dto.impact as number,
          inherentLevel: this.riskLevel(dto.probability as number, dto.impact as number),
        },
      });
    if (kind === 'pain-points')
      return this.prisma.painPoint.update({
        where: { id },
        data: {
          description: dto.description as string,
          frequency: dto.frequency as string,
          impact: dto.impact as string,
        },
      });
    return this.prisma.automationNeed.update({
      where: { id },
      data: {
        description: dto.description as string,
        expectedGain: dto.expected_gain as string,
        complexity: dto.complexity as string,
        priority: dto.priority as string,
      },
    });
  }

  private async deleteRelationRecord(
    ctx: TenantAccessContext,
    processId: string,
    kind: RelationKind,
    id: string,
  ) {
    if (kind === 'documents') {
      const link = await this.prisma.processDocument.findFirst({
        where: { id, tenantId: ctx.tenantId, processId },
      });
      if (!link) throw new NotFoundException('Document introuvable pour ce processus.');
      await this.prisma.processDocument.delete({ where: { id } });
      return this.prisma.document.update({
        where: { id: link.documentId },
        data: { deletedAt: new Date() },
      });
    }
    if (kind === 'applications') {
      const link = await this.prisma.processApplication.findFirst({
        where: { id, tenantId: ctx.tenantId, processId },
      });
      if (!link) throw new NotFoundException('Application introuvable pour ce processus.');
      await this.prisma.processApplication.delete({ where: { id } });
      return this.prisma.application.update({
        where: { id: link.applicationId },
        data: { deletedAt: new Date() },
      });
    }
    if (kind === 'kpis')
      return this.prisma.kpi.update({ where: { id }, data: { deletedAt: new Date() } });
    if (kind === 'risks')
      return this.prisma.risk.update({ where: { id }, data: { deletedAt: new Date() } });
    if (kind === 'pain-points') return this.prisma.painPoint.delete({ where: { id } });
    return this.prisma.automationNeed.delete({ where: { id } });
  }

  async createControl(
    ctx: TenantAccessContext,
    processId: string,
    riskId: string,
    dto: ControlDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    const control = await this.prisma.control.create({
      data: {
        tenantId: ctx.tenantId,
        name: dto.name,
        description: dto.description,
        controlType: dto.control_type,
      },
    });
    await this.prisma.riskControl.create({
      data: { tenantId: ctx.tenantId, riskId, controlId: control.id },
    });
    await this.refreshCompleteness(ctx, processId);
    await this.audit(ctx, 'control_created', 'controls', control.id, { risk_id: riskId }, metadata);
    return control;
  }

  async updateControl(
    ctx: TenantAccessContext,
    processId: string,
    controlId: string,
    dto: ControlDto,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    return this.prisma.control.update({
      where: { id: controlId },
      data: { name: dto.name, description: dto.description, controlType: dto.control_type },
    });
  }

  async deleteControl(ctx: TenantAccessContext, processId: string, controlId: string) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    return this.prisma.control.update({
      where: { id: controlId },
      data: { deletedAt: new Date() },
    });
  }

  private riskLevel(probability = 1, impact = 1) {
    const score = probability * impact;
    if (score >= 20) return RiskLevel.CRITICAL;
    if (score >= 12) return RiskLevel.HIGH;
    if (score >= 6) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }
}

export const WIZARD_STEPS = [
  'Identification',
  'Description',
  'Activites',
  'Acteurs et responsabilites',
  'Documents',
  'Applications',
  'KPI',
  'Risques et controles',
  'Points de douleur',
  "Besoins d'automatisation",
  'Resume et soumission',
];

export type RelationKind =
  | 'documents'
  | 'applications'
  | 'kpis'
  | 'risks'
  | 'pain-points'
  | 'automation-needs';

function relationResource(kind: RelationKind) {
  return kind.replace('-', '_');
}

function relationAuditAction(kind: RelationKind, action: 'created') {
  const map: Record<RelationKind, string> = {
    documents: 'document_linked',
    applications: 'application_linked',
    kpis: 'kpi_created',
    risks: 'risk_created',
    'pain-points': 'pain_point_created',
    'automation-needs': 'automation_need_created',
  };
  return map[kind] ?? action;
}
