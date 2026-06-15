export type BpmnValidationStatus = 'DRAFT' | 'VALIDATED' | 'INVALIDATED';

export type BpmnIssue = {
  code: string;
  message: string;
  severity: 'blocking' | 'warning';
  activityId?: string;
  transitionId?: string;
};

export type BpmnNode = {
  id: string;
  type: 'startEvent' | 'endEvent' | 'task' | 'userTask' | 'exclusiveGateway';
  label: string;
  sourceActivityId?: string;
  actorId?: string;
  laneId: string;
  position: { x: number; y: number };
  metadata: Record<string, unknown>;
};

export type BpmnEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  condition?: string;
  sourceTransitionId?: string;
  metadata: Record<string, unknown>;
};

export type BpmnLane = {
  id: string;
  label: string;
  actorId?: string;
  nodeIds: string[];
  bounds: { x: number; y: number; width: number; height: number };
};

export type BpmnJson = {
  processId: string;
  tenantId: string;
  sourceHash: string;
  ruleVersion: string;
  generatedAt: string;
  generatedBy?: string;
  participants: { id: string; label: string }[];
  lanes: BpmnLane[];
  nodes: BpmnNode[];
  edges: BpmnEdge[];
  gateways: BpmnNode[];
  events: BpmnNode[];
  layout: { direction: 'horizontal'; spacingX: number; spacingY: number };
  issues: BpmnIssue[];
  warnings: BpmnIssue[];
  recommendations: string[];
};

export type BpmnResult = {
  ruleVersion: string;
  sourceHash: string;
  bpmnJson: BpmnJson;
  bpmnXml: string;
  blockingIssues: BpmnIssue[];
  warnings: BpmnIssue[];
  recommendations: string[];
  validationStatus: BpmnValidationStatus;
  versionNumber: number;
  generatedAt: string;
  canValidate: boolean;
};
