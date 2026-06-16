import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';

import type { PremiumBpmnReactNode } from './bpmn-flow-mapper';

export function PremiumBpmnNode({ data }: NodeProps<PremiumBpmnReactNode>) {
  if (data.type === 'startEvent' || data.type === 'endEvent') {
    return (
      <div className="premium-bpmn-event-shell">
        <div className={`premium-bpmn-event ${data.type === 'endEvent' ? 'end' : 'start'}`}>
          <Handle type="target" position={Position.Left} />
          <span>{data.type === 'endEvent' ? 'Fin' : 'Debut'}</span>
          <Handle type="source" position={Position.Right} />
        </div>
        <small>{data.label}</small>
      </div>
    );
  }

  if (data.type === 'exclusiveGateway') {
    return (
      <div className="premium-bpmn-gateway">
        <Handle type="target" position={Position.Left} />
        <span>Decision</span>
        <small>{data.label}</small>
        <Handle type="source" position={Position.Right} />
      </div>
    );
  }

  return (
    <article className={`premium-bpmn-task ${data.type === 'userTask' ? 'user' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <span>{data.type === 'userTask' ? 'Tache utilisateur' : 'Tache'}</span>
      <strong>{data.label}</strong>
      <small>{data.laneLabel}</small>
      <Handle type="source" position={Position.Right} />
    </article>
  );
}
