import type { Edge, Node } from '@xyflow/react';

import type { BpmnResult } from '../api';

export type PremiumBpmnNodeData = Record<string, unknown> & {
  label: string;
  type: BpmnResult['bpmnJson']['nodes'][number]['type'];
  laneLabel: string;
  laneId: string;
  actorId?: string;
  sourceActivityId?: string;
  metadata: Record<string, unknown>;
};

export type PremiumBpmnReactNode = Node<PremiumBpmnNodeData, 'premiumBpmn'>;

export type PremiumBpmnLane = {
  id: string;
  label: string;
  actorId?: string;
  y: number;
  height: number;
};

export type PremiumBpmnFlow = {
  nodes: PremiumBpmnReactNode[];
  edges: Edge[];
  lanes: PremiumBpmnLane[];
  width: number;
  height: number;
};

const nodeSizeByType: Record<string, { width: number; height: number }> = {
  startEvent: { width: 118, height: 104 },
  endEvent: { width: 118, height: 104 },
  exclusiveGateway: { width: 82, height: 82 },
  task: { width: 190, height: 92 },
  userTask: { width: 210, height: 96 },
};

export function mapBpmnToPremiumFlow(bpmn: BpmnResult): PremiumBpmnFlow {
  const lanesById = new Map(bpmn.bpmnJson.lanes.map((lane) => [lane.id, lane]));
  const lanes = bpmn.bpmnJson.lanes.map((lane) => ({
    id: lane.id,
    label: lane.label,
    actorId: lane.actorId,
    y: lane.bounds.y,
    height: lane.bounds.height,
  }));

  const nodes: PremiumBpmnReactNode[] = bpmn.bpmnJson.nodes.map((node) => {
    const size = nodeSizeByType[node.type] ?? nodeSizeByType.task!;
    const lane = lanesById.get(node.laneId);
    return {
      id: node.id,
      type: 'premiumBpmn',
      position: node.position,
      data: {
        label: node.label,
        type: node.type,
        laneLabel: lane?.label ?? 'Processus',
        laneId: node.laneId,
        actorId: node.actorId,
        sourceActivityId: node.sourceActivityId,
        metadata: node.metadata,
      },
      width: size.width,
      height: size.height,
      draggable: false,
    };
  });

  const edges: Edge[] = bpmn.bpmnJson.edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    label: edge.label,
    type: 'smoothstep',
    animated: false,
    data: edge.metadata,
    markerEnd: {
      type: 'arrowclosed',
      width: 18,
      height: 18,
      color: 'rgba(58, 58, 60, 0.72)',
    },
    style: {
      stroke: 'rgba(58, 58, 60, 0.72)',
      strokeWidth: 1.5,
    },
    labelStyle: {
      fill: '#6E6E73',
      fontSize: 11,
      fontWeight: 650,
    },
    labelBgStyle: {
      fill: 'rgba(255, 255, 255, 0.86)',
    },
    labelBgPadding: [6, 4],
    labelBgBorderRadius: 8,
  }));

  const width =
    Math.max(
      ...bpmn.bpmnJson.lanes.map((lane) => lane.bounds.x + lane.bounds.width),
      ...nodes.map((node) => node.position.x + Number(node.width ?? 180)),
      900,
    ) + 80;
  const height =
    Math.max(
      ...bpmn.bpmnJson.lanes.map((lane) => lane.bounds.y + lane.bounds.height),
      ...nodes.map((node) => node.position.y + Number(node.height ?? 90)),
      360,
    ) + 80;

  return { nodes, edges, lanes, width, height };
}
