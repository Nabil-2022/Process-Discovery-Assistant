import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import type { Edge, Node, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useNavigate } from 'react-router-dom';

import { hasTenantAccess, ProcessItem, tenantApi } from './api';
import { TenantHeader } from './TenantDashboard';

type MegaNodeData = Record<string, unknown> & {
  label: string;
  subtitle?: string;
  status?: string;
  completeness?: number;
  processId?: string;
  count?: number;
};

type MegaNode = Node<MegaNodeData, 'megaDirection' | 'megaProcess' | 'megaMilestone'>;

type DirectionGroup = {
  id: string;
  name: string;
  code: string | null;
  processes: ProcessItem[];
};

const nodeTypes = {
  megaDirection: MegaDirectionNode,
  megaProcess: MegaProcessNode,
  megaMilestone: MegaMilestoneNode,
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'Soumis',
  APPROVED: 'Valide',
  VALIDATED: 'Valide',
  REJECTED: 'Rejete',
  NEEDS_CORRECTION: 'A corriger',
};

const statusOptions = [
  { value: '', label: 'Tous statuts' },
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'SUBMITTED', label: 'Soumis' },
  { value: 'APPROVED', label: 'Valide' },
  { value: 'NEEDS_CORRECTION', label: 'A corriger' },
];

export function MegaBpmnPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ search: '', status: '', directionId: '' });
  const allowed = hasTenantAccess();
  const query = useQuery({
    queryKey: ['mega-bpmn-processes'],
    queryFn: () => tenantApi.processes({}),
    enabled: allowed,
  });

  const processes = query.data ?? [];
  const directions = useMemo(() => buildDirections(processes), [processes]);
  const visibleProcesses = useMemo(
    () =>
      processes.filter((process) => {
        const search = filters.search.trim().toLowerCase();
        const matchesSearch =
          !search ||
          process.name.toLowerCase().includes(search) ||
          (process.code ?? '').toLowerCase().includes(search) ||
          (process.direction?.name ?? '').toLowerCase().includes(search);
        const matchesStatus = !filters.status || process.status === filters.status;
        const matchesDirection =
          !filters.directionId || process.direction?.id === filters.directionId;
        return matchesSearch && matchesStatus && matchesDirection;
      }),
    [filters, processes],
  );
  const visibleDirections = useMemo(() => buildDirections(visibleProcesses), [visibleProcesses]);
  const graph = useMemo(() => buildMegaBpmnGraph(visibleDirections), [visibleDirections]);
  const stats = useMemo(() => buildStats(visibleProcesses), [visibleProcesses]);

  if (!allowed) return <AccessDenied />;

  return (
    <main className="tenant-shell">
      <TenantHeader />
      <section className="tenant-grid mega-bpmn-page">
        <article className="admin-panel wide mega-bpmn-intro">
          <div>
            <p className="eyebrow">Cartographie transverse</p>
            <h1>Mega BPMN global</h1>
            <p>
              Vue macro-processus / processus construite depuis le referentiel global. Chaque
              colonne represente une direction, chaque tache represente un processus.
            </p>
          </div>
          <div className="mega-bpmn-stats" aria-label="Indicateurs de cartographie">
            <Stat label="Directions" value={visibleDirections.length} />
            <Stat label="Processus" value={visibleProcesses.length} />
            <Stat label="Valides" value={stats.validated} />
            <Stat label="Completude" value={`${stats.averageCompleteness}%`} />
          </div>
        </article>

        <section className="admin-panel compact mega-bpmn-toolbar">
          <label>
            Recherche
            <input
              placeholder="Nom, code ou direction"
              value={filters.search}
              onChange={(event) =>
                setFilters((value) => ({ ...value, search: event.target.value }))
              }
            />
          </label>
          <label>
            Statut
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((value) => ({ ...value, status: event.target.value }))
              }
            >
              {statusOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Direction
            <select
              value={filters.directionId}
              onChange={(event) =>
                setFilters((value) => ({ ...value, directionId: event.target.value }))
              }
            >
              <option value="">Toutes directions</option>
              {directions.map((direction) => (
                <option value={direction.id} key={direction.id}>
                  {direction.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mega-bpmn-legend">
            <span>
              <i className="draft" /> Brouillon
            </span>
            <span>
              <i className="submitted" /> Soumis
            </span>
            <span>
              <i className="approved" /> Valide
            </span>
            <span>
              <i className="correction" /> A corriger
            </span>
          </div>
        </section>

        <article className="admin-panel mega-bpmn-canvas-panel">
          {query.isLoading ? <p className="empty-inline">Chargement de la cartographie...</p> : null}
          {query.error ? <p className="error-text">{query.error.message}</p> : null}
          {!query.isLoading && !visibleProcesses.length ? (
            <p className="empty-inline">Aucun processus pour ces filtres.</p>
          ) : null}
          {visibleProcesses.length ? (
            <MegaBpmnCanvas
              nodes={graph.nodes}
              edges={graph.edges}
              onOpenProcess={(processId) => navigate(`/tenant/processes/${processId}/workshop`)}
            />
          ) : null}
        </article>
      </section>
    </main>
  );
}

function MegaBpmnCanvas({
  nodes: initialNodes,
  edges: initialEdges,
  onOpenProcess,
}: {
  nodes: MegaNode[];
  edges: Edge[];
  onOpenProcess: (processId: string) => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialEdges, initialNodes, setEdges, setNodes]);

  return (
    <section className="mega-bpmn-viewer" aria-label="Mega diagramme BPMN global">
      <ReactFlowProvider>
        <ReactFlow
          key={initialNodes.map((node) => node.id).join('|')}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => {
            const processId = node.data.processId;
            if (typeof processId === 'string') onOpenProcess(processId);
          }}
          fitView
          fitViewOptions={{ padding: 0.18, maxZoom: 1.05 }}
          minZoom={0.22}
          maxZoom={1.4}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Lines}
            gap={32}
            size={1}
            color="rgba(0, 122, 255, 0.055)"
          />
          <Controls showInteractive={false} position="bottom-right" />
          <MiniMap
            nodeColor={(node) =>
              node.type === 'megaProcess' ? statusColor(node.data.status) : '#cfd8e3'
            }
            maskColor="rgba(245, 245, 247, 0.74)"
            pannable
            zoomable
          />
        </ReactFlow>
      </ReactFlowProvider>
    </section>
  );
}

