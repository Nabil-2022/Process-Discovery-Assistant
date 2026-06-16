import type { ElkNode } from 'elkjs/lib/elk.bundled.js';

import type { PremiumBpmnFlow } from './bpmn-flow-mapper';

export async function layoutPremiumBpmnFlow(flow: PremiumBpmnFlow): Promise<PremiumBpmnFlow> {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  const elk = new ELK();
  const laneIds = new Set(flow.lanes.map((lane) => lane.id));
  const children: ElkNode[] = flow.nodes.map((node) => ({
    id: node.id,
    width: Number(node.width ?? 180),
    height: Number(node.height ?? 90),
  }));

  const graph: ElkNode = {
    id: 'bpmn-flow',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '58',
      'elk.layered.spacing.nodeNodeBetweenLayers': '96',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    },
    children,
    edges: flow.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const result = await elk.layout(graph);
  const layoutById = new Map(result.children?.map((child) => [child.id, child]) ?? []);
  const nodes = flow.nodes.map((node) => {
    const layout = layoutById.get(node.id);
    const lane = flow.lanes.find((item) => item.id === node.data.laneId);
    return {
      ...node,
      position: {
        x: Math.round((layout?.x ?? node.position.x) + 90),
        y: Math.round((layout?.y ?? node.position.y) + (laneIds.size > 1 && lane ? lane.y : 70)),
      },
    };
  });

  const maxY = Math.max(...nodes.map((node) => node.position.y + Number(node.height ?? 90)), 260);
  const laneHeight = Math.max(150, Math.ceil((maxY + 80) / Math.max(flow.lanes.length, 1)));
  const lanes = flow.lanes.length
    ? flow.lanes.map((lane, index) => ({
        ...lane,
        y: index * laneHeight + 36,
        height: laneHeight,
      }))
    : [{ id: 'default', label: 'Processus', y: 36, height: Math.max(220, maxY + 80) }];

  return {
    ...flow,
    nodes,
    lanes,
    width: Math.max(Number(result.width ?? flow.width) + 180, 960),
    height: Math.max(lanes.at(-1)!.y + lanes.at(-1)!.height + 36, 420),
  };
}
