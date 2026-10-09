import test from 'node:test';
import assert from 'node:assert/strict';
import { predictPlacement, verifiedPlacement, placementCopy } from './placement.mjs';

const board = (scores, self) => ({ entries: scores.map((score, i) => ({ rank: i + 1, playerId: `p${i}`, score })), self });

test('a new best is placed among the loaded standings', () => {
  assert.equal(predictPlacement(board([900, 700, 500]), 950), 1);
  assert.equal(predictPlacement(board([900, 700, 500]), 600), 3);
  assert.equal(predictPlacement(board([]), 1), 1);
});
test('ties rank behind the earlier flight and the pilot does not compete with their own row', () => {
  assert.equal(predictPlacement(board([900, 700]), 900), 2);
  assert.equal(predictPlacement(board([900, 700, 500], { playerId: 'p1', score: 700 }), 800), 2);
});
test('no placement without a new best, a board, or a top-ten result', () => {
  assert.equal(predictPlacement(board([900, 700], { playerId: 'p1', score: 700 }), 700), null);
  assert.equal(predictPlacement(null, 500), null);
  assert.equal(predictPlacement(board([900]), 0), null);
  assert.equal(predictPlacement(board(Array.from({ length: 10 }, (_, i) => 1000 - i)), 5), null);
  assert.equal(predictPlacement(board(Array.from({ length: 10 }, (_, i) => 1000 - i)), 992.9), 10);
});
test('only a verified new best inside the top ten is a placement', () => {
  assert.equal(verifiedPlacement({ rank: 4, personalBest: true }), 4);
  assert.equal(verifiedPlacement({ rank: 4, personalBest: false }), null);
  assert.equal(verifiedPlacement({ rank: 11, personalBest: true }), null);
  assert.equal(verifiedPlacement({ personalBest: true }), null);
});
test('first place has its own headline', () => {
  assert.equal(placementCopy(1).title, 'SERVER #1');
  assert.equal(placementCopy(2).title, 'SERVER #2');
  assert.match(placementCopy(2).lead, /Podium/);
  assert.match(placementCopy(7).lead, /Top 10/);
  assert.notEqual(placementCopy(1).lead, placementCopy(2).lead);
});
