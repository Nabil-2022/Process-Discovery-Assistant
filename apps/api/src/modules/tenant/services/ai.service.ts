import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

import { AiSuggestionStatus, Prisma, ProcessStatus, RiskLevel } from '../../../generated/prisma';
import { RequestMetadata } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AiApplySuggestionDto,
  AiGenerateDto,
  AiGenerationType,
  AiModifySuggestionDto,
} from '../dto/ai.dto';
import { TenantAccessContext } from '../guards/tenant-access.guard';
import { AiProvider } from './ai-provider.interface';
import { AzureOpenAiProvider } from './azure-openai.provider';
import { MockAiProvider } from './mock-ai.provider';
import { AI_PROMPT_VERSION, systemPrompt, userPrompt } from './ai-prompts';

const WRITE_PERMISSIONS = ['manage_directions', 'create_process', 'update_process_working_copy'];
const VALIDATE_PERMISSIONS = ['manage_directions', 'validate_process', 'review_process'];
const DEFAULT_DAILY_QUOTA = 50;

const AI_PROCESS_INCLUDE = {
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
  eventLogImports: { orderBy: { createdAt: 'desc' }, take: 3 },
  raciAssessments: { orderBy: { generatedAt: 'desc' }, take: 1 },
  bpmnModels: { orderBy: { generatedAt: 'desc' }, take: 1 },
} satisfies Prisma.ProcessInclude;

type AiProcess = Prisma.ProcessGetPayload<{ include: typeof AI_PROCESS_INCLUDE }>;

type AiJsonOutput = {
  summary?: string;
  findings?: unknown[];
  suggestions?: {
    category?: string;
    title?: string;
    description?: string;
    targetEntity?: string;
    priority?: string;
    rationale?: string;
  }[];
  limitations?: string[];
};

