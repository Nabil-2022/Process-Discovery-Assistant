import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { RaciRole } from '../../../generated/prisma';
import { TenantAccessContext } from '../guards/tenant-access.guard';
import { buildBpmnJson, BPMN_RULE_VERSION, bpmnSourceHash } from './bpmn-rules';
import { BpmnService } from './bpmn.service';
import { BpmnXmlBuilder } from './bpmn-xml.builder';

const metadata = { ip: '127.0.0.1', userAgent: 'vitest' };

function createPrismaMock() {
  return {
    process: { findFirst: vi.fn() },
    bpmnModel: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    bpmnVersion: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn() },
  };
}

function createService() {
  const prisma = createPrismaMock();
  return { service: new BpmnService(prisma as never, new BpmnXmlBuilder()), prisma };
}

function tenantAdmin(overrides: Partial<TenantAccessContext> = {}): TenantAccessContext {
  return {
    tenantId: 'tenant-a',
    actorUserId: 'admin-a',
    membershipId: 'membership-admin',
    tenantRoles: ['tenant_admin'],
    permissions: [
      'manage_directions',
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
  return tenantAdmin({ tenantRoles: ['readonly'], permissions: ['export_process'] });
}

function consultant() {
  return tenantAdmin({
    tenantRoles: ['consultant'],
    permissions: ['create_process', 'update_process_working_copy'],
  });
}

function referent(directionIds = ['direction-a']) {
  return tenantAdmin({
    tenantRoles: ['direction_referent'],
    permissions: ['create_process', 'update_process_working_copy'],
    directionIds,
  });
}

function support() {
  return tenantAdmin({
    tenantRoles: [],
    permissions: ['support_read'],
    directionIds: [],
    supportGrantId: 'grant-a',
    isSupportAccess: true,
  });
}

function process(overrides = {}) {
  return {
    id: 'process-a',
    tenantId: 'tenant-a',
    directionId: 'direction-a',
    processOwnerActorId: 'actor-owner',
    name: 'Octroi autorisation',
    triggerEvent: 'Demande recue',
    deletedAt: null,
    inputs: [{ id: 'input-a', name: 'Demande', sortOrder: 1 }],
    outputs: [{ id: 'output-a', name: 'Autorisation', sortOrder: 1 }],
    activities: [
      {
        id: 'activity-a',
        name: 'Recevoir demande',
        description: 'Reception',
        sortOrder: 1,
        condition: null,
        duration: '1j',
        inputText: 'Demande',
        outputText: 'Dossier',
        isAutomated: false,
      },
      {
        id: 'activity-b',
        name: 'Controler dossier',
        description: 'Controle',
        sortOrder: 2,
        condition: null,
        duration: '2j',
        inputText: 'Dossier',
        outputText: 'Avis',
        isAutomated: true,
      },
    ],
    transitions: [
      {
        id: 'transition-a',
        fromActivityId: 'activity-a',
        toActivityId: 'activity-b',
        label: 'Suite',
        condition: null,
        sortOrder: 1,
      },
    ],
    actorRoles: [
      {
        activityId: 'activity-a',
        actorId: 'actor-a',
        raciRole: RaciRole.RESPONSIBLE,
        actor: { id: 'actor-a', name: 'Agent guichet' },
      },
      {
        activityId: 'activity-b',
        actorId: 'actor-b',
        raciRole: RaciRole.RESPONSIBLE,
        actor: { id: 'actor-b', name: 'Controleur' },
      },
    ],
    applications: [{ id: 'app-link', application: { id: 'app-a', name: 'SI metier' } }],
    documents: [{ id: 'doc-link', document: { id: 'doc-a', title: 'Procedure' } }],
    moroccoCompliance: {
      isUserFacingProcess: true,
      law5519Applicable: true,
      targetChannel: 'digital',
      targetProcessingTimeDays: 3,
      requiredDocumentsCount: 2,
      physicalVisitsRequired: 0,
    },
    kpis: [{ id: 'kpi-a', name: 'Delai moyen', definition: 'delai de traitement' }],
    risks: [{ id: 'risk-a', courtOfAccountsRelevance: false, controls: [] }],
    eventLogImports: [],
    ...overrides,
  };
}

function model(overrides = {}) {
  const bpmnJson = buildBpmnJson({
    tenantId: 'tenant-a',
    processId: 'process-a',
    processName: 'Octroi autorisation',
    triggerEvent: 'Demande recue',
    finalOutput: 'Autorisation',
    generatedAt: '2026-06-15T10:00:00.000Z',
    generatedBy: 'admin-a',
    activities: process().activities,
    transitions: process().transitions,
    actorRoles: process().actorRoles.map((role) => ({
      activityId: role.activityId,
      actorId: role.actorId,
      raciRole: role.raciRole,
      actorName: role.actor.name,
    })),
    hasDelayKpi: true,
    hasSimplificationOwner: true,
  });
  const xml = new BpmnXmlBuilder().build({ ...bpmnJson, sourceHash: 'hash-a' });
  return {
    id: 'bpmn-a',
    processId: 'process-a',
    ruleVersion: BPMN_RULE_VERSION,
    sourceHash: 'hash-a',
    bpmnJson: { ...bpmnJson, sourceHash: 'hash-a' },
    bpmnXml: xml,
    blockingIssues: [],
    warnings: [],
    recommendations: [],
    validationStatus: 'DRAFT',
    versionNumber: 1,
    generatedAt: new Date('2026-06-15T10:00:00Z'),
    ...overrides,
  };
}

describe('BPMN deterministic rules', () => {
  it('generates lanes, events, tasks, sequence flows and XML-compatible ids', () => {
    const result = buildBpmnJson({
      tenantId: 'tenant-a',
      processId: 'process-a',
      processName: 'Processus',
      generatedAt: '2026-06-15T10:00:00.000Z',
      activities: process().activities,
      transitions: process().transitions,
      actorRoles: process().actorRoles.map((role) => ({
        activityId: role.activityId,
        actorId: role.actorId,
        raciRole: role.raciRole,
        actorName: role.actor.name,
      })),
    });

    expect(result.nodes.map((node) => node.type)).toEqual(
      expect.arrayContaining(['startEvent', 'userTask', 'endEvent']),
    );
    expect(result.edges.map((edge) => edge.id)).toEqual(
      expect.arrayContaining(['flow_start', 'flow_transition-a', 'flow_end']),
    );
    expect(result.lanes.map((lane) => lane.label)).toEqual(
      expect.arrayContaining(['Agent guichet', 'Controleur']),
    );
  });

  it('blocks invalid transitions, orphan activities and gateway branches without target', () => {
    const result = buildBpmnJson({
      tenantId: 'tenant-a',
      processId: 'process-a',
      processName: 'Processus',
      generatedAt: '2026-06-15T10:00:00.000Z',
      activities: [
        ...process().activities,
        { ...process().activities[1], id: 'activity-c', name: 'Archiver', sortOrder: 3 },
      ],
      transitions: [
        {
          id: 'transition-bad',
          fromActivityId: 'activity-a',
          toActivityId: 'missing',
          condition: 'si incomplet',
          sortOrder: 1,
        },
      ],
      actorRoles: [],
    });

    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'transition_to_missing',
        'condition_without_label',
        'orphan_activity',
      ]),
    );
  });

  it('warns for RACI gaps, Morocco compliance, loops and process-mining readiness', () => {
    const result = buildBpmnJson({
      tenantId: 'tenant-a',
      processId: 'process-a',
      processName: 'Processus',
      generatedAt: '2026-06-15T10:00:00.000Z',
      activities: [
        ...process().activities,
        ...[3, 4, 5].map((sortOrder) => ({
          ...process().activities[0],
          id: `manual-${sortOrder}`,
          name: `Saisie manuelle ${sortOrder}`,
          sortOrder,
          isAutomated: false,
        })),
      ],
      transitions: [
        { id: 't1', fromActivityId: 'activity-a', toActivityId: 'activity-b', sortOrder: 1 },
        { id: 't2', fromActivityId: 'activity-b', toActivityId: 'activity-a', sortOrder: 2 },
      ],
      actorRoles: [],
      isUserFacingProcess: true,
      law5519Applicable: true,
      requiredDocumentsCount: 7,
      physicalVisitsRequired: 1,
      hasEventLogs: true,
    });

    expect(result.warnings.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'activity_without_responsible',
        'too_many_manual_activities',
        'loop_detected',
        'user_facing_without_target_channel',
        'too_many_required_documents',
        'law_55_19_without_digital_target',
        'law_55_19_without_delay_kpi',
        'law_55_19_without_simplification_owner',
      ]),
    );
    expect(result.recommendations.join(' ')).toContain('event logs');
  });

  it('keeps source hashes deterministic and changes when the sequence changes', () => {
    const source = { ruleVersion: BPMN_RULE_VERSION, activities: ['a', 'b'] };
    const changed = { ruleVersion: BPMN_RULE_VERSION, activities: ['b', 'a'] };

    expect(bpmnSourceHash(source)).toBe(bpmnSourceHash(source));
    expect(bpmnSourceHash(source)).not.toBe(bpmnSourceHash(changed));
  });
});

