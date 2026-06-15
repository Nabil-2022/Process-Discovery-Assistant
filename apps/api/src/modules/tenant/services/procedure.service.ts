import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AiSuggestionStatus, NotificationType, Prisma } from '../../../generated/prisma';
import { RequestMetadata } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ProcedureSectionUpdateDto,
  ProcedureTransitionDto,
  ProcedureUpdateDto,
} from '../dto/procedure.dto';
import { TenantAccessContext } from '../guards/tenant-access.guard';
import { buildDeterministicProcedure, PROCEDURE_RULE_VERSION } from './procedure-rules';

const WRITE_PERMISSIONS = ['manage_directions', 'create_process', 'update_process_working_copy'];
const APPROVE_PERMISSIONS = [
  'manage_directions',
  'validate_process',
  'approve_process',
  'review_process',
];
const PUBLISH_PERMISSIONS = ['manage_directions', 'publish_process'];

const PROCEDURE_PROCESS_INCLUDE = {
  direction: true,
  ownerActor: true,
  inputs: true,
  outputs: true,
  activities: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
  actorRoles: { include: { actor: true } },
  documents: { include: { document: true } },
  applications: { include: { application: true } },
  kpis: { where: { deletedAt: null } },
  risks: { where: { deletedAt: null }, include: { controls: { include: { control: true } } } },
  moroccoCompliance: true,
  eventLogImports: { orderBy: { createdAt: 'desc' }, take: 10 },
  bpmnModels: { orderBy: { generatedAt: 'desc' }, take: 1 },
  bpmnVersions: { orderBy: { versionNumber: 'desc' }, take: 10 },
  raciAssessments: { orderBy: { generatedAt: 'desc' }, take: 1 },
  raciVersions: { orderBy: { versionNumber: 'desc' }, take: 10 },
  versions: { orderBy: { versionNumber: 'desc' }, take: 20 },
  validations: { orderBy: { createdAt: 'desc' }, take: 20 },
} satisfies Prisma.ProcessInclude;

const PROCEDURE_INCLUDE = {
  sections: { orderBy: { order: 'asc' } },
  approvals: { orderBy: { decidedAt: 'desc' }, take: 20 },
} satisfies Prisma.ProcedureDocumentInclude;

type ProcedureProcess = Prisma.ProcessGetPayload<{ include: typeof PROCEDURE_PROCESS_INCLUDE }>;

@Injectable()
export class ProcedureService {
  constructor(private readonly prisma: PrismaService) {}

  async current(ctx: TenantAccessContext, processId: string, metadata?: RequestMetadata) {
    await this.ensureProcess(ctx, processId);
    const procedure = await this.latestProcedure(ctx, processId);
    if (metadata)
      await this.audit(
        ctx,
        'procedure_viewed',
        'procedure_documents',
        procedure?.id ?? null,
        { process_id: processId },
        metadata,
      );
    return procedure ?? null;
  }

  async generate(ctx: TenantAccessContext, processId: string, metadata: RequestMetadata) {
    this.assertCanWrite(ctx);
    const process = await this.ensureProcess(ctx, processId);
    const generated = buildDeterministicProcedure(process);
    const previous = await this.latestProcedure(ctx, processId);
    const versionNumber =
      previous?.status === 'published'
        ? previous.versionNumber + 1
        : (previous?.versionNumber ?? 1);
    const procedure =
      previous && previous.status !== 'published'
        ? await this.prisma.procedureDocument.update({
            where: { id: previous.id },
            data: {
              reference: generated.reference,
              title: generated.title,
              ruleVersion: generated.ruleVersion,
              sourceHash: generated.sourceHash,
              updatedBy: ctx.actorUserId,
            },
          })
        : await this.prisma.procedureDocument.create({
            data: {
              tenantId: ctx.tenantId,
              processId,
              reference: generated.reference,
              title: generated.title,
              versionNumber,
              ruleVersion: generated.ruleVersion,
              sourceHash: generated.sourceHash,
              documentOwnerId: process.processOwnerActorId,
              confidentialityLevel: 'internal',
              createdBy: ctx.actorUserId,
              updatedBy: ctx.actorUserId,
            },
          });

    for (const item of generated.sections) {
      await this.prisma.procedureSection.upsert({
        where: { procedureId_sectionKey: { procedureId: procedure.id, sectionKey: item.key } },
        create: {
          tenantId: ctx.tenantId,
          procedureId: procedure.id,
          sectionKey: item.key,
          title: item.title,
          order: item.order,
          content: item.content,
          deterministicContent: item.content,
          source: item.source,
          status: item.status,
          updatedBy: ctx.actorUserId,
        },
        update: {
          title: item.title,
          order: item.order,
          content: item.content,
          deterministicContent: item.content,
          source: 'deterministic',
          updatedBy: ctx.actorUserId,
        },
      });
    }
    await Promise.all(
      generated.backlog.map((item) =>
        this.prisma.automationNeed.create({
          data: {
            tenantId: ctx.tenantId,
            processId,
            description: item.title,
            priority: item.priority,
            complexity: 'Moyenne',
            expectedGain: `Backlog procedure: ${item.source}`,
          },
        }),
      ),
    );
    await this.audit(
      ctx,
      'procedure_generated',
      'procedure_documents',
      procedure.id,
      { process_id: processId, source_hash: generated.sourceHash },
      metadata,
    );
    return this.ensureProcedure(ctx, processId, procedure.id);
  }