function buildDirections(processes: ProcessItem[]): DirectionGroup[] {
  const groups = new Map<string, DirectionGroup>();
  for (const process of processes) {
    const id = process.direction?.id ?? 'without-direction';
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        name: process.direction?.name ?? 'Sans direction',
        code: process.direction?.code ?? null,
        processes: [],
      });
    }
    groups.get(id)?.processes.push(process);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      processes: group.processes.sort(
        (left, right) =>
          processOrder(left) - processOrder(right) ||
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() ||
          left.name.localeCompare(right.name),
      ),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function buildMegaBpmnGraph(directions: DirectionGroup[]): { nodes: MegaNode[]; edges: Edge[] } {
  const nodes: MegaNode[] = [];
  const edges: Edge[] = [];
  const laneWidth = 390;
  const laneGap = 72;
  const processHeight = 112;
  const processGap = 34;
  const startX = 80;
  const topY = 72;
  const processTopY = 168;
  const processNodes: { id: string; process: ProcessItem }[] = [];

  nodes.push({
    id: 'mega-start',
    type: 'megaMilestone',
    position: { x: -130, y: processTopY + 12 },
    data: { label: 'Debut', subtitle: 'Referentiel' },
    draggable: false,
  });

  directions.forEach((direction, directionIndex) => {
    const x = startX + directionIndex * (laneWidth + laneGap);
    const height = Math.max(380, processTopY + direction.processes.length * (processHeight + processGap));
    nodes.push({
      id: `direction-${direction.id}`,
      type: 'megaDirection',
      position: { x, y: topY },
      data: {
        label: direction.name,
        subtitle: direction.code ?? 'Macro-processus',
        count: direction.processes.length,
      },
      style: { width: laneWidth, height },
      draggable: false,
      zIndex: 0,
    });

    direction.processes.forEach((process, processIndex) => {
      const processNodeId = `process-${process.id}`;
      processNodes.push({ id: processNodeId, process });
      nodes.push({
        id: processNodeId,
        type: 'megaProcess',
        position: {
          x: x + 30,
          y: processTopY + processIndex * (processHeight + processGap),
        },
        data: {
          label: process.name,
          subtitle: process.code ?? process.category?.name ?? 'Processus',
          status: process.status,
          completeness: Number(process.completenessScore ?? 0),
          processId: process.id,
        },
        draggable: false,
        zIndex: 2,
      });

      if (processIndex > 0) {
        edges.push(
          edge(
            `edge-${direction.id}-${processIndex}`,
            `process-${direction.processes[processIndex - 1]?.id}`,
            processNodeId,
          ),
        );
      }
    });
  });

  const sequencedProjectNodes = processNodes
    .filter(({ process }) => processOrder(process) < Number.MAX_SAFE_INTEGER)
    .sort((left, right) => processOrder(left.process) - processOrder(right.process));
  const transverseNodes = sequencedProjectNodes.length > 1 ? sequencedProjectNodes : processNodes;

  for (let index = 0; index < transverseNodes.length - 1; index += 1) {
    const source = transverseNodes[index]?.id;
    const target = transverseNodes[index + 1]?.id;
    if (
      !source ||
      !target ||
      edges.some((item) => item.source === source && item.target === target)
    )
      continue;
    edges.push(edge(`transverse-${index}`, source, target, true));
  }

  const firstNode = transverseNodes[0]?.id;
  if (firstNode) edges.push(edge('start-to-first-process', 'mega-start', firstNode));

  const endX = startX + directions.length * (laneWidth + laneGap) - laneGap + 70;
  nodes.push({
    id: 'mega-end',
    type: 'megaMilestone',
    position: { x: Math.max(endX, 470), y: processTopY + 12 },
    data: { label: 'Fin', subtitle: 'Portefeuille' },
    draggable: false,
  });
  const lastNode = transverseNodes[transverseNodes.length - 1]?.id;
  if (lastNode) edges.push(edge('last-process-to-end', lastNode, 'mega-end'));

  return { nodes, edges };
}

