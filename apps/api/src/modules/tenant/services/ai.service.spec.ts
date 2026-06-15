import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AiSuggestionStatus, ProcessStatus } from '../../../generated/prisma';
import { TenantAccessContext } from '../guards/tenant-access.guard';
import { TenantAiService } from './ai.service';

const metadata = { ip: '127.0.0.1', userAgent: 'vitest' };

function createPrismaMock() {
  return {
    process: { findFirst: vi.fn() },
    tenantFeature: { findFirst: vi.fn() },
    aiGeneration: { count: vi.fn(), create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    aiSuggestion: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    kpi: { create: vi.fn() },
    risk: { create: vi.fn() },
    control: { create: vi.fn() },
    automationNeed: { create: vi.fn() },
    comment: { create: vi.fn() },
  };
}

function createService(rawText = validAiJson()) {
  const prisma = createPrismaMock();
  const config = { get: vi.fn((key: string) => (key === 'AI_PROVIDER' ? 'mock-ai' : '50')) };
  const mockProvider = {
    generate: vi.fn().mockResolvedValue({ provider: 'mock-ai', model: 'mock-v1', rawText }),
  };
  const azureProvider = { generate: vi.fn() };
  return {
    service: new TenantAiService(
      prisma as never,
      config as never,
      mockProvider as never,
      azureProvider as never,
    ),
    prisma,
    mockProvider,
  };
}

function tenantAdmin(overrides: Partial<TenantAccessContext> = {}): TenantAccessContext {
  return {
    tenantId: 'tenant-a',
    actorUserId: 'admin-a',
    membershipId: 'membership-a',
    tenantRoles: ['tenant_admin'],
    permissions: [
      'manage_directions',
      'manage_ai_suggestions',
      'create_process',
      'update_process_working_copy',
      'validate_process',
    ],
    directionIds: [],
    isSupportAccess: false,
    ...overrides,
  };
}

function readonly() {
  return tenantAdmin({ tenantRoles: ['readonly'], permissions: [] });
}

function consultant() {
  return tenantAdmin({
    tenantRoles: ['consultant'],
    permissions: ['manage_ai_suggestions', 'create_process', 'update_process_working_copy'],
  });
}

function validator() {
  return tenantAdmin({ tenantRoles: ['validator'], permissions: ['review_process'] });
}

function referent(directionIds = ['direction-a']) {
  return tenantAdmin({
    tenantRoles: ['direction_referent'],
    directionIds,
    permissions: ['manage_ai_suggestions', 'create_process', 'update_process_working_copy'],
  });
}

function superAdminWithoutSupportGrant() {
  return tenantAdmin({
    tenantRoles: [],
    permissions: [],
    directionIds: [],
    isSupportAccess: false,
  });
}

function processFixture(overrides = {}) {
  return {
    id: 'process-a',
    tenantId: 'tenant-a',
    directionId: 'direction-a',
    code: 'FIN-CLOT',
    name: 'Cloture',
    objective: 'Objectif',
    scope: 'Finance',
    triggerEvent: 'Fin de mois',
    status: ProcessStatus.DRAFT,
    direction: { id: 'direction-a', name: 'Finance' },
    ownerActor: { id: 'actor-a', name: 'Owner' },
    inputs: [],
    outputs: [],
    activities: [],
    actorRoles: [],
    documents: [],
    applications: [],
    kpis: [],
    risks: [],
    moroccoCompliance: null,
    eventLogImports: [],
    raciAssessments: [],
    bpmnModels: [],
    ...overrides,
  };
}

function suggestionFixture(overrides = {}) {
  return {
    id: 'suggestion-a',
    tenantId: 'tenant-a',
    processId: 'process-a',
    suggestionType: 'kpi',
    status: AiSuggestionStatus.PROPOSED,
    content: {
      title: 'Suggestion',
      description: 'Description',
      category: 'kpi',
      priority: 'medium',
      rationale: 'Raison',
    },
    createdAt: new Date(),
    ...overrides,
  };
}

function validAiJson() {
  return JSON.stringify({
    summary: 'Synthese',
    findings: [{ type: 'recommendation', title: 'Constat', description: 'Desc' }],
    suggestions: [
      {
        category: 'kpi_suggestions',
        title: 'Delai',
        description: 'Mesurer le delai',
        targetEntity: 'kpi',
        priority: 'medium',
        rationale: 'Pilotage',
      },
    ],
    limitations: ['Validation humaine requise'],
  });
}

function arrangeHappyPath(prisma: ReturnType<typeof createPrismaMock>) {
  prisma.tenantFeature.findFirst.mockResolvedValue({ id: 'feature-a' });
  prisma.aiGeneration.count.mockResolvedValue(0);
  prisma.process.findFirst.mockResolvedValue(processFixture());
  prisma.aiGeneration.create.mockResolvedValue({ id: 'generation-a', provider: 'mock-ai' });
  prisma.aiSuggestion.create.mockResolvedValue(suggestionFixture());
  prisma.auditLog.create.mockResolvedValue({});
}

describe('TenantAiService', () => {
  it('refuses generation when ai_copilot is disabled', async () => {
    const { service, prisma } = createService();
    prisma.tenantFeature.findFirst.mockResolvedValue(null);
    await expect(
      service.generate(
        tenantAdmin(),
        'process-a',
        { generation_type: 'kpi_suggestions' },
        metadata,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'ai_feature_disabled' }) }),
    );
  });

  it('persists mock generation and suggestions', async () => {
    const { service, prisma } = createService();
    arrangeHappyPath(prisma);
    const result = await service.generate(
      tenantAdmin(),
      'process-a',
      { generation_type: 'kpi_suggestions' },
      metadata,
    );
    expect(result.suggestions).toHaveLength(1);
    expect(prisma.aiGeneration.create).toHaveBeenCalled();
    expect(prisma.aiSuggestion.create).toHaveBeenCalled();
  });

  it('refuses invalid JSON provider output', async () => {
    const { service, prisma } = createService('not-json');
    arrangeHappyPath(prisma);
    await expect(
      service.generate(
        tenantAdmin(),
        'process-a',
        { generation_type: 'risk_suggestions' },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('changes suggestion statuses with audit', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(processFixture());
    prisma.aiSuggestion.findFirst.mockResolvedValue(suggestionFixture());
    prisma.aiSuggestion.update.mockImplementation(async ({ data }) => ({
      ...suggestionFixture(),
      ...data,
    }));
    await expect(
      service.accept(tenantAdmin(), 'process-a', 'suggestion-a', metadata),
    ).resolves.toMatchObject({ status: 'ACCEPTED' });
    await expect(
      service.reject(tenantAdmin(), 'process-a', 'suggestion-a', metadata),
    ).resolves.toMatchObject({ status: 'REJECTED' });
    await expect(
      service.modify(
        tenantAdmin(),
        'process-a',
        'suggestion-a',
        { content: { title: 'Modifiee' } },
        metadata,
      ),
    ).resolves.toMatchObject({ status: 'MODIFIED' });
    await expect(
      service.validate(validator(), 'process-a', 'suggestion-a', metadata),
    ).resolves.toMatchObject({ status: 'VALIDATED' });
  });

  it('creates KPI, risk, control, backlog item and procedure draft from suggestions', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(processFixture());
    prisma.aiSuggestion.findFirst.mockResolvedValue(suggestionFixture());
    prisma.kpi.create.mockResolvedValue({ id: 'kpi-a' });
    prisma.risk.create.mockResolvedValue({ id: 'risk-a' });
    prisma.control.create.mockResolvedValue({ id: 'control-a' });
    prisma.automationNeed.create.mockResolvedValue({ id: 'backlog-a' });
    prisma.comment.create.mockResolvedValue({ id: 'comment-a' });
    await expect(
      service.createKpi(tenantAdmin(), 'process-a', 'suggestion-a', {}, metadata),
    ).resolves.toMatchObject({ id: 'kpi-a' });
    await expect(
      service.createRisk(tenantAdmin(), 'process-a', 'suggestion-a', metadata),
    ).resolves.toMatchObject({ id: 'risk-a' });
    await expect(
      service.createControl(tenantAdmin(), 'process-a', 'suggestion-a', metadata),
    ).resolves.toMatchObject({ id: 'control-a' });
    await expect(
      service.createBacklogItem(tenantAdmin(), 'process-a', 'suggestion-a', metadata),
    ).resolves.toMatchObject({ id: 'backlog-a' });
    await expect(
      service.insertProcedureDraft(tenantAdmin(), 'process-a', 'suggestion-a', metadata),
    ).resolves.toMatchObject({ id: 'comment-a' });
  });

  it('enforces role, scope, tenant and quota rules', async () => {
    const { service, prisma } = createService();
    await expect(
      service.generate(readonly(), 'process-a', { generation_type: 'kpi_suggestions' }, metadata),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.validate(consultant(), 'process-a', 'suggestion-a', metadata),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.generate(
        superAdminWithoutSupportGrant(),
        'process-a',
        { generation_type: 'kpi_suggestions' },
        metadata,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.tenantFeature.findFirst.mockResolvedValue({ id: 'feature-a' });
    prisma.aiGeneration.count.mockResolvedValue(50);
    await expect(
      service.generate(
        tenantAdmin(),
        'process-a',
        { generation_type: 'kpi_suggestions' },
        metadata,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.aiGeneration.count.mockResolvedValue(0);
    prisma.process.findFirst.mockResolvedValue(null);
    await expect(
      service.generate(
        referent(['other-direction']),
        'process-a',
        { generation_type: 'kpi_suggestions' },
        metadata,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.process.findFirst.mockResolvedValue(processFixture());
    prisma.aiSuggestion.findFirst.mockResolvedValue(null);
    await expect(
      service.accept(tenantAdmin(), 'process-a', 'tenant-b-suggestion', metadata),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('filters generations by tenant and process', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(processFixture());
    prisma.aiGeneration.findMany.mockResolvedValue([]);
    await service.generations(tenantAdmin(), 'process-a');
    expect(prisma.aiGeneration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-a',
          inputRef: { path: ['process_id'], equals: 'process-a' },
        }),
      }),
    );
  });
});
