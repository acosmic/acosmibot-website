import assert from 'node:assert/strict';
import test from 'node:test';
import { INTENSITY_LEVELS, normalizePersonalityIntensity } from '../src/features/ai/personalityIntensity.ts';

test('all five intensity steps round trip as numbers', () => {
  assert.deepEqual(INTENSITY_LEVELS.map(item => item.value), [1, 2, 3, 4, 5]);
  for (const { value } of INTENSITY_LEVELS) {
    assert.equal(normalizePersonalityIntensity(value), value);
    assert.equal(normalizePersonalityIntensity(String(value)), value);
  }
});

test('legacy settings retain their endpoints and malformed values stay bounded', () => {
  assert.equal(normalizePersonalityIntensity('subtle'), 1);
  assert.equal(normalizePersonalityIntensity('full'), 5);
  assert.equal(normalizePersonalityIntensity(-10), 1);
  assert.equal(normalizePersonalityIntensity(100), 5);
  for (const value of [undefined, null, true, {}, [], '', 'bogus', 2.5, NaN, Infinity]) {
    assert.equal(normalizePersonalityIntensity(value), 5);
  }
});