describe('BpmnService', () => {
  it('persists generated BPMN and creates a version plus audit entry', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process());
    prisma.bpmnModel.findFirst.mockResolvedValue(null);
    prisma.bpmnVersion.findFirst.mockResolvedValue(null);
    prisma.bpmnModel.create.mockResolvedValue(model());
    prisma.bpmnVersion.create.mockResolvedValue({});

    const result = await service.generate(tenantAdmin(), 'process-a', metadata);

    expect(result.bpmnXml).toContain('<bpmn:definitions');
    expect(prisma.bpmnModel.create).toHaveBeenCalled();
    expect(prisma.bpmnVersion.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'bpmn_generated' }) }),
    );
  });

  it('validates only when no blocking issue exists', async () => {
    const { service, prisma } = createService();
    prisma.bpmnModel.findFirst.mockResolvedValue(model());
    prisma.bpmnVersion.findFirst.mockResolvedValue({ versionNumber: 1 });
    prisma.bpmnModel.update.mockResolvedValue(
      model({ validationStatus: 'VALIDATED', versionNumber: 2 }),
    );
    prisma.bpmnVersion.create.mockResolvedValue({});

    const result = await service.validate(tenantAdmin(), 'process-a', { comment: 'OK' }, metadata);

    expect(result.validationStatus).toBe('VALIDATED');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'bpmn_validated' }) }),
    );
  });

  it('refuses validation when blocking issues exist', async () => {
    const { service, prisma } = createService();
    prisma.bpmnModel.findFirst.mockResolvedValue(
      model({
        blockingIssues: [{ code: 'orphan_activity', message: 'x', severity: 'blocking' }],
      }),
    );

    await expect(service.validate(tenantAdmin(), 'process-a', {}, metadata)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses readonly writes, consultant validation and support writes', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process());
    prisma.bpmnModel.findFirst.mockResolvedValue(model());

    await expect(service.generate(readonly(), 'process-a', metadata)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.validate(consultant(), 'process-a', {}, metadata)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.getBpmn(support(), 'process-a')).resolves.toBeDefined();
    await expect(service.generate(support(), 'process-a', metadata)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('scopes direction referents to their directions', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(null);

    await expect(service.getBpmn(referent(['direction-b']), 'process-a')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.process.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-a',
          directionId: { in: ['direction-b'] },
        }),
      }),
    );
  });

  it('exports JSON/XML and lists versions/history/issues', async () => {
    const { service, prisma } = createService();
    prisma.process.findFirst.mockResolvedValue(process());
    prisma.bpmnModel.findFirst.mockResolvedValue(model());
    prisma.bpmnVersion.findMany.mockResolvedValue([{ id: 'version-a' }]);
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'audit-a' }]);

    await expect(service.exportXml(tenantAdmin(), 'process-a', metadata)).resolves.toContain(
      '<bpmn:definitions',
    );
    await expect(service.exportJson(tenantAdmin(), 'process-a', metadata)).resolves.toMatchObject({
      processId: 'process-a',
    });
    await expect(service.versions(tenantAdmin(), 'process-a')).resolves.toEqual([
      { id: 'version-a' },
    ]);
    await expect(service.history(tenantAdmin(), 'process-a')).resolves.toEqual([{ id: 'audit-a' }]);
    await expect(service.issues(tenantAdmin(), 'process-a')).resolves.toEqual({
      blocking_issues: [],
      warnings: [],
    });
  });
});
