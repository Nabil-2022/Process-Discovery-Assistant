import type { PremiumBpmnLane as PremiumBpmnLaneType } from './bpmn-flow-mapper';

export function PremiumBpmnLane({ lane }: { lane: PremiumBpmnLaneType }) {
  return (
    <div
      className="premium-bpmn-lane"
      style={{
        transform: `translateY(${lane.y}px)`,
        height: lane.height,
      }}
    >
      <span>{lane.label}</span>
    </div>
  );
}
