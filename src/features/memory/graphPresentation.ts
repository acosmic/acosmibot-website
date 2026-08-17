import type { MemoryGraphNode, MemoryGraphEdge } from '../../api/memoryGraph';

export interface GraphPoint { x: number; y: number }
export interface VeilPoint extends GraphPoint { radius: number; opacity: number }

export const FORCE_LAYOUT_NODE_CAP = 200;
export const FORCE_LAYOUT_ITERATIONS = 64;

const hashSeed = (seed: string) => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const randomUnit = (state: { value: number }) => {
  state.value = (Math.imul(state.value ^ (state.value >>> 15), 1 | state.value) + 0x6d2b79f5) >>> 0;
  let value = Math.imul(state.value ^ (state.value >>> 7), 61 | state.value) ^ state.value;
  value = (value ^ (value >>> 14)) >>> 0;
  return value / 4294967296;
};

/** A safe, deterministic visual veil. Veil points have no graph identity or interaction. */
export function createSyntheticVeil(seed: string | null | undefined, densityBands: unknown[] | undefined, width: number, height: number): VeilPoint[] {
  if (!seed) return [];
  const state = { value: hashSeed(seed) };
  // Density bands are intentionally not interpreted as counts. A fixed
  // anonymous sample prevents the browser from turning a core aggregate into
  // an exact hidden-row or member-count inference.
  void densityBands;
  const count = 18;
  return Array.from({ length: count }, () => ({
    x: randomUnit(state) * width,
    y: randomUnit(state) * height,
    radius: 2 + randomUnit(state) * 8,
    opacity: 0.08 + randomUnit(state) * 0.15,
  }));
}

export function layoutGraph(nodes: MemoryGraphNode[], width: number, height: number): Record<string, GraphPoint> {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(42, Math.min(width, height) * 0.34);
  return Object.fromEntries(nodes.map((node, index) => {
    const angle = nodes.length ? (index / nodes.length) * Math.PI * 2 - Math.PI / 2 : 0;
    const ring = nodes.length > 8 && index % 2 ? radius * 0.68 : radius;
    return [node.id, { x: centerX + Math.cos(angle) * ring, y: centerY + Math.sin(angle) * ring }];
  }));
}

/**
 * Bounded deterministic force layout used by the worker. The cap is a
 * privacy/performance boundary: large tenant graphs are rendered through LOD,
 * never allowed to turn a browser tab into an unbounded physics simulation.
 */
export function forceLayoutGraph(
  nodes: MemoryGraphNode[],
  edges: MemoryGraphEdge[],
  width: number,
  height: number,
  iterations = FORCE_LAYOUT_ITERATIONS,
): Record<string, GraphPoint> {
  const boundedNodes = nodes.slice(0, FORCE_LAYOUT_NODE_CAP);
  if (!boundedNodes.length) return {};
  const positions = layoutGraph(boundedNodes, width, height);
  const velocity = Object.fromEntries(boundedNodes.map(node => [node.id, { x: 0, y: 0 }])) as Record<string, GraphPoint>;
  const allowed = new Set(boundedNodes.map(node => node.id));
  const links = edges.filter(edge => allowed.has(edge.source) && allowed.has(edge.target));
  const center = { x: width / 2, y: height / 2 };

  for (let iteration = 0; iteration < Math.max(0, Math.min(iterations, 96)); iteration += 1) {
    const force = Object.fromEntries(boundedNodes.map(node => [node.id, { x: 0, y: 0 }])) as Record<string, GraphPoint>;
    for (let left = 0; left < boundedNodes.length; left += 1) {
      const leftNode = boundedNodes[left];
      for (let right = left + 1; right < boundedNodes.length; right += 1) {
        const rightNode = boundedNodes[right];
        const dx = positions[leftNode.id].x - positions[rightNode.id].x;
        const dy = positions[leftNode.id].y - positions[rightNode.id].y;
        const distance = Math.max(12, Math.hypot(dx, dy));
        const strength = 520 / (distance * distance);
        const x = dx / distance * strength;
        const y = dy / distance * strength;
        force[leftNode.id].x += x;
        force[leftNode.id].y += y;
        force[rightNode.id].x -= x;
        force[rightNode.id].y -= y;
      }
    }
    links.forEach(edge => {
      const source = positions[edge.source];
      const target = positions[edge.target];
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const spring = (distance - 86) * 0.012;
      const x = dx / distance * spring;
      const y = dy / distance * spring;
      force[edge.source].x += x;
      force[edge.source].y += y;
      force[edge.target].x -= x;
      force[edge.target].y -= y;
    });
    boundedNodes.forEach(node => {
      const point = positions[node.id];
      const pull = 0.0015;
      velocity[node.id].x = (velocity[node.id].x + force[node.id].x + (center.x - point.x) * pull) * 0.84;
      velocity[node.id].y = (velocity[node.id].y + force[node.id].y + (center.y - point.y) * pull) * 0.84;
      point.x = Math.max(10, Math.min(width - 10, point.x + velocity[node.id].x));
      point.y = Math.max(10, Math.min(height - 10, point.y + velocity[node.id].y));
    });
  }
  return positions;
}

export function searchGraphNodes(nodes: MemoryGraphNode[], query: string): MemoryGraphNode[] {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return nodes;
  return nodes.filter(node => [node.label, node.summary, node.type, node.namespace, node.key].filter(Boolean).some(value => value!.toLocaleLowerCase().includes(term)));
}

export function lodGraph(nodes: MemoryGraphNode[], zoom: number, limit = 180): MemoryGraphNode[] {
  const lodLimit = zoom < 0.78 ? Math.min(40, limit) : zoom < 1.15 ? Math.min(100, limit) : limit;
  return nodes.slice(0, lodLimit);
}

export function connectedEdges(edges: MemoryGraphEdge[], visibleNodes: MemoryGraphNode[], pathNodeId: string | null): MemoryGraphEdge[] {
  const visible = new Set(visibleNodes.map(node => node.id));
  return edges.filter(edge => visible.has(edge.source) && visible.has(edge.target) && (!pathNodeId || edge.source === pathNodeId || edge.target === pathNodeId));
}

export function focusTransform(point: GraphPoint, viewportWidth: number, viewportHeight: number, scale: number): { x: number; y: number; scale: number } {
  return { x: viewportWidth / 2 - point.x * scale, y: viewportHeight / 2 - point.y * scale, scale };
}
