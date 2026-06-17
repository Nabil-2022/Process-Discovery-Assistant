import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { ExportFormat, ExportJobStatus, NotificationType, Prisma } from '../../../generated/prisma';
import { RequestMetadata } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { CreateExportDto, ExportFormatDto, ExportType } from '../dto/export.dto';
import { TenantAccessContext } from '../guards/tenant-access.guard';
import {
  BuiltExportFile,
  buildCsvFile,
  buildDocxFile,
  buildJsonFile,
  buildPdfFile,
  safeStringify,
  buildXlsxFile,
  buildXmlFile,
  buildZipFile,
} from './export-file.builder';

const EXPORT_PERMISSION = 'export_process';
const EXPORT_PROCESS_INCLUDE = {
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
  automationNeeds: true,
  moroccoCompliance: true,
  eventLogImports: { orderBy: { createdAt: 'desc' }, take: 5 },
  bpmnModels: { orderBy: { generatedAt: 'desc' }, take: 1 },
  raciAssessments: { orderBy: { generatedAt: 'desc' }, take: 1 },
  procedureDocuments: {
    orderBy: { versionNumber: 'desc' },
    take: 1,
    include: { sections: { orderBy: { order: 'asc' } } },
  },
} satisfies Prisma.ProcessInclude;

