import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RiskLevel } from '../../../generated/prisma';
import { RequestMetadata } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePublicAuditRiskDto,
  ImportEventLogCsvDto,
  MapEventLogColumnsDto,
  UpdateMoroccoComplianceDto,
} from '../dto/morocco-compliance.dto';
import { TenantAccessContext } from '../guards/tenant-access.guard';

const WRITE_PERMISSIONS = ['manage_directions', 'create_process', 'update_process_working_copy'];
const REQUIRED_EVENT_COLUMNS = ['case_id', 'activity_name', 'event_timestamp'];

type EventRow = Record<string, string>;

@Injectable()
export class MoroccoComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(ctx: TenantAccessContext) {
    this.assertCanRead(ctx);
    const processes = await this.prisma.process.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null, ...this.directionScope(ctx) },
      select: {
        id: true,
        moroccoCompliance: true,
      },
    });
    const compliances = processes
      .map((process) => process.moroccoCompliance)
      .filter(Boolean) as NonNullable<(typeof processes)[number]['moroccoCompliance']>[];
    const userFacing = compliances.filter((item) => item.isUserFacingProcess);
    const nonDigitalized = userFacing.filter(
      (item) => (item.currentChannel ?? '').toLowerCase() !== 'digital',
    );
    const priority = userFacing.filter((item) =>
      ['high', 'haute', 'critique', 'urgent'].includes(
        (item.digitalizationPriority ?? item.simplificationPriority ?? '').toLowerCase(),
      ),
    );
    const digitalTarget = userFacing.filter(
      (item) => (item.targetChannel ?? '').toLowerCase() === 'digital',
    );
    return {
      user_facing_processes: userFacing.length,
      non_digitalized_user_facing_processes: nonDigitalized.length,
      priority_processes: priority.length,
      average_current_processing_time_days: this.average(
        userFacing.map((item) => item.currentProcessingTimeDays),
      ),
      average_target_processing_time_days: this.average(
        userFacing.map((item) => item.targetProcessingTimeDays),
      ),
      average_required_documents: this.average(
        userFacing.map((item) => item.requiredDocumentsCount),
      ),
      average_physical_visits: this.average(userFacing.map((item) => item.physicalVisitsRequired)),
      target_digitalization_rate: userFacing.length
        ? Math.round((digitalTarget.length / userFacing.length) * 100)
        : 0,
    };
  }

  async getCompliance(ctx: TenantAccessContext, processId: string) {
    await this.ensureProcess(ctx, processId);
    return this.prisma.moroccoProcessCompliance.findUnique({ where: { processId } });
  }

  async upsertCompliance(
    ctx: TenantAccessContext,
    processId: string,
    dto: UpdateMoroccoComplianceDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    const data = this.complianceData(dto);
    const compliance = await this.prisma.moroccoProcessCompliance.upsert({
      where: { processId },
      create: { tenantId: ctx.tenantId, processId, ...data },
      update: data,
    });
    await this.audit(ctx, 'morocco_compliance_saved', 'processes', processId, data, metadata);
    return compliance;
  }

  async createPublicAuditRisk(
    ctx: TenantAccessContext,
    processId: string,
    dto: CreatePublicAuditRiskDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    const inherentScore = this.score(dto.inherent_probability, dto.inherent_impact);
    const residualScore = this.score(dto.residual_probability, dto.residual_impact);
    const risk = await this.prisma.risk.create({
      data: {
        tenantId: ctx.tenantId,
        processId,
        riskFamily: dto.risk_family,
        category: dto.risk_category,
        description: dto.risk_description,
        cause: dto.cause,
        consequence: dto.consequence,
        probability: dto.inherent_probability,
        impact: dto.inherent_impact,
        inherentScore,
        inherentLevel: this.riskLevel(inherentScore),
        residualProbability: dto.residual_probability,
        residualImpact: dto.residual_impact,
        residualScore,
        residualLevel: this.riskLevel(residualScore),
        existingControls: dto.existing_controls,
        controlOwner: dto.control_owner,
        actionPlan: dto.action_plan,
        treatmentPlan: dto.action_plan,
        dueDate: dto.due_date ? new Date(dto.due_date) : undefined,
        evidenceRequired: dto.evidence_required,
        auditRelevance: dto.audit_relevance,
        courtOfAccountsRelevance: dto.court_of_accounts_relevance ?? false,
        legalOrRegulatoryReference: dto.legal_or_regulatory_reference,
      },
    });
    await this.audit(ctx, 'public_audit_risk_created', 'risks', risk.id, { processId }, metadata);
    return risk;
  }

  async importCsv(
    ctx: TenantAccessContext,
    processId: string,
    dto: ImportEventLogCsvDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    await this.ensureProcess(ctx, processId);
    const parsed = this.parseCsv(dto.content, dto.delimiter ?? ',');
    const validation = this.validateHeaders(parsed.headers);
    if (!validation.valid) throw new BadRequestException(validation);

    const created = await this.prisma.$transaction(async (tx) => {
      const eventImport = await tx.eventLogImport.create({
        data: {
          tenantId: ctx.tenantId,
          processId,
          fileName: dto.file_name,
          status: 'VALIDATED',
          rowCount: parsed.rows.length,
          validationReport: this.toJsonValue(validation),
          createdBy: ctx.actorUserId,
        },
      });
      const caseMap = new Map<string, { id: string; timestamps: Date[] }>();
      for (const [index, row] of parsed.rows.entries()) {
        const caseId = row.case_id?.trim();
        const activityName = row.activity_name?.trim();
        const rawTimestamp = row.event_timestamp;
        if (!caseId || !activityName || !rawTimestamp) continue;
        const timestamp = new Date(rawTimestamp);
        if (Number.isNaN(timestamp.getTime())) continue;
        let eventCase = caseMap.get(caseId);
        if (!eventCase) {
          const createdCase = await tx.eventLogCase.create({
            data: {
              tenantId: ctx.tenantId,
              importId: eventImport.id,
              processId,
              caseId,
              rawPayload: this.toJsonValue({ case_id: caseId }),
            },
          });
          eventCase = { id: createdCase.id, timestamps: [] };
          caseMap.set(caseId, eventCase);
        }
        eventCase.timestamps.push(timestamp);
        await tx.eventLogEvent.create({
          data: {
            tenantId: ctx.tenantId,
            importId: eventImport.id,
            processId,
            caseRefId: eventCase.id,
            caseId,
            activityName,
            eventTimestamp: timestamp,
            lifecycleTransition: row.lifecycle_transition,
            resource: row.resource,
            role: row.role,
            department: row.department,
            application: row.application,
            cost: row.cost ? new Prisma.Decimal(row.cost) : undefined,
            channel: row.channel,
            status: row.status,
            rawPayload: this.toJsonValue(row),
            sortOrder: index + 1,
          },
        });
      }
      for (const [caseId, item] of caseMap.entries()) {
        const sorted = item.timestamps.sort((a, b) => a.getTime() - b.getTime());
        const startedAt = sorted[0];
        const completedAt = sorted[sorted.length - 1];
        if (!startedAt || !completedAt) continue;
        await tx.eventLogCase.update({
          where: { id: item.id },
          data: {
            startedAt,
            completedAt,
            durationSeconds: Math.round((completedAt.getTime() - startedAt.getTime()) / 1000),
            rawPayload: this.toJsonValue({ case_id: caseId, events: sorted.length }),
          },
        });
      }
      return eventImport;
    });
    await this.audit(ctx, 'event_log_imported', 'event_log_imports', created.id, {}, metadata);
    return this.getEventLogImport(ctx, processId, created.id);
  }

  async listEventLogs(ctx: TenantAccessContext, processId: string) {
    await this.ensureProcess(ctx, processId);
    return this.prisma.eventLogImport.findMany({
      where: { tenantId: ctx.tenantId, processId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getEventLogImport(ctx: TenantAccessContext, processId: string, importId: string) {
    await this.ensureProcess(ctx, processId);
    const eventImport = await this.prisma.eventLogImport.findFirst({
      where: { id: importId, tenantId: ctx.tenantId, processId },
      include: { cases: true },
    });
    if (!eventImport) throw new NotFoundException('Import event log introuvable.');
    return eventImport;
  }

  async listEvents(ctx: TenantAccessContext, processId: string, importId: string) {
    await this.getEventLogImport(ctx, processId, importId);
    return this.prisma.eventLogEvent.findMany({
      where: { tenantId: ctx.tenantId, processId, importId },
      orderBy: [{ caseId: 'asc' }, { eventTimestamp: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async mapColumns(
    ctx: TenantAccessContext,
    processId: string,
    importId: string,
    dto: MapEventLogColumnsDto,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    await this.getEventLogImport(ctx, processId, importId);
    const updated = await this.prisma.eventLogImport.update({
      where: { id: importId },
      data: { columnMapping: this.toJsonValue(dto.mapping) },
    });
    await this.audit(ctx, 'event_log_columns_mapped', 'event_log_imports', importId, {}, metadata);
    return updated;
  }

  async validateImport(ctx: TenantAccessContext, processId: string, importId: string) {
    const events = await this.listEvents(ctx, processId, importId);
    const report = {
      valid: events.length > 0,
      required_columns: REQUIRED_EVENT_COLUMNS,
      events: events.length,
      cases: new Set(events.map((event) => event.caseId)).size,
      missing_columns: events.length ? [] : REQUIRED_EVENT_COLUMNS,
    };
    return this.prisma.eventLogImport.update({
      where: { id: importId },
      data: {
        status: report.valid ? 'VALIDATED' : 'INVALID',
        validationReport: this.toJsonValue(report),
      },
    });
  }

  async analyzeBasic(
    ctx: TenantAccessContext,
    processId: string,
    importId: string,
    metadata: RequestMetadata,
  ) {
    this.assertCanWrite(ctx);
    const events = await this.listEvents(ctx, processId, importId);
    if (!events.length) throw new BadRequestException('Aucun evenement a analyser.');
    const analysis = this.basicAnalysis(events);
    const run = await this.prisma.processMiningRun.create({
      data: {
        tenantId: ctx.tenantId,
        processId,
        importId,
        runType: 'BASIC_ANALYSIS',
        status: 'COMPLETED',
        metrics: this.toJsonValue(analysis),
        createdBy: ctx.actorUserId,
        completedAt: new Date(),
      },
    });
    await this.prisma.bottleneckAnalysis.create({
      data: {
        tenantId: ctx.tenantId,
        processId,
        runId: run.id,
        result: this.toJsonValue(analysis.bottlenecks),
      },
    });
    await this.prisma.eventLogImport.update({
      where: { id: importId },
      data: { status: 'ANALYZED', basicAnalysis: this.toJsonValue(analysis) },
    });
    await this.audit(ctx, 'event_log_basic_analysis', 'event_log_imports', importId, {}, metadata);
    return {
      ...analysis,
      run_id: run.id,
      advanced_worker_message: 'Analyse avancee par worker Python optionnel a venir',
      bpmn_export_format: 'BPMN_2_0',
      compatibility: ['Camunda', 'Bizagi', 'Signavio'],
    };
  }

  private complianceData(dto: UpdateMoroccoComplianceDto) {
    return {
      isUserFacingProcess: dto.is_user_facing_process,
      law5519Applicable: dto.law_55_19_applicable,
      administrativeProcedureType: dto.administrative_procedure_type,
      userCategory: dto.user_category,
      currentChannel: dto.current_channel,
      targetChannel: dto.target_channel,
      simplificationPriority: dto.simplification_priority,
      digitalizationPriority: dto.digitalization_priority,
      currentProcessingTimeDays: dto.current_processing_time_days,
      targetProcessingTimeDays: dto.target_processing_time_days,
      requiredDocumentsCount: dto.required_documents_count,
      requestedCopiesCount: dto.requested_copies_count,
      physicalVisitsRequired: dto.physical_visits_required,
      feesRequired: dto.fees_required,
      legalReference: dto.legal_reference,
      procedureOwnerEntity: dto.procedure_owner_entity,
      publicServicePortalUrl: dto.public_service_portal_url,
      observations: dto.observations,
    };
  }

  private parseCsv(content: string, delimiter: string) {
    const lines = content
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter((line) => line.trim());
    if (lines.length < 2) throw new BadRequestException('CSV vide ou sans donnees.');
    const headerLine = lines[0] ?? '';
    const headers = this.parseCsvLine(headerLine, delimiter).map((header) => header.trim());
    const rows = lines.slice(1).map((line) => {
      const values = this.parseCsvLine(line, delimiter);
      return headers.reduce<EventRow>((row, header, index) => {
        row[header] = values[index] ?? '';
        return row;
      }, {});
    });
    return { headers, rows };
  }

  private parseCsvLine(line: string, delimiter: string) {
    const values: string[] = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && quoted && next === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    return values;
  }

  private validateHeaders(headers: string[]) {
    const missing = REQUIRED_EVENT_COLUMNS.filter((column) => !headers.includes(column));
    return {
      valid: missing.length === 0,
      required_columns: REQUIRED_EVENT_COLUMNS,
      missing_columns: missing,
    };
  }

  private basicAnalysis(events: { caseId: string; activityName: string; eventTimestamp: Date }[]) {
    const byCase = new Map<string, typeof events>();
    for (const event of events) {
      byCase.set(event.caseId, [...(byCase.get(event.caseId) ?? []), event]);
    }
    const durations: number[] = [];
    const activityCounts = new Map<string, number>();
    const pathCounts = new Map<string, number>();
    const transitionDurations = new Map<string, number[]>();
    let loops = 0;
    for (const caseEvents of byCase.values()) {
      const sorted = [...caseEvents].sort(
        (a, b) => a.eventTimestamp.getTime() - b.eventTimestamp.getTime(),
      );
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      if (!first || !last) continue;
      durations.push((last.eventTimestamp.getTime() - first.eventTimestamp.getTime()) / 1000);
      const activities = sorted.map((event) => event.activityName);
      pathCounts.set(activities.join(' > '), (pathCounts.get(activities.join(' > ')) ?? 0) + 1);
      const seen = new Set<string>();
      for (let index = 0; index < sorted.length; index += 1) {
        const event = sorted[index];
        if (!event) continue;
        activityCounts.set(event.activityName, (activityCounts.get(event.activityName) ?? 0) + 1);
        if (seen.has(event.activityName)) loops += 1;
        seen.add(event.activityName);
        const next = sorted[index + 1];
        if (next) {
          const key = `${event.activityName} -> ${next.activityName}`;
          const delta = (next.eventTimestamp.getTime() - event.eventTimestamp.getTime()) / 1000;
          transitionDurations.set(key, [...(transitionDurations.get(key) ?? []), delta]);
        }
      }
    }
    const mostFrequentActivity = [...activityCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const bottlenecks = [...transitionDurations.entries()]
      .map(([transition, values]) => ({
        transition,
        average_duration_seconds: Math.round(this.average(values)),
      }))
      .sort((a, b) => b.average_duration_seconds - a.average_duration_seconds);
    return {
      cases: byCase.size,
      events: events.length,
      distinct_activities: activityCounts.size,
      average_case_duration_seconds: Math.round(this.average(durations)),
      median_case_duration_seconds: Math.round(this.median(durations)),
      most_frequent_activity: mostFrequentActivity
        ? { name: mostFrequentActivity[0], count: mostFrequentActivity[1] }
        : null,
      paths: [...pathCounts.entries()].map(([path, count]) => ({ path, count })),
      loops,
      bottlenecks,
    };
  }

  private async ensureProcess(ctx: TenantAccessContext, id: string) {
    this.assertCanRead(ctx);
    const process = await this.prisma.process.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null, ...this.directionScope(ctx) },
    });
    if (!process) throw new NotFoundException('Processus introuvable.');
    return process;
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
      throw new ForbiddenException('Ecriture processus refusee.');
    }
  }

  private score(probability?: number, impact?: number) {
    return probability && impact ? probability * impact : undefined;
  }

  private riskLevel(score?: number) {
    if (!score) return undefined;
    if (score >= 16) return RiskLevel.CRITICAL;
    if (score >= 10) return RiskLevel.HIGH;
    if (score >= 5) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  private average(values: Array<number | null | undefined>) {
    const valid = values.filter((value): value is number => typeof value === 'number');
    if (!valid.length) return 0;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  }

  private median(values: number[]) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? (sorted[middle] ?? 0)
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
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