  async update(
    ctx: TenantAccessContext,
    processId: string,
    dto: ProcedureUpdateDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    const procedure = await this.ensureCurrentEditable(ctx, processId);
    const updated = await this.prisma.procedureDocument.update({
      where: { id: procedure.id },
      data: {
        title: dto.title,
        confidentialityLevel: dto.confidentiality_level,
        updatedBy: ctx.actorUserId,
      },
      include: PROCEDURE_INCLUDE,
    });
    await this.audit(
      ctx,
      'procedure_updated',
      'procedure_documents',
      updated.id,
      { process_id: processId },
      metadata,
    );
    return updated;
  }

  async updateSection(
    ctx: TenantAccessContext,
    processId: string,
    sectionId: string,
    dto: ProcedureSectionUpdateDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    const procedure = await this.ensureCurrentEditable(ctx, processId);
    const section = await this.prisma.procedureSection.findFirst({
      where: { id: sectionId, tenantId: ctx.tenantId, procedureId: procedure.id },
    });
    if (!section) throw new NotFoundException('Section procedure introuvable.');
    const updated = await this.prisma.procedureSection.update({
      where: { id: sectionId },
      data: {
        content: dto.content as Prisma.InputJsonValue,
        manualContent: dto.content as Prisma.InputJsonValue,
        source: 'manual',
        status: dto.status ?? section.status,
        comment: dto.comment,
        updatedBy: ctx.actorUserId,
      },
    });
    await this.audit(
      ctx,
      'procedure_section_updated',
      'procedure_sections',
      sectionId,
      { process_id: processId, section_key: section.sectionKey },
      metadata,
    );
    return updated;
  }

  submitReview(ctx: TenantAccessContext, processId: string, metadata: RequestMetadata) {
    return this.transition(ctx, processId, 'in_review', 'procedure_submitted_review', metadata);
  }

  requestChanges(
    ctx: TenantAccessContext,
    processId: string,
    dto: ProcedureTransitionDto,
    metadata: RequestMetadata,
  ) {
    if (!dto.comment)
      throw new BadRequestException('Commentaire obligatoire pour demande de correction.');
    this.assertCanApprove(ctx);
    return this.transition(
      ctx,
      processId,
      'changes_requested',
      'procedure_changes_requested',
      metadata,
      dto.comment,
    );
  }

  approve(
    ctx: TenantAccessContext,
    processId: string,
    dto: ProcedureTransitionDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanApprove(ctx);
    return this.transition(
      ctx,
      processId,
      'approved',
      'procedure_approved',
      metadata,
      dto.comment,
      true,
    );
  }

