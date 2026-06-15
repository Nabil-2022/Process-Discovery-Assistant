import { createHash } from 'crypto';

import { RaciRole } from '../../../generated/prisma';
import { BpmnIssue, BpmnJson, BpmnLane, BpmnNode } from './bpmn.types';

export const BPMN_RULE_VERSION = 'process-discovery-bpmn-v1';

export type BpmnRuleInput = {
  tenantId: string;
  processId: string;
  processName: string;
  triggerEvent?: string | null;
  finalOutput?: string | null;
  generatedAt: string;
  generatedBy?: string;
  activities: {
    id: string;
    name: string;
    description?: string | null;
    sortOrder: number;
    condition?: string | null;
    duration?: string | null;
    inputText?: string | null;
    outputText?: string | null;
    isAutomated?: boolean;
  }[];
  transitions: {
    id: string;
    fromActivityId?: string | null;
    toActivityId?: string | null;
    label?: string | null;
    condition?: string | null;
    sortOrder: number;
  }[];
  actorRoles: {
    activityId?: string | null;
    actorId: string;
    raciRole: RaciRole;
    actorName: string;
  }[];
  isUserFacingProcess?: boolean;
  law5519Applicable?: boolean;
  targetChannel?: string | null;
  targetProcessingTimeDays?: number | null;
  requiredDocumentsCount?: number | null;
  physicalVisitsRequired?: number | null;
  hasDelayKpi?: boolean;
  hasPublicAuditRisk?: boolean;
  hasEventLogs?: boolean;
  hasSimplificationOwner?: boolean;
  documentCount?: number;
};