@Injectable()
export class TenantAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mockProvider: MockAiProvider,
    private readonly azureProvider: AzureOpenAiProvider,
  ) {}

  async generate(
    ctx: TenantAccessContext,
    processId: string,
    dto: AiGenerateDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanGenerate(ctx);
    await this.assertFeatureEnabled(ctx, metadata);
    await this.assertQuota(ctx, metadata);
    const process = await this.ensureProcess(ctx, processId);
    const context = this.safeContext(process);
    const prompt = userPrompt(dto.generation_type, context);
    const provider = this.provider();
    await this.audit(
      ctx,
      'ai_generation_requested',
      'processes',
      processId,
      {
        generation_type: dto.generation_type,
        prompt_version: AI_PROMPT_VERSION,
      },
      metadata,
    );
    try {
      const response = await provider.generate({
        systemPrompt: systemPrompt(),
        userPrompt: prompt,
        responseFormat: 'json',
      });
      const parsed = this.parseOutput(response.rawText);
      const generation = await this.prisma.aiGeneration.create({
        data: {
          tenantId: ctx.tenantId,
          provider: response.provider,
          purpose: dto.generation_type,
          model: response.model,
          promptHash: this.hash(prompt),
          inputRef: this.toJsonValue({
            process_id: processId,
            prompt_version: AI_PROMPT_VERSION,
            context_hash: this.hash(JSON.stringify(context)),
          }),
          output: this.toJsonValue(parsed),
          createdBy: ctx.actorUserId,
        },
      });
      const suggestions = await Promise.all(
        (parsed.suggestions ?? []).map((suggestion) =>
          this.prisma.aiSuggestion.create({
            data: {
              tenantId: ctx.tenantId,
              processId,
              generationId: generation.id,
              suggestionType: String(suggestion.targetEntity ?? dto.generation_type),
              content: this.toJsonValue({
                ...suggestion,
                generation_type: dto.generation_type,
                requiresHumanValidation: true,
              }),
            },
          }),
        ),
      );
      await this.audit(
        ctx,
        'ai_generation_completed',
        'ai_generations',
        generation.id,
        {
          process_id: processId,
          suggestion_count: suggestions.length,
        },
        metadata,
      );
      for (const suggestion of suggestions) {
        await this.audit(
          ctx,
          'ai_suggestion_created',
          'ai_suggestions',
          suggestion.id,
          {
            process_id: processId,
          },
          metadata,
        );
      }
      return { generation, suggestions };
    } catch (error) {
      await this.audit(
        ctx,
        'ai_generation_failed',
        'processes',
        processId,
        {
          generation_type: dto.generation_type,
          reason: error instanceof Error ? error.message : 'unknown',
        },
        metadata,
      );
      throw error;
    }
  }

  async generations(ctx: TenantAccessContext, processId: string) {
    await this.ensureProcess(ctx, processId);
    return this.prisma.aiGeneration.findMany({
      where: { tenantId: ctx.tenantId, inputRef: { path: ['process_id'], equals: processId } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async generation(ctx: TenantAccessContext, processId: string, generationId: string) {
    await this.ensureProcess(ctx, processId);
    const generation = await this.prisma.aiGeneration.findFirst({
      where: {
        id: generationId,
        tenantId: ctx.tenantId,
        inputRef: { path: ['process_id'], equals: processId },
      },
      include: { suggestions: true },
    });
    if (!generation) throw new NotFoundException('Generation IA introuvable.');
    return generation;
  }

  async suggestions(ctx: TenantAccessContext, processId: string) {
    await this.ensureProcess(ctx, processId);
    const where: Prisma.AiSuggestionWhereInput = { tenantId: ctx.tenantId, processId };
    if (ctx.tenantRoles.includes('readonly')) where.status = AiSuggestionStatus.VALIDATED;
    return this.prisma.aiSuggestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  accept(
    ctx: TenantAccessContext,
    processId: string,
    suggestionId: string,
    metadata: RequestMetadata,
  ) {
    return this.changeStatus(
      ctx,
      processId,
      suggestionId,
      AiSuggestionStatus.ACCEPTED,
      'ai_suggestion_accepted',
      metadata,
    );
  }

  reject(
    ctx: TenantAccessContext,
    processId: string,
    suggestionId: string,
    metadata: RequestMetadata,
  ) {
    return this.changeStatus(
      ctx,
      processId,
      suggestionId,
      AiSuggestionStatus.REJECTED,
      'ai_suggestion_rejected',
      metadata,
    );
  }

  async modify(
    ctx: TenantAccessContext,
    processId: string,
    suggestionId: string,
    dto: AiModifySuggestionDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanGenerate(ctx);
    await this.ensureProcess(ctx, processId);
    await this.ensureSuggestion(ctx, processId, suggestionId);
    const suggestion = await this.prisma.aiSuggestion.update({
      where: { id: suggestionId },
      data: {
        content: this.toJsonValue({ ...dto.content, requiresHumanValidation: true }),
        status: AiSuggestionStatus.MODIFIED,
        decidedBy: ctx.actorUserId,
        decidedAt: new Date(),
      },
    });
    await this.audit(
      ctx,
      'ai_suggestion_modified',
      'ai_suggestions',
      suggestionId,
      { process_id: processId },
      metadata,
    );
    return suggestion;
  }

  async validate(
    ctx: TenantAccessContext,
    processId: string,
    suggestionId: string,
    metadata: RequestMetadata,
  ) {
    if (
      ctx.tenantRoles.includes('consultant') ||
      !VALIDATE_PERMISSIONS.some((permission) => ctx.permissions.includes(permission))
    ) {
      throw new ForbiddenException('Validation suggestion IA refusee.');
    }
    return this.changeStatus(
      ctx,
      processId,
      suggestionId,
      AiSuggestionStatus.VALIDATED,
      'ai_suggestion_validated',
      metadata,
      false,
    );
  }

  async createKpi(
    ctx: TenantAccessContext,
    processId: string,
    suggestionId: string,
    _dto: AiApplySuggestionDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanApply(ctx);
    await this.ensureEditableProcess(ctx, processId);
    const suggestion = await this.ensureSuggestion(ctx, processId, suggestionId);
    const content = suggestion.content as Record<string, unknown>;
    const kpi = await this.prisma.kpi.create({
      data: {
        tenantId: ctx.tenantId,
        processId,
        name: String(content.title ?? 'KPI suggere'),
        objective: String(content.rationale ?? ''),
        definition: String(content.description ?? ''),
      },
    });
    await this.audit(
      ctx,
      'ai_suggestion_applied_to_kpi',
      'kpis',
      kpi.id,
      { suggestion_id: suggestionId },
      metadata,
    );
    return kpi;
  }

  async createRisk(
    ctx: TenantAccessContext,
    processId: string,
    suggestionId: string,
    metadata: RequestMetadata,
  ) {
    this.assertCanApply(ctx);
    await this.ensureEditableProcess(ctx, processId);
    const suggestion = await this.ensureSuggestion(ctx, processId, suggestionId);
    const content = suggestion.content as Record<string, unknown>;
    const risk = await this.prisma.risk.create({
      data: {
        tenantId: ctx.tenantId,
        processId,
        description: String(content.description ?? content.title ?? 'Risque suggere'),
        category: String(content.category ?? 'IA'),
        inherentLevel: RiskLevel.MEDIUM,
      },
    });
    await this.audit(
      ctx,
      'ai_suggestion_applied_to_risk',
      'risks',
      risk.id,
      { suggestion_id: suggestionId },
      metadata,
    );
    return risk;
  }

  async createControl(
    ctx: TenantAccessContext,
    processId: string,
    suggestionId: string,
    metadata: RequestMetadata,
  ) {
    this.assertCanApply(ctx);
    await this.ensureEditableProcess(ctx, processId);
    const suggestion = await this.ensureSuggestion(ctx, processId, suggestionId);
    const content = suggestion.content as Record<string, unknown>;
    const control = await this.prisma.control.create({
      data: {
        tenantId: ctx.tenantId,
        name: String(content.title ?? 'Controle suggere'),
        description: String(content.description ?? ''),
        controlType: 'AI_SUGGESTED',
      },
    });
    await this.audit(
      ctx,
      'ai_suggestion_applied_to_control',
      'controls',
      control.id,
      { suggestion_id: suggestionId },
      metadata,
    );
    return control;
  }

  async createBacklogItem(
    ctx: TenantAccessContext,
    processId: string,
    suggestionId: string,
    metadata: RequestMetadata,
  ) {
    this.assertCanApply(ctx);
    await this.ensureEditableProcess(ctx, processId);
    const suggestion = await this.ensureSuggestion(ctx, processId, suggestionId);
    const content = suggestion.content as Record<string, unknown>;
    const item = await this.prisma.automationNeed.create({
      data: {
        tenantId: ctx.tenantId,
        processId,
        description: String(content.description ?? content.title ?? 'Backlog suggere'),
        priority: String(content.priority ?? 'medium').toUpperCase(),
        complexity: 'Moyenne',
        expectedGain: String(content.rationale ?? ''),
      },
    });
    await this.audit(
      ctx,
      'ai_suggestion_applied_to_backlog',
      'automation_needs',
      item.id,
      { suggestion_id: suggestionId },
      metadata,
    );
    return item;
  }

  async insertProcedureDraft(
    ctx: TenantAccessContext,
    processId: string,
    suggestionId: string,
    metadata: RequestMetadata,
  ) {
    this.assertCanApply(ctx);
    await this.ensureEditableProcess(ctx, processId);
    const suggestion = await this.ensureSuggestion(ctx, processId, suggestionId);
    const comment = await this.prisma.comment.create({
      data: {
        tenantId: ctx.tenantId,
        processId,
        resourceType: 'procedure_draft',
        body: JSON.stringify(suggestion.content),
        createdBy: ctx.actorUserId,
      },
    });
    await this.audit(
      ctx,
      'ai_suggestion_inserted_procedure_draft',
      'comments',
      comment.id,
      { suggestion_id: suggestionId },
      metadata,
    );
    return comment;
  }

  private provider(): AiProvider {
    return this.config.get<string>('AI_PROVIDER') === 'azure-openai'
      ? this.azureProvider
      : this.mockProvider;
  }

  private parseOutput(rawText: string): AiJsonOutput {
    let parsed: AiJsonOutput;
    try {
      parsed = JSON.parse(rawText) as AiJsonOutput;
    } catch {
      throw new BadRequestException('Reponse IA invalide: JSON attendu.');
    }
    if (!Array.isArray(parsed.suggestions) || !Array.isArray(parsed.findings)) {
      throw new BadRequestException('Reponse IA invalide: structure attendue absente.');
    }
    return parsed;
  }

  private safeContext(process: AiProcess) {
    return {
      process: {
        id: process.id,
        name: this.truncate(process.name),
        code: process.code,
        status: process.status,
        direction: process.direction?.name,
        objective: this.truncate(process.objective),
        scope: this.truncate(process.scope),
        triggerEvent: this.truncate(process.triggerEvent),
      },
      inputs: process.inputs.map((item) => ({
        name: this.truncate(item.name),
        source: this.truncate(item.source),
      })),
      outputs: process.outputs.map((item) => ({
        name: this.truncate(item.name),
        destination: this.truncate(item.destination),
      })),
      activities: process.activities.map((item) => ({
        name: this.truncate(item.name),
        output: this.truncate(item.outputText),
        duration: this.truncate(item.duration),
        automated: item.isAutomated,
      })),
      raci: process.actorRoles.map((item) => ({
        activityId: item.activityId,
        role: item.raciRole,
        actor: this.truncate(item.actor.name),
      })),
      kpis: process.kpis.map((item) => ({
        name: this.truncate(item.name),
        target: this.truncate(item.target),
      })),
      risks: process.risks.map((item) => ({
        description: this.truncate(item.description),
        level: item.inherentLevel,
        controls: item.controls.length,
      })),
      morocco: process.moroccoCompliance
        ? {
            isUserFacingProcess: process.moroccoCompliance.isUserFacingProcess,
            law5519Applicable: process.moroccoCompliance.law5519Applicable,
            targetChannel: process.moroccoCompliance.targetChannel,
            targetDelay: process.moroccoCompliance.targetProcessingTimeDays,
          }
        : null,
      bpmnStatus: process.bpmnModels[0]?.validationStatus,
      raciStatus: process.raciAssessments[0]?.validationStatus,
      eventLogs: process.eventLogImports.map((item) => ({
        status: item.status,
        rows: item.rowCount,
      })),
    };
  }

  private async assertFeatureEnabled(ctx: TenantAccessContext, metadata: RequestMetadata) {
    const feature = await this.prisma.tenantFeature.findFirst({
      where: { tenantId: ctx.tenantId, enabled: true, feature: { code: 'ai_copilot' } },
    });
    if (!feature) {
      await this.audit(ctx, 'ai_feature_disabled', 'tenant_features', null, {}, metadata);
      throw new ForbiddenException('Copilote IA non active pour ce tenant.');
    }
  }

  private async assertQuota(ctx: TenantAccessContext, metadata: RequestMetadata) {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const limit = Number(this.config.get<string>('AI_DAILY_QUOTA') ?? DEFAULT_DAILY_QUOTA);
    const [tenantCount, userCount] = await Promise.all([
      this.prisma.aiGeneration.count({
        where: { tenantId: ctx.tenantId, createdAt: { gte: since } },
      }),
      this.prisma.aiGeneration.count({
        where: { tenantId: ctx.tenantId, createdBy: ctx.actorUserId, createdAt: { gte: since } },
      }),
    ]);
    if (tenantCount >= limit || userCount >= limit) {
      await this.audit(
        ctx,
        'ai_quota_exceeded',
        'ai_generations',
        null,
        { tenantCount, userCount, limit },
        metadata,
      );
      throw new ForbiddenException('Quota IA atteint.');
    }
  }

  private async ensureEditableProcess(ctx: TenantAccessContext, id: string) {
    const process = await this.ensureProcess(ctx, id);
    const editableStatuses: ProcessStatus[] = [
      ProcessStatus.DRAFT,
      ProcessStatus.IN_PROGRESS,
      ProcessStatus.CHANGES_REQUESTED,
      ProcessStatus.RESUBMITTED,
    ];
    if (!editableStatuses.includes(process.status)) {
      throw new ForbiddenException('Processus non editable.');
    }
    return process;
  }

  private async ensureProcess(ctx: TenantAccessContext, id: string) {
    this.assertCanRead(ctx);
    const process = await this.prisma.process.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null, ...this.directionScope(ctx) },
      include: AI_PROCESS_INCLUDE,
    });
    if (!process) throw new NotFoundException('Processus introuvable.');
    return process;
  }

  private async ensureSuggestion(
    ctx: TenantAccessContext,
    processId: string,
    suggestionId: string,
  ) {
    const suggestion = await this.prisma.aiSuggestion.findFirst({
      where: { id: suggestionId, tenantId: ctx.tenantId, processId },
    });
    if (!suggestion) throw new NotFoundException('Suggestion IA introuvable.');
    return suggestion;
  }

  private async changeStatus(
    ctx: TenantAccessContext,
    processId: string,
    suggestionId: string,
    status: AiSuggestionStatus,
    action: string,
    metadata: RequestMetadata,
    requireManagePermission = true,
  ) {
    if (requireManagePermission) this.assertCanGenerate(ctx);
    await this.ensureProcess(ctx, processId);
    await this.ensureSuggestion(ctx, processId, suggestionId);
    const suggestion = await this.prisma.aiSuggestion.update({
      where: { id: suggestionId },
      data: { status, decidedBy: ctx.actorUserId, decidedAt: new Date() },
    });
    await this.audit(
      ctx,
      action,
      'ai_suggestions',
      suggestionId,
      { process_id: processId },
      metadata,
    );
    return suggestion;
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

  private assertCanGenerate(ctx: TenantAccessContext) {
    if (ctx.isSupportAccess || ctx.tenantRoles.includes('readonly')) {
      throw new ForbiddenException('Generation IA refusee.');
    }
    if (!ctx.permissions.includes('manage_ai_suggestions')) {
      throw new ForbiddenException('Generation IA refusee.');
    }
  }

  private assertCanApply(ctx: TenantAccessContext) {
    this.assertCanGenerate(ctx);
    if (!WRITE_PERMISSIONS.some((permission) => ctx.permissions.includes(permission))) {
      throw new ForbiddenException('Application suggestion IA refusee.');
    }
  }

  private truncate(value?: string | null) {
    if (!value) return value;
    return value.slice(0, 1000);
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
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
