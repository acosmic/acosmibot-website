import React from 'react';
import type { MemoryGraphEdge, MemoryGraphNode } from '@/api/memoryGraph';
import { connectedEdges, createSyntheticVeil, focusTransform, layoutGraph, lodGraph, searchGraphNodes, type GraphPoint } from './graphPresentation';

interface Transform { x: number; y: number; scale: number }

interface Props {
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
  veil?: { seed?: string | null; density_bands?: unknown[] };
  onSelect?: (node: MemoryGraphNode) => void;
  label?: string;
}

const WIDTH = 720;
const HEIGHT = 360;
const MIN_SCALE = 0.55;
const MAX_SCALE = 2.8;

const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

export const ConstellationCanvas: React.FC<Props> = ({ nodes, edges, veil, onSelect, label = 'Memory constellation' }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const dragRef = React.useRef<{ pointerId: number; startX: number; startY: number; origin: Transform; moved: boolean; nodeId: string | null } | null>(null);
  const [points, setPoints] = React.useState<Record<string, GraphPoint>>({});
  const [transform, setTransform] = React.useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [query, setQuery] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [pathFocus, setPathFocus] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  const searchableNodes = React.useMemo(() => searchGraphNodes(nodes, query), [nodes, query]);
  const visibleNodes = React.useMemo(() => lodGraph(searchableNodes, transform.scale), [searchableNodes, transform.scale]);
  const visibleEdges = React.useMemo(() => connectedEdges(edges, visibleNodes, pathFocus ? selectedId : null), [edges, visibleNodes, pathFocus, selectedId]);
  const pointMap = React.useMemo(() => Object.keys(points).length ? points : layoutGraph(nodes, WIDTH, HEIGHT), [nodes, points]);
  const veilPoints = React.useMemo(() => createSyntheticVeil(veil?.seed, veil?.density_bands, WIDTH, HEIGHT), [veil?.seed, veil?.density_bands]);

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  React.useEffect(() => {
    if (typeof Worker === 'undefined') {
      setPoints(layoutGraph(nodes, WIDTH, HEIGHT));
      return undefined;
    }
    const worker = new Worker(new URL('./constellation.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ positions?: Array<{ id: string; x: number; y: number }>; error?: string }>) => {
      if (!event.data.positions) {
        setPoints(layoutGraph(nodes, WIDTH, HEIGHT));
        return;
      }
      setPoints(Object.fromEntries(event.data.positions.map(position => [position.id, position])));
    };
    worker.onerror = () => setPoints(layoutGraph(nodes, WIDTH, HEIGHT));
    worker.postMessage({ nodes: nodes.map(({ id }) => ({ id })), edges, width: WIDTH, height: HEIGHT });
    return () => worker.terminate();
  }, [edges, nodes]);

  const selectNode = React.useCallback((node: MemoryGraphNode | undefined) => {
    if (!node) return;
    setSelectedId(node.id);
    onSelect?.(node);
  }, [onSelect]);

  const screenPoint = React.useCallback((event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const bounds = canvas.getBoundingClientRect();
    const sx = (event.clientX - bounds.left) * (WIDTH / bounds.width);
    const sy = (event.clientY - bounds.top) * (HEIGHT / bounds.height);
    return { x: (sx - transform.x) / transform.scale, y: (sy - transform.y) / transform.scale };
  }, [transform]);

  const hitNode = React.useCallback((world: GraphPoint) => {
    let nearest: MemoryGraphNode | undefined;
    let distance = Number.POSITIVE_INFINITY;
    for (const node of visibleNodes) {
      const point = pointMap[node.id];
      if (!point) continue;
      const current = Math.hypot(point.x - world.x, point.y - world.y);
      if (current < distance && current <= 18 / transform.scale) { nearest = node; distance = current; }
    }
    return nearest;
  }, [pointMap, transform.scale, visibleNodes]);

  const resetView = () => setTransform({ x: 0, y: 0, scale: 1 });
  const focusNode = (node: MemoryGraphNode | undefined) => {
    if (!node || !pointMap[node.id]) return;
    setTransform(focusTransform(pointMap[node.id], WIDTH, HEIGHT, transform.scale));
  };
  const focusSelected = () => focusNode(visibleNodes.find(node => node.id === selectedId));
  const zoomAt = (nextScale: number, screenX = WIDTH / 2, screenY = HEIGHT / 2) => {
    const scale = clampScale(nextScale);
    setTransform(current => {
      const worldX = (screenX - current.x) / current.scale;
      const worldY = (screenY - current.y) / current.scale;
      return { scale, x: screenX - worldX * scale, y: screenY - worldY * scale };
    });
  };

  const selectByOffset = (offset: number) => {
    if (!visibleNodes.length) return;
    const currentIndex = Math.max(0, visibleNodes.findIndex(node => node.id === selectedId));
    selectNode(visibleNodes[(currentIndex + offset + visibleNodes.length) % visibleNodes.length]);
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = WIDTH * ratio;
    canvas.height = HEIGHT * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.fillStyle = '#0D151D';
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.save();
    context.translate(transform.x, transform.y);
    context.scale(transform.scale, transform.scale);
    context.strokeStyle = 'rgba(0,217,255,.18)';
    context.lineWidth = 1 / transform.scale;
    visibleEdges.forEach(edge => {
      const source = pointMap[edge.source];
      const target = pointMap[edge.target];
      if (!source || !target) return;
      context.beginPath();
      context.moveTo(source.x, source.y);
      context.lineTo(target.x, target.y);
      context.stroke();
    });
    // Synthetic veil is deliberately drawn as anonymous atmosphere only. It
    // never enters the node list, search index, hit-test, minimap, or edges.
    veilPoints.forEach(point => {
      context.beginPath();
      context.fillStyle = `rgba(159,139,255,${point.opacity})`;
      context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
      context.fill();
    });
    visibleNodes.forEach(node => {
      const point = pointMap[node.id];
      if (!point) return;
      const selected = node.id === selectedId;
      context.beginPath();
      context.fillStyle = selected ? '#F4FBFF' : '#00D9FF';
      if (!reducedMotion) { context.shadowColor = '#00D9FF'; context.shadowBlur = selected ? 18 : 10; }
      context.arc(point.x, point.y, selected ? 8 / transform.scale : 5 / transform.scale, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      if (transform.scale >= 0.82 || selected || query.trim()) {
        context.fillStyle = '#F4FBFF';
        context.font = `${12 / transform.scale}px Poppins, sans-serif`;
        context.fillText(node.label || node.type || 'Memory node', point.x + 10 / transform.scale, point.y + 4 / transform.scale);
      }
    });
    context.restore();
  }, [pointMap, query, reducedMotion, selectedId, transform, veilPoints, visibleEdges, visibleNodes]);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const node = hitNode(screenPoint(event));
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: transform, moved: false, nodeId: node?.id ?? null };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = (event.clientX - drag.startX) * (WIDTH / event.currentTarget.getBoundingClientRect().width);
    const dy = (event.clientY - drag.startY) * (HEIGHT / event.currentTarget.getBoundingClientRect().height);
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    if (drag.moved) setTransform({ ...drag.origin, x: drag.origin.x + dx, y: drag.origin.y + dy });
  };
  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag && !drag.moved) selectNode(nodes.find(node => node.id === drag.nodeId));
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  const onWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const sx = (event.clientX - bounds.left) * (WIDTH / bounds.width);
    const sy = (event.clientY - bounds.top) * (HEIGHT / bounds.height);
    zoomAt(transform.scale * (event.deltaY < 0 ? 1.12 : 0.89), sx, sy);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); selectByOffset(1); }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); selectByOffset(-1); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectNode(visibleNodes.find(node => node.id === selectedId)); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(transform.scale * 1.2); }
    else if (event.key === '-') { event.preventDefault(); zoomAt(transform.scale * 0.83); }
    else if (event.key === '0') { event.preventDefault(); resetView(); }
    else if (event.key.toLocaleLowerCase() === 'f') { event.preventDefault(); focusSelected(); }
  };

  const minimapPoint = (point: GraphPoint) => ({ x: point.x / WIDTH * 180, y: point.y / HEIGHT * 90 });
  const viewport = { x: (-transform.x / transform.scale) / WIDTH * 180, y: (-transform.y / transform.scale) / HEIGHT * 90, width: 180 / transform.scale, height: 90 / transform.scale };

  return (
    <div className="memory-constellation__visual" data-lod={transform.scale < 0.78 ? 'overview' : transform.scale < 1.15 ? 'balanced' : 'detail'}>
      <div className="memory-constellation__stage-wrap">
        <div className="memory-constellation__toolbar" role="toolbar" aria-label={`${label} controls`}>
          <label className="memory-constellation__search"><span className="sr-only">Search visible nodes</span><input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') selectNode(searchableNodes[0]); }} placeholder="Search visible nodes" type="search" /></label>
          <button type="button" onClick={() => zoomAt(transform.scale * 1.2)} aria-label="Zoom in">+</button><button type="button" onClick={() => zoomAt(transform.scale * 0.83)} aria-label="Zoom out">−</button><button type="button" onClick={resetView}>Reset</button><button type="button" onClick={focusSelected} disabled={!selectedId}>Focus path</button><button type="button" className={pathFocus ? 'is-active' : undefined} onClick={() => setPathFocus(value => !value)} disabled={!selectedId}>{pathFocus ? 'Show all links' : 'Path only'}</button>
        </div>
        <canvas ref={canvasRef} className="memory-constellation__canvas" role="application" aria-label={`${label}. Use arrow keys to select nodes, plus and minus to zoom, and drag to pan.`} tabIndex={0} width={WIDTH} height={HEIGHT} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} onKeyDown={onKeyDown} />
        <button type="button" className="memory-constellation__minimap" aria-label="Center view on minimap" onClick={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); const x = (event.clientX - bounds.left) / bounds.width * WIDTH; const y = (event.clientY - bounds.top) / bounds.height * HEIGHT; setTransform(current => ({ ...current, x: WIDTH / 2 - x * current.scale, y: HEIGHT / 2 - y * current.scale })); }}>
          <svg viewBox="0 0 180 90" aria-hidden="true">
            <rect width="180" height="90" fill="rgba(8,17,26,.88)" />
            {nodes.map(node => { const point = pointMap[node.id]; return point ? <circle key={node.id} cx={minimapPoint(point).x} cy={minimapPoint(point).y} r="1.5" fill={node.id === selectedId ? '#F4FBFF' : '#00D9FF'} /> : null; })}
            <rect x={Math.max(0, viewport.x)} y={Math.max(0, viewport.y)} width={Math.min(180, viewport.width)} height={Math.min(90, viewport.height)} fill="none" stroke="#F4FBFF" strokeWidth="1" />
          </svg>
        </button>
        <p className="memory-constellation__hint">{visibleNodes.length} of {searchableNodes.length} visible · {transform.scale < 0.78 ? 'overview detail' : transform.scale < 1.15 ? 'balanced detail' : 'full detail'} · Drag to pan</p>
      </div>
      <ol className="memory-constellation__list" aria-label={`${label} accessible node list`}>
        {nodes.length ? nodes.map(node => (
          <li key={node.id} className={node.id === selectedId ? 'is-selected' : undefined}>
            <button type="button" onClick={() => selectNode(node)}>
              <span className="memory-constellation__dot" aria-hidden="true" />
              <span>{node.label || node.type || 'Memory node'}</span>
              {node.summary && <small>{node.summary}</small>}
            </button>
          </li>
        )) : <li className="memory-constellation__empty">No shareable nodes are available in this view.</li>}
      </ol>
    </div>
  );
};