  async publish(
    ctx: TenantAccessContext,
    processId: string,
    dto: ProcedureTransitionDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanPublish(ctx);
    const procedure = await this.ensureCurrentEditable(ctx, processId);
    if (procedure.status !== 'approved') throw new ForbiddenException('Procedure non approuvee.');
    const snapshot = await this.snapshot(procedure.id);
    const version = await this.prisma.procedureVersion.create({
      data: {
        tenantId: ctx.tenantId,
        processId,
        procedureId: procedure.id,
        versionNumber: procedure.versionNumber,
        status: 'published',
        snapshot: snapshot as Prisma.InputJsonValue,
        sourceHash: procedure.sourceHash,
        createdBy: ctx.actorUserId,
      },
    });
    const updated = await this.prisma.procedureDocument.update({
      where: { id: procedure.id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        publishedById: ctx.actorUserId,
        updatedBy: ctx.actorUserId,
      },
      include: PROCEDURE_INCLUDE,
    });
    await this.prisma.procedureApproval.create({
      data: {
        tenantId: ctx.tenantId,
        procedureId: procedure.id,
        action: 'published',
        comment: dto.comment,
        decidedBy: ctx.actorUserId,
      },
    });
    await this.audit(
      ctx,
      'procedure_version_created',
      'procedure_versions',
      version.id,
      { process_id: processId },
      metadata,
    );
    await this.audit(
      ctx,
      'procedure_published',
      'procedure_documents',
      procedure.id,
      { process_id: processId },
      metadata,
    );
    await this.notify(ctx, {
      type: NotificationType.PROCEDURE_PUBLISHED,
      title: 'Procedure publiee',
      body: `${updated.title} est publiee.`,
      actionUrl: `/tenant/processes/${processId}/procedure`,
      resourceType: 'procedure_documents',
      resourceId: procedure.id,
    });
    return updated;
  }

  async archive(
    ctx: TenantAccessContext,
    processId: string,
    dto: ProcedureTransitionDto,
    metadata: RequestMetadata,
  ) {
    if (!dto.comment) throw new BadRequestException('Commentaire obligatoire pour archivage.');
    this.assertCanPublish(ctx);
    return this.transition(ctx, processId, 'archived', 'procedure_archived', metadata, dto.comment);
  }

