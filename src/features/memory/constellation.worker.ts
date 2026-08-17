import type { MemoryGraphEdge } from '../../api/memoryGraph';
import { forceLayoutGraph } from './graphPresentation';

interface LayoutNode { id: string }
interface LayoutRequest { nodes: LayoutNode[]; edges: MemoryGraphEdge[]; width: number; height: number }

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  try {
    const { nodes, edges, width, height } = event.data;
    const positions = forceLayoutGraph(
      nodes.map(node => ({ id: node.id })),
      edges,
      width,
      height,
    );
    self.postMessage({
      positions: Object.entries(positions).map(([id, point]) => ({ id, ...point })),
    });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'layout_failed' });
  }
};

export {};
