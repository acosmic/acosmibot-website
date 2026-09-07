import test from 'node:test';
import assert from 'node:assert/strict';
import { personalityDuration } from '../src/features/ai/personalityDuration.ts';

test('personality duration defaults to ten minutes and preserves explicit permanent', () => {
  for (const value of [undefined, null, '', false, true, 'invalid']) assert.equal(personalityDuration(value), 10);
  for (const value of [0, '0']) assert.equal(personalityDuration(value), 0);
  assert.equal(personalityDuration(60), 60);
  assert.equal(personalityDuration(2), 5);
  assert.equal(personalityDuration(99999), 10080);
});