export function buildBpmnJson(input: BpmnRuleInput): Omit<BpmnJson, 'sourceHash'> {
  const blockingIssues: BpmnIssue[] = [];
  const warnings: BpmnIssue[] = [];
  const recommendations = new Set<string>();
  const activities = [...input.activities].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
  const activityIds = new Set(activities.map((activity) => activity.id));

  if (!activities.length)
    block(blockingIssues, 'missing_activities', 'Aucune activite pour generer le BPMN.');
  for (const activity of activities) {
    if (!activity.name.trim())
      block(blockingIssues, 'activity_without_name', 'Activite sans nom.', activity.id);
    if (!activity.inputText)
      warn(
        warnings,
        'activity_without_input',
        `Activite sans entree: ${activity.name}.`,
        activity.id,
      );
    if (!activity.outputText)
      warn(
        warnings,
        'activity_without_output',
        `Activite sans sortie: ${activity.name}.`,
        activity.id,
      );
    if (!activity.duration)
      warn(
        warnings,
        'activity_without_duration',
        `Activite sans delai: ${activity.name}.`,
        activity.id,
      );
    if (!activity.isAutomated && /saisie|copie|relance|manuel/i.test(activity.name))
      warn(
        warnings,
        'manual_repetitive_activity',
        `Activite manuelle repetitive possible: ${activity.name}.`,
        activity.id,
      );
  }
  const manualActivities = activities.filter((activity) => !activity.isAutomated);
  if (manualActivities.length >= 4) {
    warn(
      warnings,
      'too_many_manual_activities',
      'Nombre eleve d activites manuelles: verifier les pistes de simplification.',
    );
  }

  const transitions = [...input.transitions].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );
  for (const transition of transitions) {
    if (transition.fromActivityId && !activityIds.has(transition.fromActivityId))
      block(
        blockingIssues,
        'transition_from_missing',
        'Transition depuis activite inexistante.',
        undefined,
        transition.id,
      );
    if (transition.toActivityId && !activityIds.has(transition.toActivityId))
      block(
        blockingIssues,
        'transition_to_missing',
        'Transition vers activite inexistante.',
        undefined,
        transition.id,
      );
    if (transition.condition && !transition.label)
      block(
        blockingIssues,
        'condition_without_label',
        'Condition sans libelle de branche.',
        undefined,
        transition.id,
      );
    if (transition.condition && !transition.toActivityId)
      block(
        blockingIssues,
        'conditional_branch_without_target',
        'Branche conditionnelle sans cible.',
        undefined,
        transition.id,
      );
  }
  if (hasLoop(transitions)) {
    warn(warnings, 'loop_detected', 'Boucle detectee dans la sequence BPMN.');
  }

  const responsibleByActivity = new Map<string, { id: string; name: string }>();
  for (const role of input.actorRoles) {
    if (role.activityId && role.raciRole === RaciRole.RESPONSIBLE) {
      responsibleByActivity.set(role.activityId, { id: role.actorId, name: role.actorName });
    }
  }

  const laneMap = new Map<string, BpmnLane>();
  const nodeIdsByLane = new Map<string, string[]>();
  const nodes: BpmnNode[] = [];
  const gateways: BpmnNode[] = [];
  const events: BpmnNode[] = [];

  const startLane = 'lane_start';
  const startNode: BpmnNode = {
    id: 'event_start',
    type: 'startEvent',
    label: input.triggerEvent || 'Debut du processus',
    laneId: startLane,
    position: { x: 90, y: 90 },
    metadata: {},
  };
  const endNode: BpmnNode = {
    id: 'event_end',
    type: 'endEvent',
    label: input.finalOutput || 'Fin du processus',
    laneId: startLane,
    position: { x: 220 + activities.length * 180, y: 90 },
    metadata: {},
  };
  nodes.push(startNode);
  events.push(startNode, endNode);
  nodeIdsByLane.set(startLane, [startNode.id, endNode.id]);
  laneMap.set(startLane, {
    id: startLane,
    label: 'Processus',
    nodeIds: [startNode.id, endNode.id],
    bounds: { x: 60, y: 40, width: Math.max(560, 340 + activities.length * 180), height: 120 },
  });

  activities.forEach((activity, index) => {
    const actor = responsibleByActivity.get(activity.id);
    const laneId = actor ? `lane_${actor.id}` : 'lane_unassigned';
    if (!actor) {
      warn(
        warnings,
        'activity_without_responsible',
        `Activite sans Responsible: ${activity.name}.`,
        activity.id,
      );
      warn(warnings, 'unassigned_lane_used', 'Lane Non assigne utilisee.', activity.id);
    }
    const existingIds = nodeIdsByLane.get(laneId) ?? [];
    const laneIndex = [...laneMap.keys()].includes(laneId)
      ? [...laneMap.keys()].indexOf(laneId)
      : laneMap.size;
    if (!laneMap.has(laneId)) {
      laneMap.set(laneId, {
        id: laneId,
        label: actor?.name ?? 'Non assigne',
        actorId: actor?.id,
        nodeIds: [],
        bounds: {
          x: 60,
          y: 40 + laneIndex * 150,
          width: Math.max(560, 340 + activities.length * 180),
          height: 120,
        },
      });
    }
    const node: BpmnNode = {
      id: `task_${activity.id}`,
      type: actor ? 'userTask' : 'task',
      label: activity.name,
      sourceActivityId: activity.id,
      actorId: actor?.id,
      laneId,
      position: { x: 220 + index * 180, y: 80 + laneIndex * 150 },
      metadata: {
        description: activity.description,
        duration: activity.duration,
        inputText: activity.inputText,
        outputText: activity.outputText,
      },
    };
    nodes.push(node);
    existingIds.push(node.id);
    nodeIdsByLane.set(laneId, existingIds);
    laneMap.set(laneId, { ...laneMap.get(laneId)!, nodeIds: existingIds });
    if (activity.condition) {
      const gateway: BpmnNode = {
        id: `gateway_${activity.id}`,
        type: 'exclusiveGateway',
        label: activity.condition,
        sourceActivityId: activity.id,
        laneId,
        position: { x: node.position.x + 140, y: node.position.y + 15 },
        metadata: { condition: activity.condition },
      };
      nodes.push(gateway);
      gateways.push(gateway);
      nodeIdsByLane.set(laneId, [...existingIds, gateway.id]);
    }
  });
  nodes.push(endNode);

  const edges = createEdges(activities, transitions);
  const connected = new Set<string>();
  for (const edge of edges) {
    if (edge.sourceNodeId.startsWith('task_'))
      connected.add(edge.sourceNodeId.replace('task_', ''));
    if (edge.targetNodeId.startsWith('task_'))
      connected.add(edge.targetNodeId.replace('task_', ''));
  }
  if (activities.length > 1) {
    for (const activity of activities) {
      if (!connected.has(activity.id))
        block(
          blockingIssues,
          'orphan_activity',
          `Activite orpheline: ${activity.name}.`,
          activity.id,
        );
    }
  }

  if (input.isUserFacingProcess) {
    if (!input.targetChannel)
      warn(warnings, 'user_facing_without_target_channel', 'Processus usager sans canal cible.');
    if (!input.targetProcessingTimeDays)
      warn(warnings, 'user_facing_without_target_delay', 'Processus usager sans delai cible.');
    if ((input.requiredDocumentsCount ?? input.documentCount ?? 0) > 5)
      warn(warnings, 'too_many_required_documents', 'Nombre eleve de documents demandes.');
  }
  if (input.law5519Applicable) {
    if ((input.targetChannel ?? '').toLowerCase() !== 'digital')
      warn(
        warnings,
        'law_55_19_without_digital_target',
        'Loi 55-19 applicable sans cible digitale.',
      );
    if ((input.physicalVisitsRequired ?? 0) > 0)
      warn(warnings, 'law_55_19_physical_visits_required', 'Deplacements physiques encore requis.');
    if (!input.hasDelayKpi) warn(warnings, 'law_55_19_without_delay_kpi', 'Absence de KPI delai.');
    if (!input.hasSimplificationOwner)
      warn(
        warnings,
        'law_55_19_without_simplification_owner',
        'Absence de responsable de simplification.',
      );
  }
  if (input.hasPublicAuditRisk)
    warn(
      warnings,
      'public_audit_without_control_check',
      'Processus a risque public: verifier les controles lies.',
    );
  if (input.hasEventLogs)
    recommendations.add(
      'Des event logs existent: comparer plus tard le modele theorique au modele decouvert.',
    );

  recommendations.add(
    'Verifier que le BPMN correspond au modele structure valide par les utilisateurs.',
  );
  return {
    processId: input.processId,
    tenantId: input.tenantId,
    ruleVersion: BPMN_RULE_VERSION,
    generatedAt: input.generatedAt,
    generatedBy: input.generatedBy,
    participants: [{ id: `participant_${input.processId}`, label: input.processName }],
    lanes: [...laneMap.values()],
    nodes,
    edges,
    gateways,
    events,
    layout: { direction: 'horizontal' as const, spacingX: 180, spacingY: 150 },
    issues: blockingIssues,
    warnings,
    recommendations: [...recommendations],
  };
}

