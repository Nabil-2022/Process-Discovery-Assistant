import { useEffect, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { BpmnResult } from '../api';
import { layoutPremiumBpmnFlow } from './bpmn-flow-layout';
import { mapBpmnToPremiumFlow, PremiumBpmnFlow } from './bpmn-flow-mapper';
import { PremiumBpmnLane } from './PremiumBpmnLane';
import { PremiumBpmnNode } from './PremiumBpmnNode';

const nodeTypes = { premiumBpmn: PremiumBpmnNode };

export function PremiumBpmnViewer({ bpmn }: { bpmn: BpmnResult }) {
  const initialFlow = useMemo(() => mapBpmnToPremiumFlow(bpmn), [bpmn]);
  const [flow, setFlow] = useState<PremiumBpmnFlow>(initialFlow);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow.edges);
  const flowKey = nodes.map((node) => `${node.id}:${node.position.x}:${node.position.y}`).join('|');

  useEffect(() => {
    let active = true;
    setFlow(initialFlow);
    setNodes(initialFlow.nodes);
    setEdges(initialFlow.edges);
    layoutPremiumBpmnFlow(initialFlow)
      .then((layouted) => {
        if (!active) return;
        setFlow(layouted);
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
      })
      .catch(() => {
        if (!active) return;
        setFlow(initialFlow);
      });
    return () => {
      active = false;
    };
  }, [initialFlow, setEdges, setNodes]);

  return (
    <section className="premium-bpmn-viewer" aria-label="Vue BPMN premium">
      <div className="premium-bpmn-canvas" style={{ minHeight: Math.min(flow.height, 680) }}>
        <ReactFlowProvider>
          <div className="premium-bpmn-lanes" aria-hidden="true">
            {flow.lanes.map((lane) => (
              <PremiumBpmnLane lane={lane} key={lane.id} />
            ))}
          </div>
          <ReactFlow
            key={flowKey}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            fitViewOptions={{ padding: 0.28, maxZoom: 1.02 }}
            minZoom={0.35}
            maxZoom={1.45}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Lines}
              gap={32}
              size={1}
              color="rgba(0, 122, 255, 0.055)"
            />
            <Controls showInteractive={false} position="bottom-right" />
            <MiniMap nodeColor="#007AFF" maskColor="rgba(245, 245, 247, 0.72)" pannable zoomable />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </section>
  );
}
