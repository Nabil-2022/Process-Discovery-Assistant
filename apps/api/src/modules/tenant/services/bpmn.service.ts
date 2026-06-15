import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, RaciRole } from '../../../generated/prisma';
import { RequestMetadata } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { BpmnValidationDto } from '../dto/bpmn.dto';
import { TenantAccessContext } from '../guards/tenant-access.guard';
import { buildBpmnJson, BPMN_RULE_VERSION, bpmnSourceHash } from './bpmn-rules';
import { BpmnResult, BpmnValidationStatus } from './bpmn.types';
import { BpmnXmlBuilder } from './bpmn-xml.builder';

const WRITE_PERMISSIONS = ['manage_directions', 'create_process', 'update_process_working_copy'];
const VALIDATE_PERMISSIONS = ['manage_directions', 'validate_process'];

const BPMN_PROCESS_INCLUDE = {
  inputs: true,
  outputs: { orderBy: { sortOrder: 'asc' } },
  activities: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
  transitions: { orderBy: { sortOrder: 'asc' } },
  actorRoles: { include: { actor: true } },
  applications: { include: { application: true } },
  documents: { include: { document: true } },
  moroccoCompliance: true,
  kpis: { where: { deletedAt: null } },
  risks: { where: { deletedAt: null }, include: { controls: { include: { control: true } } } },
  eventLogImports: { take: 1 },
} satisfies Prisma.ProcessInclude;

