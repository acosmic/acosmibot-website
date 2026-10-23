import assert from 'node:assert/strict';
import test from 'node:test';
import { selectStreamer } from '../src/utils/streamingSelection.ts';

test('Free selection switches delivery and retains every saved configuration', () => {
  const saved = Array.from({ length: 5 }, (_, i) => ({ username: `creator${i}`, enabled: i === 0, message: 'saved' }));
  const next = selectStreamer(saved, 3, 1);
  assert.deepEqual(next.map(s => s.enabled), [false, false, false, true, false]);
  assert.deepEqual(next.map(s => s.username), saved.map(s => s.username));
  assert.ok(next.every(s => s.message === 'saved'));
  assert.equal(saved[0].enabled, true);
});

test('paid selection can activate all five saved creators', () => {
  const saved = Array.from({ length: 5 }, (_, i) => ({ enabled: i < 4 }));
  assert.ok(selectStreamer(saved, 4, 5).every(s => s.enabled));
});

test('selecting from a legacy over-limit roster produces a single Free selection', () => {
  const saved = Array.from({ length: 5 }, () => ({ enabled: true }));
  assert.deepEqual(selectStreamer(saved, 4, 1).map(s => s.enabled), [false, false, false, false, true]);
});
