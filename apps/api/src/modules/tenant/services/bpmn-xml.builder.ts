import { Injectable } from '@nestjs/common';

import { BpmnJson, BpmnNode } from './bpmn.types';

@Injectable()
export class BpmnXmlBuilder {
  build(model: BpmnJson) {
    const processId = xmlId(`Process_${model.processId}`);
    const planeId = xmlId(`Plane_${model.processId}`);
    const lanes = model.lanes
      .map(
        (lane) =>
          `<bpmn:lane id="${xmlId(lane.id)}" name="${esc(lane.label)}">${lane.nodeIds
            .map((nodeId) => `<bpmn:flowNodeRef>${xmlId(nodeId)}</bpmn:flowNodeRef>`)
            .join('')}</bpmn:lane>`,
      )
      .join('');
    const nodes = model.nodes.map((node) => nodeXml(node)).join('');
    const flows = model.edges
      .map(
        (edge) =>
          `<bpmn:sequenceFlow id="${xmlId(edge.id)}" sourceRef="${xmlId(edge.sourceNodeId)}" targetRef="${xmlId(edge.targetNodeId)}"${
            edge.label ? ` name="${esc(edge.label)}"` : ''
          }>${edge.condition ? `<bpmn:conditionExpression>${esc(edge.condition)}</bpmn:conditionExpression>` : ''}</bpmn:sequenceFlow>`,
      )
      .join('');
    const shapes = model.nodes
      .map(
        (node) =>
          `<bpmndi:BPMNShape id="${xmlId(node.id)}_di" bpmnElement="${xmlId(node.id)}"><dc:Bounds x="${node.position.x}" y="${node.position.y}" width="${size(node).width}" height="${size(node).height}" /></bpmndi:BPMNShape>`,
      )
      .join('');
    const edges = model.edges
      .map((edge) => {
        const source = model.nodes.find((node) => node.id === edge.sourceNodeId);
        const target = model.nodes.find((node) => node.id === edge.targetNodeId);
        const sx = (source?.position.x ?? 0) + size(source).width;
        const sy = (source?.position.y ?? 0) + size(source).height / 2;
        const tx = target?.position.x ?? 0;
        const ty = (target?.position.y ?? 0) + size(target).height / 2;
        return `<bpmndi:BPMNEdge id="${xmlId(edge.id)}_di" bpmnElement="${xmlId(edge.id)}"><di:waypoint x="${sx}" y="${sy}" /><di:waypoint x="${tx}" y="${ty}" /></bpmndi:BPMNEdge>`;
      })
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_${esc(model.processId)}" targetNamespace="https://process-discovery.local/bpmn">
  <bpmn:collaboration id="Collaboration_${esc(model.processId)}">
    <bpmn:participant id="Participant_${esc(model.processId)}" name="${esc(model.participants[0]?.label ?? 'Processus')}" processRef="${processId}" />
  </bpmn:collaboration>
  <bpmn:process id="${processId}" isExecutable="false">
    <bpmn:laneSet id="LaneSet_${esc(model.processId)}">${lanes}</bpmn:laneSet>
    ${nodes}
    ${flows}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_${esc(model.processId)}">
    <bpmndi:BPMNPlane id="${planeId}" bpmnElement="${processId}">
      ${shapes}
      ${edges}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
  }
}

function nodeXml(node: BpmnNode) {
  const tag = node.type === 'userTask' ? 'userTask' : node.type;
  return `<bpmn:${tag} id="${xmlId(node.id)}" name="${esc(node.label)}" />`;
}

function size(node?: BpmnNode) {
  if (!node) return { width: 90, height: 60 };
  if (node.type === 'startEvent' || node.type === 'endEvent') return { width: 36, height: 36 };
  if (node.type === 'exclusiveGateway') return { width: 50, height: 50 };
  return { width: 120, height: 80 };
}

function xmlId(value: string) {
  return value.replace(/[^A-Za-z0-9_]/g, '_');
}

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
