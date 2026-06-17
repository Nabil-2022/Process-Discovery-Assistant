import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ExportFormat, ExportJobStatus, ProcessStatus } from '../../../generated/prisma';
import { TenantAccessContext } from '../guards/tenant-access.guard';
import { ExportService } from './export.service';

const metadata = { ip: '127.0.0.1', userAgent: 'vitest' };

function createPrismaMock() {
  return {
    exportJob: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    process: { findFirst: vi.fn(), findMany: vi.fn() },
    notification: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
}

function createService() {
  const prisma = createPrismaMock();
  const storage = {
    uploadBuffer: vi.fn(async ({ tenantId, exportJobId, filename, buffer }) => ({
      storageProvider: 'local',
      bucket: 'process-discovery-exports',
      objectKey: `tenants/${tenantId}/exports/${exportJobId}/${filename}`,
      size: BigInt(buffer.length),
      checksum: `checksum-${buffer.length}`,
    })),
    readObject: vi.fn(async () => Buffer.from('export-content')),
  };
  return { service: new ExportService(prisma as never, storage as never), prisma, storage };
}

function tenantAdmin(overrides: Partial<TenantAccessContext> = {}): TenantAccessContext {
  return {
    tenantId: 'tenant-a',
    actorUserId: 'admin-a',
    membershipId: 'membership-a',
    tenantRoles: ['tenant_admin'],
    permissions: ['manage_directions', 'export_process'],
    directionIds: [],
    isSupportAccess: false,
    ...overrides,
  };
}

function readonly() {
  return tenantAdmin({ tenantRoles: ['readonly'], permissions: ['export_process'] });
}

function superAdminWithoutGrant() {
  return tenantAdmin({
    tenantRoles: [],
    permissions: [],
    directionIds: [],
    isSupportAccess: false,
  });
}

function job(overrides = {}) {
  return {
    id: 'export-a',
    tenantId: 'tenant-a',
    processId: 'process-a',
    directionId: null,
    requestedBy: 'admin-a',
    exportType: 'process_sheet',
    format: ExportFormat.PDF,
    status: ExportJobStatus.PENDING,
    fileName: null,
    mimeType: null,
    checksum: null,
    size: null,
    objectKey: null,
    ...overrides,
  };
}

function processFixture(overrides = {}) {
  return {
    id: 'process-a',
    tenantId: 'tenant-a',
    directionId: 'direction-a',
    name: 'Cloture',
    code: 'FIN-CLOT',
    status: ProcessStatus.APPROVED,
    objective: 'Objectif',
    scope: 'Finance',
    completenessScore: 90,
    direction: { name: 'Finance' },
    ownerActor: { name: 'Owner' },
    inputs: [{ name: 'Input' }],
    outputs: [{ name: 'Output' }],
    activities: [{ id: 'activity-a', name: 'Controler' }],
    actorRoles: [{ activityId: 'activity-a', actor: { name: 'Owner' }, raciRole: 'A' }],
    documents: [{ document: { title: 'Doc', version: '1.0' } }],
    applications: [{ application: { name: 'ERP' } }],
    kpis: [{ name: 'Delai', status: 'VALIDATED' }],
    risks: [{ description: 'Retard', category: 'Qualite', controls: [] }],
    automationNeeds: [{ description: 'Automatiser', priority: 'HIGH' }],
    moroccoCompliance: { law5519Applicable: true, isUserFacingProcess: true },
    eventLogImports: [{ id: 'import-a', status: 'ANALYZED', rowCount: 2 }],
    bpmnModels: [{ bpmnXml: '<bpmn:definitions />', sourceHash: 'bpmn-hash' }],
    raciAssessments: [{ sourceHash: 'raci-hash', validationStatus: 'VALIDATED' }],
    procedureDocuments: [{ id: 'procedure-a', status: 'published', sections: [] }],
    ...overrides,
  };
}

function arrangeCreate(
  prisma: ReturnType<typeof createPrismaMock>,
  type: string,
  format: ExportFormat,
) {
  prisma.process.findFirst.mockResolvedValue(processFixture());
  prisma.exportJob.create.mockResolvedValue(job({ exportType: type, format }));
  prisma.exportJob.update
    .mockResolvedValueOnce(job({ exportType: type, format, status: ExportJobStatus.PROCESSING }))
    .mockImplementationOnce(async ({ data }) => job({ exportType: type, format, ...data }));
  prisma.auditLog.create.mockResolvedValue({});
}

describe('ExportService', () => {
  it.each([
    ['process_sheet', ExportFormat.PDF],
    ['procedure', ExportFormat.DOCX],
    ['raci_matrix', ExportFormat.XLSX],
    ['bpmn_diagram', ExportFormat.BPMN_XML],
    ['risk_register', ExportFormat.XLSX],
    ['kpi_register', ExportFormat.XLSX],
    ['backlog', ExportFormat.XLSX],
    ['process_sheet', ExportFormat.JSON],
    ['full_package', ExportFormat.ZIP],
  ])('creates %s export in %s', async (type, format) => {
    const { service, prisma, storage } = createService();
    arrangeCreate(prisma, type, format);

    const result = await service.create(
      tenantAdmin(),
      {
        process_id: 'process-a',
        export_type: type as never,
        export_format: format.toLowerCase() as never,
      },
      metadata,
    );

    expect(result.status).toBe(ExportJobStatus.COMPLETED);
    expect(storage.uploadBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        exportJobId: 'export-a',
        buffer: expect.any(Buffer),
      }),
    );
    const upload = storage.uploadBuffer.mock.calls[0]?.[0];
    expect(upload).toBeDefined();
    if (!upload) throw new Error('upload missing');
    expect(upload.buffer.length).toBeGreaterThan(0);
    expect(String(result.objectKey)).toContain('tenants/tenant-a/exports/export-a/');
    expect(result.checksum).toContain('checksum-');
  });

  it('marks job failed when generator fails', async () => {
    const { service, prisma, storage } = createService();
    prisma.process.findFirst.mockResolvedValue(processFixture());
    prisma.exportJob.create.mockResolvedValue(job());
    prisma.exportJob.update
      .mockResolvedValueOnce(job({ status: ExportJobStatus.PROCESSING }))
      .mockImplementationOnce(async ({ data }) => job({ ...data }));
    storage.uploadBuffer.mockRejectedValueOnce(new Error('storage down'));

    const result = await service.create(
      tenantAdmin(),
      { process_id: 'process-a', export_type: 'process_sheet', export_format: 'pdf' },
      metadata,
    );

    expect(result.status).toBe(ExportJobStatus.FAILED);
  });

  it('exports records that contain bigint values', async () => {
    const { service, prisma, storage } = createService();
    prisma.process.findFirst.mockResolvedValue(
      processFixture({ eventLogImports: [{ id: 'import-a', status: 'ANALYZED', rowCount: 10n }] }),
    );
    prisma.exportJob.create.mockResolvedValue(job());
    prisma.exportJob.update
      .mockResolvedValueOnce(job({ status: ExportJobStatus.PROCESSING }))
      .mockImplementationOnce(async ({ data }) => job({ ...data }));
    prisma.auditLog.create.mockResolvedValue({});

    const result = await service.create(
      tenantAdmin(),
      { process_id: 'process-a', export_type: 'process_sheet', export_format: 'pdf' },
      metadata,
    );

    expect(result.status).toBe(ExportJobStatus.COMPLETED);
    expect(storage.uploadBuffer).toHaveBeenCalled();
  });

  it('refuses download for another tenant and audits download', async () => {
    const { service, prisma, storage } = createService();
    prisma.exportJob.findFirst.mockResolvedValue(null);
    await expect(service.download(tenantAdmin(), 'other-job', metadata)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.exportJob.findFirst.mockResolvedValue(
      job({
        status: ExportJobStatus.COMPLETED,
        objectKey: 'tenants/tenant-a/exports/export-a/file.pdf',
        fileName: 'file.pdf',
      }),
    );
    const result = await service.download(tenantAdmin(), 'export-a', metadata);
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(storage.readObject).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'export_downloaded' }) }),
    );
  });

  it('refuses readonly when process export is not published and refuses super admin without grant', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(
      processFixture({ procedureDocuments: [{ status: 'draft' }] }),
    );
    await expect(
      service.create(
        readonly(),
        { process_id: 'process-a', export_type: 'process_sheet', export_format: 'pdf' },
        metadata,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.create(
        superAdminWithoutGrant(),
        { process_id: 'process-a', export_type: 'process_sheet', export_format: 'pdf' },
        metadata,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cancels pending and retries failed jobs', async () => {
    const { service, prisma, storage } = createService();
    prisma.exportJob.findFirst.mockResolvedValueOnce(job());
    prisma.exportJob.update.mockResolvedValueOnce(job({ status: ExportJobStatus.CANCELLED }));
    await expect(service.cancel(tenantAdmin(), 'export-a', metadata)).resolves.toMatchObject({
      status: ExportJobStatus.CANCELLED,
    });

    prisma.process.findFirst.mockResolvedValue(processFixture());
    prisma.exportJob.findFirst.mockResolvedValue(job({ status: ExportJobStatus.FAILED }));
    prisma.exportJob.update
      .mockResolvedValueOnce(job({ status: ExportJobStatus.PENDING }))
      .mockResolvedValueOnce(job({ status: ExportJobStatus.PROCESSING }))
      .mockImplementationOnce(async ({ data }) => job({ ...data }));
    storage.uploadBuffer.mockResolvedValue({
      storageProvider: 'local',
      bucket: 'process-discovery-exports',
      objectKey: 'tenants/tenant-a/exports/export-a/process_sheet-export-a.pdf',
      size: 10n,
      checksum: 'checksum-10',
    });
    prisma.exportJob.findFirst.mockResolvedValue(job({ status: ExportJobStatus.FAILED }));
    await expect(service.retry(tenantAdmin(), 'export-a', metadata)).resolves.toMatchObject({
      status: ExportJobStatus.COMPLETED,
    });
  });
});