function processOrder(process: ProcessItem) {
  const match = process.code?.match(/^MAP-WEB-(\d+)$/i);
  return match?.[1] ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function edge(id: string, source: string | undefined, target: string | undefined, transverse = false): Edge {
  return {
    id,
    source: source ?? '',
    target: target ?? '',
    type: 'smoothstep',
    animated: transverse,
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#64748b' },
    style: {
      stroke: transverse ? 'rgba(0, 122, 255, 0.48)' : 'rgba(100, 116, 139, 0.62)',
      strokeWidth: transverse ? 1.8 : 1.5,
      strokeDasharray: transverse ? '7 6' : undefined,
    },
  };
}

function buildStats(processes: ProcessItem[]) {
  const validated = processes.filter((process) =>
    ['APPROVED', 'VALIDATED'].includes(process.status),
  ).length;
  const averageCompleteness = processes.length
    ? Math.round(
        processes.reduce((sum, process) => sum + Number(process.completenessScore ?? 0), 0) /
          processes.length,
      )
    : 0;
  return { validated, averageCompleteness };
}

function MegaDirectionNode({ data }: NodeProps<MegaNode>) {
  return (
    <section className="mega-bpmn-direction-node">
      <strong>{data.label}</strong>
      <span>{data.subtitle}</span>
      <small>{data.count} processus</small>
    </section>
  );
}

function MegaProcessNode({ data }: NodeProps<MegaNode>) {
  const status = typeof data.status === 'string' ? data.status : 'DRAFT';
  const completeness = typeof data.completeness === 'number' ? data.completeness : 0;
  return (
    <article className={`mega-bpmn-process-node ${statusTone(status)}`}>
      <Handle type="target" position={Position.Left} />
      <div className="mega-bpmn-node-topline">
        <span>{statusLabels[status] ?? status}</span>
        <small>{Math.round(completeness)}%</small>
      </div>
      <strong>{data.label}</strong>
      <small>{data.subtitle}</small>
      <div className="mega-bpmn-progress" aria-hidden="true">
        <i style={{ width: `${Math.max(0, Math.min(100, completeness))}%` }} />
      </div>
      <Handle type="source" position={Position.Right} />
    </article>
  );
}

function MegaMilestoneNode({ data }: NodeProps<MegaNode>) {
  return (
    <div className="mega-bpmn-milestone">
      <Handle type="target" position={Position.Left} />
      <strong>{data.label}</strong>
      <small>{data.subtitle}</small>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function statusTone(status: string) {
  if (['APPROVED', 'VALIDATED'].includes(status)) return 'approved';
  if (status === 'SUBMITTED') return 'submitted';
  if (status === 'NEEDS_CORRECTION' || status === 'REJECTED') return 'correction';
  return 'draft';
}

function statusColor(status: unknown) {
  const tone = statusTone(typeof status === 'string' ? status : 'DRAFT');
  if (tone === 'approved') return '#2f9e62';
  if (tone === 'submitted') return '#007aff';
  if (tone === 'correction') return '#d92d20';
  return '#b7791f';
}

function AccessDenied() {
  return (
    <main className="tenant-shell">
      <TenantHeader />
      <section className="admin-empty">
        <p className="eyebrow">Acces requis</p>
        <h1>Connectez-vous au tenant pour consulter cette cartographie.</h1>
      </section>
    </main>
  );
}
