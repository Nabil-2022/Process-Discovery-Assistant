import { Injectable } from '@nestjs/common';

@Injectable()
export class BpmnLayoutService {
  position(index: number, laneIndex: number) {
    return { x: 160 + index * 180, y: 90 + laneIndex * 150 };
  }

  laneBounds(laneIndex: number, nodeCount: number) {
    return {
      x: 80,
      y: 35 + laneIndex * 150,
      width: Math.max(420, 260 + nodeCount * 180),
      height: 120,
    };
  }
}
