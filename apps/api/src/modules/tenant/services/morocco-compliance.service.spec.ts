import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { TenantAccessContext } from '../guards/tenant-access.guard';
import { MoroccoComplianceService } from './morocco-compliance.service';

const metadata = { ip: '127.0.0.1', userAgent: 'vitest' };

function createPrismaMock() {
  const prisma = {
    $transaction: vi.fn(async (handler: (tx: typeof prisma) => unknown) => handler(prisma)),
    process: { findMany: vi.fn(), findFirst: vi.fn() },
    moroccoProcessCompliance: { findUnique: vi.fn(), upsert: vi.fn() },
    risk: { create: vi.fn() },
    eventLogImport: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    eventLogCase: { create: vi.fn(), update: vi.fn() },
    eventLogEvent: { create: vi.fn(), findMany: vi.fn() },
    processMiningRun: { create: vi.fn() },
    bottleneckAnalysis: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return prisma;
}

function createService() {
  const prisma = createPrismaMock();
  return { service: new MoroccoComplianceService(prisma as never), prisma };
}

function tenantAdmin(overrides: Partial<TenantAccessContext> = {}): TenantAccessContext {
  return {
    tenantId: 'tenant-a',
    actorUserId: 'admin-a',
    membershipId: 'membership-admin',
    tenantRoles: ['tenant_admin'],
    permissions: ['manage_directions', 'create_process', 'update_process_working_copy'],
    directionIds: [],
    isSupportAccess: false,
    ...overrides,
  };
}

function referent(overrides: Partial<TenantAccessContext> = {}): TenantAccessContext {
  return tenantAdmin({
    actorUserId: 'ref-a',
    tenantRoles: ['direction_referent'],
    permissions: ['create_process', 'update_process_working_copy'],
    directionIds: ['direction-a'],
    ...overrides,
  });
}

function readonly() {
  return tenantAdmin({ tenantRoles: ['readonly'], permissions: ['export_process'] });
}

const process = {
  id: 'process-a',
  tenantId: 'tenant-a',
  directionId: 'direction-a',
  deletedAt: null,
};

describe('MoroccoComplianceService', () => {
  it('upserts Loi 55-19 readiness fields for a user-facing process', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process);
    prisma.moroccoProcessCompliance.upsert.mockResolvedValue({ id: 'compliance-a' });

    await service.upsertCompliance(
      tenantAdmin(),
      'process-a',
      {
        is_user_facing_process: true,
        law_55_19_applicable: true,
        current_channel: 'Physique',
        target_channel: 'Digital',
        current_processing_time_days: 10,
        target_processing_time_days: 3,
      },
      metadata,
    );

    expect(prisma.moroccoProcessCompliance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantId: 'tenant-a',
          processId: 'process-a',
          isUserFacingProcess: true,
          law5519Applicable: true,
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'morocco_compliance_saved' }),
      }),
    );
  });

  it('computes tenant dashboard indicators for user-facing process digitalization', async () => {
    const { service, prisma } = createService();
    prisma.process.findMany.mockResolvedValue([
      {
        id: 'process-a',
        moroccoCompliance: {
          isUserFacingProcess: true,
          currentChannel: 'Physique',
          targetChannel: 'Digital',
          digitalizationPriority: 'Haute',
          simplificationPriority: 'Haute',
          currentProcessingTimeDays: 10,
          targetProcessingTimeDays: 3,
          requiredDocumentsCount: 5,
          physicalVisitsRequired: 2,
        },
      },
      {
        id: 'process-b',
        moroccoCompliance: { isUserFacingProcess: false },
      },
    ]);

    const result = await service.dashboard(tenantAdmin());

    expect(result.user_facing_processes).toBe(1);
    expect(result.non_digitalized_user_facing_processes).toBe(1);
    expect(result.priority_processes).toBe(1);
    expect(result.target_digitalization_rate).toBe(100);
  });

  it('creates public audit risks with inherent and residual scores', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process);
    prisma.risk.create.mockResolvedValue({ id: 'risk-a' });

    await service.createPublicAuditRisk(
      tenantAdmin(),
      'process-a',
      {
        risk_description: 'Risque de delai usager non maitrise',
        risk_family: 'Conformite',
        risk_category: 'Audit public',
        inherent_probability: 3,
        inherent_impact: 4,
        residual_probability: 2,
        residual_impact: 3,
        court_of_accounts_relevance: true,
      },
      metadata,
    );

    expect(prisma.risk.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inherentScore: 12,
          residualScore: 6,
          courtOfAccountsRelevance: true,
        }),
      }),
    );
  });

  it('rejects CSV imports with missing event log minimum columns', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process);

    await expect(
      service.importCsv(
        tenantAdmin(),
        'process-a',
        { file_name: 'bad.csv', content: 'case_id,activity_name\nC1,Depot' },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('imports valid CSV events and stores cases/events in tenant scope', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process);
    prisma.eventLogImport.create.mockResolvedValue({ id: 'import-a' });
    prisma.eventLogCase.create.mockResolvedValueOnce({ id: 'case-a' });
    prisma.eventLogCase.update.mockResolvedValue({});
    prisma.eventLogEvent.create.mockResolvedValue({});
    prisma.eventLogImport.findFirst.mockResolvedValue({ id: 'import-a', cases: [] });

    await service.importCsv(
      tenantAdmin(),
      'process-a',
      {
        file_name: 'events.csv',
        content:
          'case_id,activity_name,event_timestamp,resource\nC1,Depot,2026-06-01T09:00:00Z,A\nC1,Decision,2026-06-01T10:00:00Z,B',
      },
      metadata,
    );

    expect(prisma.eventLogImport.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rowCount: 2 }) }),
    );
    expect(prisma.eventLogEvent.create).toHaveBeenCalledTimes(2);
  });

  it('analyzes cases, paths, loops and bottlenecks without pm4py', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process);
    prisma.eventLogImport.findFirst.mockResolvedValue({ id: 'import-a', cases: [] });
    prisma.eventLogEvent.findMany.mockResolvedValue([
      { caseId: 'C1', activityName: 'Depot', eventTimestamp: new Date('2026-06-01T09:00:00Z') },
      {
        caseId: 'C1',
        activityName: 'Instruction',
        eventTimestamp: new Date('2026-06-01T10:00:00Z'),
      },
      { caseId: 'C1', activityName: 'Depot', eventTimestamp: new Date('2026-06-01T11:00:00Z') },
    ]);
    prisma.processMiningRun.create.mockResolvedValue({ id: 'run-a' });
    prisma.bottleneckAnalysis.create.mockResolvedValue({});
    prisma.eventLogImport.update.mockResolvedValue({});

    const result = await service.analyzeBasic(tenantAdmin(), 'process-a', 'import-a', metadata);

    expect(result.cases).toBe(1);
    expect(result.loops).toBe(1);
    expect(result.bottlenecks.at(0)?.transition).toContain('Depot');
    expect(result.advanced_worker_message).toContain('worker Python');
  });

  it('refuses readonly imports and referents outside their directions', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(null);

    await expect(
      service.importCsv(
        readonly(),
        'process-a',
        {
          file_name: 'events.csv',
          content: 'case_id,activity_name,event_timestamp\nC1,Depot,2026-06-01T09:00:00Z',
        },
        metadata,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(service.getCompliance(referent(), 'process-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
