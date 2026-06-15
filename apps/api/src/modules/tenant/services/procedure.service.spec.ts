import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { RaciRole } from '../../../generated/prisma';
import { TenantAccessContext } from '../guards/tenant-access.guard';
import { ProcedureService } from './procedure.service';

const metadata = { ip: '127.0.0.1', userAgent: 'vitest' };

function createPrismaMock() {
  return {
    process: { findFirst: vi.fn() },
    procedureDocument: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    procedureSection: { upsert: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    procedureVersion: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    procedureApproval: { create: vi.fn() },
    automationNeed: { create: vi.fn() },
    aiSuggestion: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
}

function createService() {
  const prisma = createPrismaMock();
  return { service: new ProcedureService(prisma as never), prisma };
}

function tenantAdmin(overrides: Partial<TenantAccessContext> = {}): TenantAccessContext {
  return {
    tenantId: 'tenant-a',
    actorUserId: 'admin-a',
    membershipId: 'membership-a',
    tenantRoles: ['tenant_admin'],
    permissions: [
      'manage_directions',
      'create_process',
      'update_process_working_copy',
      'validate_process',
      'approve_process',
      'publish_process',
    ],
    directionIds: [],
    isSupportAccess: false,
    ...overrides,
  };
}

function readonly() {
  return tenantAdmin({ tenantRoles: ['readonly'], permissions: ['export_process'] });
}

function consultant() {
  return tenantAdmin({
    tenantRoles: ['consultant'],
    permissions: ['create_process', 'update_process_working_copy'],
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
    processOwnerActorId: 'actor-owner',
    code: 'FIN-CLOT',
    name: 'Cloture',
    description: 'Description',
    objective: 'Produire les comptes mensuels',
    scope: 'Finance',
    lockVersion: 1,
    direction: { id: 'direction-a', name: 'Finance' },
    ownerActor: { id: 'actor-owner', name: 'Owner' },
    inputs: [{ id: 'input-a', name: 'Factures' }],
    outputs: [{ id: 'output-a', name: 'Etats' }],
    activities: [{ id: 'activity-a', name: 'Controler', outputText: 'Dossier' }],
    actorRoles: [
      {
        activityId: 'activity-a',
        actorId: 'actor-owner',
        raciRole: RaciRole.ACCOUNTABLE,
        actor: { id: 'actor-owner', name: 'Owner' },
      },
    ],
    documents: [{ document: { id: 'doc-a', title: 'Procedure actuelle', version: '1.0' } }],
    applications: [{ application: { id: 'app-a', name: 'ERP' } }],
    kpis: [{ id: 'kpi-a', name: 'Delai' }],
    risks: [
      {
        id: 'risk-a',
        description: 'Retard',
        controls: [{ control: { id: 'control-a', name: 'Revue' } }],
      },
    ],
    moroccoCompliance: {
      isUserFacingProcess: true,
      law5519Applicable: true,
      currentChannel: 'physique',
      targetChannel: 'digital',
      simplificationPriority: 'HIGH',
      digitalizationPriority: 'HIGH',
    },
    eventLogImports: [{ id: 'import-a', status: 'ANALYZED', rowCount: 3 }],
    bpmnModels: [{ ruleVersion: 'bpmn-v1' }],
    bpmnVersions: [{ id: 'bpmn-version-a', versionNumber: 1 }],
    raciAssessments: [{ ruleVersion: 'raci-v1' }],
    raciVersions: [{ id: 'raci-version-a', versionNumber: 1 }],
    versions: [{ id: 'process-version-a', versionNumber: 1 }],
    validations: [{ id: 'validation-a', decision: 'APPROVED' }],
    ...overrides,
  };
}

function procedureFixture(overrides = {}) {
  return {
    id: 'procedure-a',
    tenantId: 'tenant-a',
    processId: 'process-a',
    reference: 'PROC-FIN-CLOT-V1',
    title: 'Procedure - Cloture',
    status: 'draft',
    versionNumber: 1,
    ruleVersion: 'process-discovery-procedure-v1',
    sourceHash: 'hash-a',
    approvedAt: null,
    approvedById: null,
    archivedAt: null,
    sections: [
      { id: 'section-objet', sectionKey: 'objet', title: 'Objet', order: 2, content: 'Objet' },
      {
        id: 'section-perimetre',
        sectionKey: 'perimetre',
        title: 'Perimetre',
        order: 3,
        content: 'Finance',
      },
      {
        id: 'section-resp',
        sectionKey: 'responsabilites',
        title: 'Responsabilites',
        order: 6,
        content: [],
      },
      {
        id: 'section-act',
        sectionKey: 'activites',
        title: 'Description des activites',
        order: 9,
        content: [],
      },
      { id: 'section-kpi', sectionKey: 'kpi', title: 'KPI', order: 12, content: [] },
      {
        id: 'section-risk',
        sectionKey: 'risques_controles',
        title: 'Risques et controles',
        order: 13,
        content: [],
      },
      {
        id: 'section-ma',
        sectionKey: 'conformite_maroc',
        title: 'Exigences administratives et conformite Maroc',
        order: 14,
        content: {},
      },
    ],
    approvals: [],
    ...overrides,
  };
}

describe('ProcedureService', () => {
  it('generates a deterministic procedure with required sections and audit', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(processFixture());
    prisma.procedureDocument.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue(procedureFixture());
    prisma.procedureDocument.create.mockResolvedValue(procedureFixture());
    prisma.procedureSection.upsert.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});

    const result = await service.generate(tenantAdmin(), 'process-a', metadata);

    expect(result.sections.map((section) => section.sectionKey)).toEqual(
      expect.arrayContaining([
        'objet',
        'perimetre',
        'responsabilites',
        'activites',
        'kpi',
        'risques_controles',
        'conformite_maroc',
      ]),
    );
    expect(prisma.procedureSection.upsert).toHaveBeenCalledTimes(20);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'procedure_generated' }) }),
    );
  });

  it('is idempotent for the same source data', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(processFixture());
    let calls = 0;
    prisma.procedureDocument.findFirst.mockImplementation(async () => {
      calls += 1;
      return calls === 1 || calls === 3 ? null : procedureFixture();
    });
    prisma.procedureDocument.create.mockResolvedValue(procedureFixture());
    prisma.procedureSection.upsert.mockResolvedValue({});

    await service.generate(tenantAdmin(), 'process-a', metadata);
    await service.generate(tenantAdmin(), 'process-a', metadata);

    const hashes = prisma.procedureDocument.create.mock.calls.map(
      (call) => call[0].data.sourceHash,
    );
    expect(new Set(hashes).size).toBe(1);
  });

  it('updates a section and audits human edition', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(processFixture());
    prisma.procedureDocument.findFirst.mockResolvedValue(procedureFixture());
    prisma.procedureSection.findFirst.mockResolvedValue({
      id: 'section-objet',
      sectionKey: 'objet',
      status: 'draft',
    });
    prisma.procedureSection.update.mockResolvedValue({ id: 'section-objet', source: 'manual' });

    await expect(
      service.updateSection(
        tenantAdmin(),
        'process-a',
        'section-objet',
        { content: { text: 'Objet modifie' }, status: 'ready' },
        metadata,
      ),
    ).resolves.toMatchObject({ source: 'manual' });
  });

  it('controls review, changes, approval, publication and archive transitions', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(processFixture());
    prisma.procedureDocument.findFirst.mockResolvedValue(procedureFixture());
    prisma.procedureDocument.update.mockImplementation(async ({ data }) => ({
      ...procedureFixture(),
      ...data,
    }));
    prisma.procedureApproval.create.mockResolvedValue({});
    prisma.procedureVersion.create.mockResolvedValue({ id: 'version-a' });

    await expect(service.submitReview(tenantAdmin(), 'process-a', metadata)).resolves.toMatchObject(
      { status: 'in_review' },
    );
    expect(() => service.requestChanges(tenantAdmin(), 'process-a', {}, metadata)).toThrow(
      BadRequestException,
    );
    await expect(
      service.requestChanges(tenantAdmin(), 'process-a', { comment: 'A corriger' }, metadata),
    ).resolves.toMatchObject({ status: 'changes_requested' });
    await expect(service.approve(tenantAdmin(), 'process-a', {}, metadata)).resolves.toMatchObject({
      status: 'approved',
    });
    prisma.procedureDocument.findFirst.mockResolvedValue(procedureFixture({ status: 'approved' }));
    await expect(service.publish(tenantAdmin(), 'process-a', {}, metadata)).resolves.toMatchObject({
      status: 'published',
    });
    prisma.procedureDocument.findFirst.mockResolvedValue(procedureFixture());
    await expect(
      service.archive(tenantAdmin(), 'process-a', { comment: 'Obsolete' }, metadata),
    ).resolves.toMatchObject({ status: 'archived' });
  });

  it('keeps published procedure immutable', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(processFixture());
    prisma.procedureDocument.findFirst.mockResolvedValue(procedureFixture({ status: 'published' }));

    await expect(
      service.updateSection(
        tenantAdmin(),
        'process-a',
        'section-objet',
        { content: { text: 'Non' } },
        metadata,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces readonly, consultant publish, tenant isolation and super admin without grant', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(processFixture());
    await expect(service.generate(readonly(), 'process-a', metadata)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.publish(consultant(), 'process-a', {}, metadata)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.current(superAdminWithoutSupportGrant(), 'process-a', metadata),
    ).rejects.toBeInstanceOf(ForbiddenException);
    prisma.process.findFirst.mockResolvedValue(null);
    await expect(service.current(tenantAdmin(), 'process-b', metadata)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a separate AI draft suggestion and audit entries', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(processFixture());
    prisma.procedureDocument.findFirst.mockResolvedValue(procedureFixture());
    prisma.aiSuggestion.create.mockResolvedValue({
      id: 'suggestion-a',
      suggestionType: 'procedure_draft',
    });

    await expect(
      service.generateAiDraft(tenantAdmin(), 'process-a', metadata),
    ).resolves.toMatchObject({ suggestionType: 'procedure_draft' });
    expect(prisma.aiSuggestion.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'procedure_ai_draft_created' }),
      }),
    );
  });
});