  async versions(ctx: TenantAccessContext, processId: string) {
    await this.ensureProcess(ctx, processId);
    return this.prisma.procedureVersion.findMany({
      where: { tenantId: ctx.tenantId, processId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async version(ctx: TenantAccessContext, processId: string, versionId: string) {
    await this.ensureProcess(ctx, processId);
    const version = await this.prisma.procedureVersion.findFirst({
      where: { id: versionId, tenantId: ctx.tenantId, processId },
    });
    if (!version) throw new NotFoundException('Version procedure introuvable.');
    return version;
  }

  async diff(ctx: TenantAccessContext, processId: string) {
    const current = await this.latestProcedure(ctx, processId);
    const versions = await this.versions(ctx, processId);
    return {
      current_status: current?.status ?? 'none',
      current_source_hash: current?.sourceHash ?? null,
      latest_published_source_hash: versions[0]?.sourceHash ?? null,
      changed: Boolean(current && versions[0] && current.sourceHash !== versions[0].sourceHash),
    };
  }

  async generateAiDraft(ctx: TenantAccessContext, processId: string, metadata: RequestMetadata) {
    this.assertCanWrite(ctx);
    const procedure =
      (await this.latestProcedure(ctx, processId)) ??
      (await this.generate(ctx, processId, metadata));
    const suggestion = await this.prisma.aiSuggestion.create({
      data: {
        tenantId: ctx.tenantId,
        processId,
        suggestionType: 'procedure_draft',
        status: AiSuggestionStatus.PROPOSED,
        content: {
          title: 'Brouillon procedure IA',
          description: 'Brouillon genere par IA, a valider par un responsable habilite.',
          targetEntity: 'procedure',
          procedure_id: procedure.id,
          requiresHumanValidation: true,
        } as Prisma.InputJsonObject,
      },
    });
    await this.audit(
      ctx,
      'procedure_ai_draft_requested',
      'procedure_documents',
      procedure.id,
      { process_id: processId },
      metadata,
    );
    await this.audit(
      ctx,
      'procedure_ai_draft_created',
      'ai_suggestions',
      suggestion.id,
      { process_id: processId },
      metadata,
    );
    await this.notify(ctx, {
      type: NotificationType.AI_SUGGESTION_AVAILABLE,
      title: 'Suggestion IA disponible',
      body: 'Un brouillon de procedure IA est pret pour validation humaine.',
      actionUrl: `/tenant/processes/${processId}/procedure`,
      resourceType: 'ai_suggestions',
      resourceId: suggestion.id,
    });
    return suggestion;
  }

  private async transition(
    ctx: TenantAccessContext,
    processId: string,
    status: string,
    action: string,
    metadata: RequestMetadata,
    comment?: string,
    approved = false,
  ) {
    if (status === 'in_review') this.assertCanWrite(ctx);
    const procedure = await this.ensureCurrentEditable(ctx, processId);
    const updated = await this.prisma.procedureDocument.update({
      where: { id: procedure.id },
      data: {
        status,
        approvedAt: approved ? new Date() : procedure.approvedAt,
        approvedById: approved ? ctx.actorUserId : procedure.approvedById,
        archivedAt: status === 'archived' ? new Date() : procedure.archivedAt,
        updatedBy: ctx.actorUserId,
      },
      include: PROCEDURE_INCLUDE,
    });
    await this.prisma.procedureApproval.create({
      data: {
        tenantId: ctx.tenantId,
        procedureId: procedure.id,
        action: status,
        comment,
        decidedBy: ctx.actorUserId,
      },
    });
    await this.audit(
      ctx,
      action,
      'procedure_documents',
      procedure.id,
      { process_id: processId, comment: comment ?? null },
      metadata,
    );
    if (status === 'changes_requested') {
      await this.notify(ctx, {
        type: NotificationType.CHANGES_REQUESTED,
        title: 'Corrections demandees',
        body: comment ?? 'Des corrections sont demandees sur la procedure.',
        actionUrl: `/tenant/processes/${processId}/procedure`,
        resourceType: 'procedure_documents',
        resourceId: procedure.id,
      });
    }
    return updated;
  }

  private async ensureProcess(ctx: TenantAccessContext, id: string): Promise<ProcedureProcess> {
    this.assertCanRead(ctx);
    const process = await this.prisma.process.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null, ...this.directionScope(ctx) },
      include: PROCEDURE_PROCESS_INCLUDE,
    });
    if (!process) throw new NotFoundException('Processus introuvable.');
    return process;
  }

  private async latestProcedure(ctx: TenantAccessContext, processId: string) {
    await this.ensureProcess(ctx, processId);
    return this.prisma.procedureDocument.findFirst({
      where: { tenantId: ctx.tenantId, processId, deletedAt: null },
      orderBy: { versionNumber: 'desc' },
      include: PROCEDURE_INCLUDE,
    });
  }

  private async ensureProcedure(ctx: TenantAccessContext, processId: string, procedureId: string) {
    const procedure = await this.prisma.procedureDocument.findFirst({
      where: { id: procedureId, tenantId: ctx.tenantId, processId, deletedAt: null },
      include: PROCEDURE_INCLUDE,
    });
    if (!procedure) throw new NotFoundException('Procedure introuvable.');
    return procedure;
  }

  private async ensureCurrentEditable(ctx: TenantAccessContext, processId: string) {
    const procedure = await this.latestProcedure(ctx, processId);
    if (!procedure) throw new NotFoundException('Procedure introuvable.');
    if (procedure.status === 'published') throw new ForbiddenException('Version publiee immuable.');
    if (procedure.status === 'archived') throw new ForbiddenException('Procedure archivee.');
    return procedure;
  }

  private async snapshot(procedureId: string) {
    const procedure = await this.prisma.procedureDocument.findFirst({
      where: { id: procedureId },
      include: PROCEDURE_INCLUDE,
    });
    if (!procedure) throw new NotFoundException('Procedure introuvable.');
    return procedure;
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

  private assertCanWrite(ctx: TenantAccessContext) {
    if (ctx.isSupportAccess || ctx.tenantRoles.includes('readonly'))
      throw new ForbiddenException('Ecriture procedure refusee.');
    if (!WRITE_PERMISSIONS.some((permission) => ctx.permissions.includes(permission)))
      throw new ForbiddenException('Ecriture procedure refusee.');
  }

  private assertCanApprove(ctx: TenantAccessContext) {
    if (
      ctx.tenantRoles.includes('consultant') ||
      !APPROVE_PERMISSIONS.some((permission) => ctx.permissions.includes(permission))
    )
      throw new ForbiddenException('Validation procedure refusee.');
  }

  private assertCanPublish(ctx: TenantAccessContext) {
    if (
      ctx.tenantRoles.includes('consultant') ||
      !PUBLISH_PERMISSIONS.some((permission) => ctx.permissions.includes(permission))
    )
      throw new ForbiddenException('Publication procedure refusee.');
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
        severity: payload.type === NotificationType.CHANGES_REQUESTED ? 'warning' : 'info',
        actionUrl: payload.actionUrl,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
      },
    });
  }
}
