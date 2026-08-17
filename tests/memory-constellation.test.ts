import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  connectedEdges,
  createSyntheticVeil,
  forceLayoutGraph,
  lodGraph,
  searchGraphNodes,
} from '../src/features/memory/graphPresentation.ts';

const nodes = [
  { id: 'a', label: 'Alpha', type: 'community_fact' },
  { id: 'b', label: 'Beta', type: 'episode' },
  { id: 'c', label: 'Gamma', type: 'community_fact' },
];
const edges = [
  { id: 'ab', source: 'a', target: 'b' },
  { id: 'bc', source: 'b', target: 'c' },
  { id: 'dangling', source: 'c', target: 'hidden' },
];

test('synthetic veil is deterministic, fixed-size, and identity-free', () => {
  const first = createSyntheticVeil('stable-seed', [1, 8, 12], 720, 360);
  const second = createSyntheticVeil('stable-seed', [99], 720, 360);
  assert.deepEqual(first, second);
  assert.equal(first.length, 18);
  for (const point of first) {
    assert.deepEqual(Object.keys(point).sort(), ['opacity', 'radius', 'x', 'y']);
    assert.equal('id' in point, false);
    assert.equal('label' in point, false);
  }
  assert.notDeepEqual(first, createSyntheticVeil('other-seed', [1], 720, 360));
});

test('search, LOD, and path focus preserve only authorized graph relationships', () => {
  assert.deepEqual(searchGraphNodes(nodes, 'beta').map(node => node.id), ['b']);
  assert.equal(lodGraph(Array.from({ length: 250 }, (_, index) => ({ id: String(index) })), 0.5).length, 40);
  assert.deepEqual(connectedEdges(edges, nodes.slice(0, 2), null).map(edge => edge.id), ['ab']);
  assert.deepEqual(connectedEdges(edges, nodes, 'b').map(edge => edge.id), ['ab', 'bc']);
});

test('worker force layout handles empty, small, normal, and oversized fixtures deterministically', () => {
  for (const count of [0, 1, 100, 1000]) {
    const fixture = Array.from({ length: count }, (_, index) => ({ id: `node-${index}` }));
    const start = performance.now();
    const result = forceLayoutGraph(fixture, [], 720, 360);
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 1500, `layout took too long for ${count}: ${elapsed}ms`);
    assert.equal(Object.keys(result).length, Math.min(count, 200));
    assert.deepEqual(result, forceLayoutGraph(fixture, [], 720, 360));
  }
});

test('constellation surface keeps visual and accessibility/privacy contracts', async () => {
  const canvas = await readFile(new URL('../src/features/memory/ConstellationCanvas.tsx', import.meta.url), 'utf8');
  const panel = await readFile(new URL('../src/features/memory/MemoryConstellationPanel.tsx', import.meta.url), 'utf8');
  assert.match(canvas, /role="application"/);
  assert.match(canvas, /onPointerDown/);
  assert.match(canvas, /Search visible nodes/);
  assert.match(canvas, /minimap/);
  assert.match(canvas, /Synthetic veil/);
  assert.match(canvas, /aria-label="Center view on minimap"/);
  assert.match(panel, /ownerGuildConstellation/);
  assert.match(panel, /managerDeleteFact/);
  assert.match(panel, /TimelineList/);
  assert.match(panel, /data.nodes/);
});