@Injectable()
export class BpmnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xmlBuilder: BpmnXmlBuilder,
  ) {}

  async getBpmn(ctx: TenantAccessContext, processId: string) {
    const process = await this.ensureProcess(ctx, processId);
    const latest = await this.latestModel(ctx, processId);
    if (latest) return this.modelToResult(latest);
    return this.calculate(ctx, process, 'DRAFT', 1);
  }

  async generate(ctx: TenantAccessContext, processId: string, metadata: RequestMetadata) {
    this.assertCanWrite(ctx);
    const process = await this.ensureProcess(ctx, processId);
    const result = this.calculate(ctx, process, 'DRAFT', await this.nextVersion(ctx, processId));
    const saved = await this.persist(ctx, processId, result, 'bpmn_generated', metadata);
    return this.modelToResult(saved);
  }

  async recalculate(ctx: TenantAccessContext, processId: string, metadata: RequestMetadata) {
    this.assertCanWrite(ctx);
    const process = await this.ensureProcess(ctx, processId);
    const current = await this.latestModel(ctx, processId);
    const status =
      current?.validationStatus === 'VALIDATED'
        ? 'INVALIDATED'
        : (current?.validationStatus ?? 'DRAFT');
    const result = this.calculate(
      ctx,
      process,
      status as BpmnValidationStatus,
      await this.nextVersion(ctx, processId),
    );
    const saved = await this.persist(ctx, processId, result, 'bpmn_recalculated', metadata);
    return this.modelToResult(saved);
  }

  async validate(
    ctx: TenantAccessContext,
    processId: string,
    dto: BpmnValidationDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanValidate(ctx);
    const current = await this.getPersistedOrGenerated(ctx, processId, metadata);
    if ((current.blockingIssues as BpmnResult['blockingIssues']).length) {
      throw new BadRequestException('Validation BPMN refusee: des blocages existent.');
    }
    const updated = await this.prisma.bpmnModel.update({
      where: { id: current.id },
      data: {
        validationStatus: 'VALIDATED',
        versionNumber: await this.nextVersion(ctx, processId),
        validatedAt: new Date(),
        validatedBy: ctx.actorUserId,
        validationComment: dto.comment,
      },
    });
    await this.createVersion(ctx, updated);
    await this.audit(
      ctx,
      'bpmn_validated',
      'bpmn_models',
      updated.id,
      { process_id: processId, comment: dto.comment },
      metadata,
    );
    return this.modelToResult(updated);
  }

  async invalidate(
    ctx: TenantAccessContext,
    processId: string,
    dto: BpmnValidationDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanValidate(ctx);
    const current = await this.getPersistedOrGenerated(ctx, processId, metadata);
    const updated = await this.prisma.bpmnModel.update({
      where: { id: current.id },
      data: {
        validationStatus: 'INVALIDATED',
        versionNumber: await this.nextVersion(ctx, processId),
        invalidatedAt: new Date(),
        invalidatedBy: ctx.actorUserId,
        validationComment: dto.comment,
      },
    });
    await this.createVersion(ctx, updated);
    await this.audit(
      ctx,
      'bpmn_invalidated',
      'bpmn_models',
      updated.id,
      { process_id: processId, comment: dto.comment },
      metadata,
    );
    return this.modelToResult(updated);
  }

  async issues(ctx: TenantAccessContext, processId: string) {
    const result = await this.getBpmn(ctx, processId);
    return { blocking_issues: result.blockingIssues, warnings: result.warnings };
  }

  async history(ctx: TenantAccessContext, processId: string) {
    await this.ensureProcess(ctx, processId);
    return this.prisma.auditLog.findMany({
      where: {
        tenantId: ctx.tenantId,
        action: { startsWith: 'bpmn_' },
        metadata: { path: ['process_id'], equals: processId },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async versions(ctx: TenantAccessContext, processId: string) {
    await this.ensureProcess(ctx, processId);
    return this.prisma.bpmnVersion.findMany({
      where: { tenantId: ctx.tenantId, processId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async exportXml(ctx: TenantAccessContext, processId: string, metadata: RequestMetadata) {
    const result = await this.getBpmn(ctx, processId);
    await this.audit(
      ctx,
      'bpmn_exported_xml',
      'processes',
      processId,
      { process_id: processId, source_hash: result.sourceHash },
      metadata,
    );
    return result.bpmnXml;
  }

  async exportJson(ctx: TenantAccessContext, processId: string, metadata: RequestMetadata) {
    const result = await this.getBpmn(ctx, processId);
    await this.audit(
      ctx,
      'bpmn_exported_json',
      'processes',
      processId,
      { process_id: processId, source_hash: result.sourceHash },
      metadata,
    );
    return result.bpmnJson;
  }

  private calculate(
    ctx: TenantAccessContext,
    process: Prisma.ProcessGetPayload<{ include: typeof BPMN_PROCESS_INCLUDE }>,
    status: BpmnValidationStatus,
    versionNumber: number,
  ): BpmnResult {
    const input = {
      tenantId: ctx.tenantId,
      processId: process.id,
      processName: process.name,
      triggerEvent: process.triggerEvent,
      finalOutput: process.outputs[0]?.name,
      generatedAt: new Date().toISOString(),
      generatedBy: ctx.actorUserId,
      activities: process.activities.map((activity) => ({
        id: activity.id,
        name: activity.name,
        description: activity.description,
        sortOrder: activity.sortOrder,
        condition: activity.condition,
        duration: activity.duration,
        inputText: activity.inputText,
        outputText: activity.outputText,
        isAutomated: activity.isAutomated,
      })),
      transitions: process.transitions.map((transition) => ({
        id: transition.id,
        fromActivityId: transition.fromActivityId,
        toActivityId: transition.toActivityId,
        label: transition.label,
        condition: transition.condition,
        sortOrder: transition.sortOrder,
      })),
      actorRoles: process.actorRoles.map((role) => ({
        activityId: role.activityId,
        actorId: role.actorId,
        raciRole: role.raciRole,
        actorName: role.actor.name,
      })),
      isUserFacingProcess: process.moroccoCompliance?.isUserFacingProcess,
      law5519Applicable: process.moroccoCompliance?.law5519Applicable,
      targetChannel: process.moroccoCompliance?.targetChannel,
      targetProcessingTimeDays: process.moroccoCompliance?.targetProcessingTimeDays,
      requiredDocumentsCount: process.moroccoCompliance?.requiredDocumentsCount,
      physicalVisitsRequired: process.moroccoCompliance?.physicalVisitsRequired,
      hasDelayKpi: process.kpis.some((kpi) =>
        `${kpi.name} ${kpi.definition ?? ''}`.toLowerCase().includes('delai'),
      ),
      hasPublicAuditRisk: process.risks.some((risk) => risk.courtOfAccountsRelevance),
      hasEventLogs: process.eventLogImports.length > 0,
      hasSimplificationOwner: Boolean(process.processOwnerActorId),
      documentCount: process.documents.length,
    };
    const sourceHash = bpmnSourceHash({
      ruleVersion: BPMN_RULE_VERSION,
      input: { ...input, generatedAt: undefined, generatedBy: undefined },
    });
    const bpmnJson = { ...buildBpmnJson(input), sourceHash };
    const bpmnXml = this.xmlBuilder.build(bpmnJson);
    return {
      ruleVersion: BPMN_RULE_VERSION,
      sourceHash,
      bpmnJson,
      bpmnXml,
      blockingIssues: bpmnJson.issues,
      warnings: bpmnJson.warnings,
      recommendations: bpmnJson.recommendations,
      validationStatus: status,
      versionNumber,
      generatedAt: input.generatedAt,
      canValidate: bpmnJson.issues.length === 0,
    };
  }

  private async persist(
    ctx: TenantAccessContext,
    processId: string,
    result: BpmnResult,
    action: string,
    metadata: RequestMetadata,
  ) {
    const existing = await this.latestModel(ctx, processId);
    if (existing?.sourceHash === result.sourceHash && existing.ruleVersion === result.ruleVersion)
      return existing;
    const created = await this.prisma.bpmnModel.create({
      data: {
        tenantId: ctx.tenantId,
        processId,
        ruleVersion: result.ruleVersion,
        sourceHash: result.sourceHash,
        bpmnJson: this.toJsonValue(result.bpmnJson),
        bpmnXml: result.bpmnXml,
        validationStatus: result.validationStatus,
        blockingIssues: this.toJsonValue(result.blockingIssues),
        warnings: this.toJsonValue(result.warnings),
        recommendations: this.toJsonValue(result.recommendations),
        versionNumber: result.versionNumber,
        generatedBy: ctx.actorUserId,
      },
    });
    await this.createVersion(ctx, created);
    await this.audit(
      ctx,
      action,
      'bpmn_models',
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
    const current = await this.latestModel(ctx, processId);
    if (current) return current;
    this.assertCanWrite(ctx);
    const process = await this.ensureProcess(ctx, processId);
    const result = this.calculate(ctx, process, 'DRAFT', await this.nextVersion(ctx, processId));
    return this.persist(ctx, processId, result, 'bpmn_generated', metadata);
  }

  private modelToResult(model: {
    ruleVersion: string;
    sourceHash: string;
    bpmnJson: unknown;
    bpmnXml: string;
    blockingIssues: unknown;
    warnings: unknown;
    recommendations: unknown;
    validationStatus: string;
    versionNumber: number;
    generatedAt: Date;
  }) {
    const blockingIssues = model.blockingIssues as BpmnResult['blockingIssues'];
    return {
      ruleVersion: model.ruleVersion,
      sourceHash: model.sourceHash,
      bpmnJson: model.bpmnJson as BpmnResult['bpmnJson'],
      bpmnXml: model.bpmnXml,
      blockingIssues,
      warnings: model.warnings as BpmnResult['warnings'],
      recommendations: model.recommendations as string[],
      validationStatus: model.validationStatus as BpmnValidationStatus,
      versionNumber: model.versionNumber,
      generatedAt: model.generatedAt.toISOString(),
      canValidate: blockingIssues.length === 0,
    };
  }

  private ensureProcess(ctx: TenantAccessContext, id: string) {
    this.assertCanRead(ctx);
    return this.prisma.process
      .findFirst({
        where: { id, tenantId: ctx.tenantId, deletedAt: null, ...this.directionScope(ctx) },
        include: BPMN_PROCESS_INCLUDE,
      })
      .then((process) => {
        if (!process) throw new NotFoundException('Processus introuvable.');
        return process;
      });
  }

  private latestModel(ctx: TenantAccessContext, processId: string) {
    return this.prisma.bpmnModel.findFirst({
      where: { tenantId: ctx.tenantId, processId },
      orderBy: { generatedAt: 'desc' },
    });
  }

  private async nextVersion(ctx: TenantAccessContext, processId: string) {
    const latest = await this.prisma.bpmnVersion.findFirst({
      where: { tenantId: ctx.tenantId, processId },
      orderBy: { versionNumber: 'desc' },
    });
    return (latest?.versionNumber ?? 0) + 1;
  }

  private createVersion(
    ctx: TenantAccessContext,
    model: {
      id: string;
      processId: string;
      versionNumber: number;
      ruleVersion: string;
      sourceHash: string;
      validationStatus: string;
      bpmnJson: unknown;
      bpmnXml: string;
      blockingIssues: unknown;
      warnings: unknown;
      recommendations: unknown;
    },
  ) {
    return this.prisma.bpmnVersion.create({
      data: {
        tenantId: ctx.tenantId,
        processId: model.processId,
        modelId: model.id,
        versionNumber: model.versionNumber,
        ruleVersion: model.ruleVersion,
        sourceHash: model.sourceHash,
        validationStatus: model.validationStatus,
        snapshot: this.toJsonValue({
          bpmnJson: model.bpmnJson,
          bpmnXml: model.bpmnXml,
          blockingIssues: model.blockingIssues,
          warnings: model.warnings,
          recommendations: model.recommendations,
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

  private assertCanRead(ctx: TenantAccessContext) {
    if (ctx.isSupportAccess) return;
    if (!ctx.tenantRoles.length) throw new ForbiddenException('Lecture refusee.');
  }

  private assertCanWrite(ctx: TenantAccessContext) {
    if (
      ctx.isSupportAccess ||
      !WRITE_PERMISSIONS.some((permission) => ctx.permissions.includes(permission))
    )
      throw new ForbiddenException('Ecriture BPMN refusee.');
  }

  private assertCanValidate(ctx: TenantAccessContext) {
    if (
      ctx.isSupportAccess ||
      ctx.tenantRoles.includes('consultant') ||
      !VALIDATE_PERMISSIONS.some((permission) => ctx.permissions.includes(permission))
    )
      throw new ForbiddenException('Validation BPMN refusee.');
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