type ExportProcess = Prisma.ProcessGetPayload<{ include: typeof EXPORT_PROCESS_INCLUDE }>;

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(ctx: TenantAccessContext, dto: CreateExportDto, metadata: RequestMetadata) {
    this.assertCanExport(ctx);
    if (dto.process_id) await this.ensureProcess(ctx, dto.process_id);
    const job = await this.prisma.exportJob.create({
      data: {
        tenantId: ctx.tenantId,
        processId: dto.process_id,
        directionId: dto.direction_id,
        requestedBy: ctx.actorUserId,
        exportType: dto.export_type,
        format: this.toPrismaFormat(dto.export_format),
        status: ExportJobStatus.PENDING,
        parameters: (dto.parameters ?? {}) as Prisma.InputJsonObject,
        metadata: { requested_at: new Date().toISOString() } as Prisma.InputJsonObject,
      },
    });
    await this.audit(ctx, 'export_requested', 'export_jobs', job.id, this.auditMeta(job), metadata);
    return this.processJob(ctx, job.id, metadata);
  }

  list(ctx: TenantAccessContext) {
    this.assertCanExport(ctx);
    return this.prisma.exportJob
      .findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
      .then((jobs) => jobs.map((job) => this.serializeJob(job)));
  }

  async get(ctx: TenantAccessContext, id: string) {
    this.assertCanExport(ctx);
    const job = await this.prisma.exportJob.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!job) throw new NotFoundException('Export introuvable.');
    return this.serializeJob(job);
  }

  async download(ctx: TenantAccessContext, id: string, metadata: RequestMetadata) {
    const job = await this.get(ctx, id);
    if (!job.objectKey || job.status !== ExportJobStatus.COMPLETED) {
      throw new NotFoundException('Fichier export indisponible.');
    }
    const buffer = await this.storage.readObject(job.objectKey);
    await this.audit(
      ctx,
      'export_downloaded',
      'export_jobs',
      job.id,
      this.auditMeta(job),
      metadata,
    );
    return { job, buffer };
  }

  async cancel(ctx: TenantAccessContext, id: string, metadata: RequestMetadata) {
    const job = await this.get(ctx, id);
    if (job.status !== ExportJobStatus.PENDING)
      throw new ForbiddenException('Export non annulable.');
    const updated = await this.prisma.exportJob.update({
      where: { id },
      data: { status: ExportJobStatus.CANCELLED },
    });
    await this.audit(ctx, 'export_cancelled', 'export_jobs', id, this.auditMeta(updated), metadata);
    return updated;
  }

  async retry(ctx: TenantAccessContext, id: string, metadata: RequestMetadata) {
    const job = await this.get(ctx, id);
    if (job.status !== ExportJobStatus.FAILED)
      throw new ForbiddenException('Export non relancable.');
    await this.prisma.exportJob.update({
      where: { id },
      data: { status: ExportJobStatus.PENDING, errorMessage: null, failedAt: null },
    });
    await this.audit(ctx, 'export_retried', 'export_jobs', id, this.auditMeta(job), metadata);
    return this.processJob(ctx, id, metadata);
  }

  processExport(
    ctx: TenantAccessContext,
    processId: string,
    type: ExportType,
    format: ExportFormatDto,
    metadata: RequestMetadata,
  ) {
    return this.create(
      ctx,
      { process_id: processId, export_type: type, export_format: format },
      metadata,
    );
  }

  directionSummary(
    ctx: TenantAccessContext,
    directionId: string,
    format: ExportFormatDto,
    metadata: RequestMetadata,
  ) {
    return this.create(
      ctx,
      { direction_id: directionId, export_type: 'direction_summary', export_format: format },
      metadata,
    );
  }

  executiveSummary(ctx: TenantAccessContext, format: ExportFormatDto, metadata: RequestMetadata) {
    return this.create(ctx, { export_type: 'executive_summary', export_format: format }, metadata);
  }

  private async processJob(ctx: TenantAccessContext, id: string, metadata: RequestMetadata) {
    const started = await this.prisma.exportJob.update({
      where: { id },
      data: { status: ExportJobStatus.PROCESSING, startedAt: new Date() },
    });
    await this.audit(ctx, 'export_started', 'export_jobs', id, this.auditMeta(started), metadata);
    try {
      const file = await this.buildFile(ctx, started);
      const stored = await this.storage.uploadBuffer({
        tenantId: ctx.tenantId,
        exportJobId: id,
        filename: file.filename,
        buffer: file.buffer,
      });
      const completed = await this.prisma.exportJob.update({
        where: { id },
        data: {
          status: ExportJobStatus.COMPLETED,
          completedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          storageProvider: stored.storageProvider,
          bucket: stored.bucket,
          objectKey: stored.objectKey,
          fileName: file.filename,
          mimeType: file.mimeType,
          size: stored.size,
          checksum: stored.checksum,
        },
      });
      await this.audit(
        ctx,
        'export_completed',
        'export_jobs',
        id,
        this.auditMeta(completed),
        metadata,
      );
      await this.notifyExport(ctx, completed, 'completed');
      return this.serializeJob(completed);
    } catch (error) {
      const failed = await this.prisma.exportJob.update({
        where: { id },
        data: {
          status: ExportJobStatus.FAILED,
          failedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Erreur export',
        },
      });
      await this.audit(ctx, 'export_failed', 'export_jobs', id, this.auditMeta(failed), metadata);
      await this.notifyExport(ctx, failed, 'failed');
      return this.serializeJob(failed);
    }
  }

  private async notifyExport(
    ctx: TenantAccessContext,
    job: Prisma.ExportJobGetPayload<object>,
    result: 'completed' | 'failed',
  ) {
    if (!job.requestedBy) return;
    await this.prisma.notification.create({
      data: {
        tenantId: ctx.tenantId,
        userId: job.requestedBy,
        type:
          result === 'completed'
            ? NotificationType.EXPORT_COMPLETED
            : NotificationType.EXPORT_FAILED,
        title: result === 'completed' ? 'Export pret' : 'Export en echec',
        body:
          result === 'completed'
            ? `Votre export ${job.exportType} est disponible.`
            : `Votre export ${job.exportType} n'a pas pu etre genere.`,
        severity: result === 'completed' ? 'success' : 'warning',
        actionUrl: '/tenant/exports',
        resourceType: 'export_jobs',
        resourceId: job.id,
        metadata: this.auditMeta(job),
      },
    });
  }

  private async buildFile(
    ctx: TenantAccessContext,
    job: Prisma.ExportJobGetPayload<object>,
  ): Promise<BuiltExportFile> {
    if (job.exportType === 'direction_summary' || job.exportType === 'executive_summary') {
      return this.buildGeneric(job, await this.summaryData(ctx, job));
    }
    const process = job.processId ? await this.ensureProcess(ctx, job.processId) : null;
    const data = this.exportData(job.exportType as ExportType, process);
    return this.buildGeneric(job, data);
  }

  private buildGeneric(job: Prisma.ExportJobGetPayload<object>, data: unknown): BuiltExportFile {
    const type = job.exportType as ExportType;
    const format = job.format;
    const base = `${type}-${job.id}`;
    if (format === ExportFormat.JSON) return buildJsonFile(`${base}.json`, data);
    if (format === ExportFormat.PDF) return buildPdfFile(`${base}.pdf`, type, data);
    if (format === ExportFormat.DOCX) return buildDocxFile(`${base}.docx`, type, data);
    if (format === ExportFormat.XLSX)
      return buildXlsxFile(`${base}.xlsx`, this.rowsFor(type, data));
    if (format === ExportFormat.CSV) return buildCsvFile(`${base}.csv`, this.rowsFor(type, data));
    if (format === ExportFormat.BPMN_XML) return buildXmlFile(`${base}.bpmn`, this.bpmnXml(data));
    if (format === ExportFormat.ZIP) {
      return buildZipFile(`${base}.zip`, [
        buildJsonFile('donnees.json', data),
        buildPdfFile('procedure.pdf', type, data),
        buildDocxFile('procedure.docx', type, data),
        buildXlsxFile('raci.xlsx', this.rowsFor('raci_matrix', data)),
        buildXlsxFile('risques.xlsx', this.rowsFor('risk_register', data)),
        buildXlsxFile('kpi.xlsx', this.rowsFor('kpi_register', data)),
        buildXlsxFile('backlog.xlsx', this.rowsFor('backlog', data)),
        buildXmlFile('bpmn.bpmn', this.bpmnXml(data)),
        buildJsonFile('manifest.json', {
          export_type: type,
          generated_at: new Date().toISOString(),
        }),
      ]);
    }
    return buildJsonFile(`${base}.json`, data);
  }

  private exportData(type: ExportType, process: ExportProcess | null) {
    if (!process) return { export_type: type };
    const base = {
      export_type: type,
      exported_at: new Date().toISOString(),
      process: {
        id: process.id,
        name: process.name,
        code: process.code,
        status: process.status,
        direction: process.direction?.name,
        owner: process.ownerActor?.name,
        objective: process.objective,
        scope: process.scope,
        completeness_score: process.completenessScore,
      },
      inputs: process.inputs,
      outputs: process.outputs,
      activities: process.activities,
      actors: process.actorRoles,
      applications: process.applications,
      documents: process.documents,
      kpis: process.kpis,
      risks: process.risks,
      backlog: process.automationNeeds,
      morocco: process.moroccoCompliance
        ? {
            ...process.moroccoCompliance,
            notice:
              'Cet export facilite la structuration, la documentation et la tracabilite. Il ne constitue pas un avis juridique et ne garantit pas a lui seul la conformite reglementaire.',
          }
        : null,
      bpmn: process.bpmnModels[0] ?? null,
      raci: process.raciAssessments[0] ?? null,
      procedure: process.procedureDocuments[0]
        ? {
            ...process.procedureDocuments[0],
            notice:
              "Structure documentaire facilitant l'alignement avec un systeme de management de la qualite. Ce document ne constitue pas une certification ISO 9001 automatique.",
            watermark:
              process.procedureDocuments[0].status === 'published' ? null : 'Version non publiee',
          }
        : null,
      process_mining: process.eventLogImports,
    };
    return base;
  }

  private rowsFor(type: string, data: unknown): unknown[][] {
    const value = data as {
      kpis?: unknown[];
      risks?: unknown[];
      backlog?: unknown[];
      activities?: unknown[];
    };
    if (type === 'kpi_register')
      return [
        ['Nom', 'Statut'],
        ...(value.kpis ?? []).map((item) => [field(item, 'name'), field(item, 'status')]),
      ];
    if (type === 'risk_register')
      return [
        ['Risque', 'Categorie'],
        ...(value.risks ?? []).map((item) => [field(item, 'description'), field(item, 'category')]),
      ];
    if (type === 'backlog')
      return [
        ['Description', 'Priorite'],
        ...(value.backlog ?? []).map((item) => [
          field(item, 'description'),
          field(item, 'priority'),
        ]),
      ];
    if (type === 'raci_matrix')
      return [
        ['Activite', 'Acteur', 'Role'],
        ...(
          (
            data as {
              actors?: { activityId?: string; actor?: { name?: string }; raciRole?: string }[];
            }
          ).actors ?? []
        ).map((item) => [item.activityId, item.actor?.name, item.raciRole]),
      ];
    return [
      ['Cle', 'Valeur'],
      ...Object.entries(data as Record<string, unknown>).map(([key, value]) => [
        key,
        safeStringify(value),
      ]),
    ];
  }

  private bpmnXml(data: unknown) {
    const bpmn = (data as { bpmn?: { bpmnXml?: string } }).bpmn;
    return (
      bpmn?.bpmnXml ?? '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions></bpmn:definitions>'
    );
  }

  private async summaryData(ctx: TenantAccessContext, job: Prisma.ExportJobGetPayload<object>) {
    const processes = await this.prisma.process.findMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        ...(job.directionId ? { directionId: job.directionId } : {}),
      },
      include: { direction: true, risks: true, automationNeeds: true, kpis: true },
      take: 200,
    });
    return {
      export_type: job.exportType,
      direction_id: job.directionId,
      process_count: processes.length,
      validated_processes: processes.filter((item) =>
        ['APPROVED', 'PUBLISHED'].includes(item.status),
      ).length,
      risks: processes.flatMap((item) => item.risks),
      kpis: processes.flatMap((item) => item.kpis),
      backlog: processes.flatMap((item) => item.automationNeeds),
    };
  }

  private async ensureProcess(ctx: TenantAccessContext, id: string): Promise<ExportProcess> {
    this.assertCanExport(ctx);
    const process = await this.prisma.process.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null, ...this.directionScope(ctx) },
      include: EXPORT_PROCESS_INCLUDE,
    });
    if (!process) throw new NotFoundException('Processus introuvable.');
    if (
      ctx.tenantRoles.includes('readonly') &&
      !process.procedureDocuments.some((item) => item.status === 'published')
    ) {
      throw new ForbiddenException('Export non autorise pour readonly.');
    }
    return process;
  }

  private directionScope(ctx: TenantAccessContext) {
    if (ctx.isSupportAccess || this.hasTenantWideRead(ctx)) return {};
    return { directionId: { in: ctx.directionIds } };
  }

  private hasTenantWideRead(ctx: TenantAccessContext) {
    return ctx.tenantRoles.some((role) => ['tenant_admin', 'validator', 'readonly'].includes(role));
  }

  private assertCanExport(ctx: TenantAccessContext) {
    if (!ctx.isSupportAccess && !ctx.tenantRoles.length)
      throw new ForbiddenException('Export refuse.');
    if (
      !ctx.permissions.includes(EXPORT_PERMISSION) &&
      !ctx.permissions.includes('manage_directions')
    ) {
      throw new ForbiddenException('Export refuse.');
    }
  }

  private toPrismaFormat(format: ExportFormatDto) {
    return format.toUpperCase() as ExportFormat;
  }

  private auditMeta(job: {
    processId?: string | null;
    directionId?: string | null;
    exportType: string;
    format: ExportFormat;
    status: ExportJobStatus;
    fileName?: string | null;
    checksum?: string | null;
    size?: bigint | null;
  }) {
    return {
      process_id: job.processId,
      direction_id: job.directionId,
      export_type: job.exportType,
      export_format: job.format,
      status: job.status,
      file_name: job.fileName,
      checksum: job.checksum,
      size: job.size ? Number(job.size) : undefined,
    };
  }

  private serializeJob<T extends { size?: bigint | number | null }>(job: T) {
    return {
      ...job,
      size: typeof job.size === 'bigint' ? Number(job.size) : job.size,
    };
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

function field(value: unknown, key: string) {
  return value && typeof value === 'object'
    ? String((value as Record<string, unknown>)[key] ?? '')
    : '';
}