function createEdges(
  activities: BpmnRuleInput['activities'],
  transitions: BpmnRuleInput['transitions'],
) {
  if (transitions.length) {
    const sorted = [...activities].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
    const transitionEdges = transitions
      .filter((transition) => transition.fromActivityId && transition.toActivityId)
      .map((transition) => ({
        id: `flow_${transition.id}`,
        sourceNodeId: `task_${transition.fromActivityId}`,
        targetNodeId: `task_${transition.toActivityId}`,
        label: transition.label ?? undefined,
        condition: transition.condition ?? undefined,
        sourceTransitionId: transition.id,
        metadata: {},
      }));
    const edges = [];
    if (sorted[0])
      edges.push({
        id: 'flow_start',
        sourceNodeId: 'event_start',
        targetNodeId: `task_${sorted[0].id}`,
        metadata: {},
      });
    edges.push(...transitionEdges);
    const last = sorted.at(-1);
    if (last)
      edges.push({
        id: 'flow_end',
        sourceNodeId: `task_${last.id}`,
        targetNodeId: 'event_end',
        metadata: {},
      });
    return edges;
  }
  const edges = [];
  const sorted = [...activities].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
  if (sorted[0])
    edges.push({
      id: 'flow_start',
      sourceNodeId: 'event_start',
      targetNodeId: `task_${sorted[0].id}`,
      metadata: {},
    });
  for (let index = 0; index < sorted.length - 1; index += 1) {
    edges.push({
      id: `flow_${sorted[index]!.id}_${sorted[index + 1]!.id}`,
      sourceNodeId: `task_${sorted[index]!.id}`,
      targetNodeId: `task_${sorted[index + 1]!.id}`,
      metadata: {},
    });
  }
  const last = sorted.at(-1);
  if (last)
    edges.push({
      id: 'flow_end',
      sourceNodeId: `task_${last.id}`,
      targetNodeId: 'event_end',
      metadata: {},
    });
  return edges;
}

function hasLoop(transitions: BpmnRuleInput['transitions']) {
  const graph = new Map<string, string[]>();
  for (const transition of transitions) {
    if (!transition.fromActivityId || !transition.toActivityId) continue;
    graph.set(transition.fromActivityId, [
      ...(graph.get(transition.fromActivityId) ?? []),
      transition.toActivityId,
    ]);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of graph.get(node) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  return [...graph.keys()].some((node) => visit(node));
}

export function bpmnSourceHash(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
}

function block(
  items: BpmnIssue[],
  code: string,
  message: string,
  activityId?: string,
  transitionId?: string,
) {
  items.push({ code, message, severity: 'blocking', activityId, transitionId });
}

function warn(
  items: BpmnIssue[],
  code: string,
  message: string,
  activityId?: string,
  transitionId?: string,
) {
  items.push({ code, message, severity: 'warning', activityId, transitionId });
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = stable((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
}
