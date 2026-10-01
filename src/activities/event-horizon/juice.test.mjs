import test from 'node:test';
import assert from 'node:assert/strict';
import { createJuice, addTrauma, punch, shockwave, updateJuice, shakeOffset, popScale, rollToward,
  createQuality, sampleQuality, doppler, DOPPLER_ANGLE, heatTier } from './juice.mjs';

test('trauma is clamped, decays, and shake scales with its square', () => {
  const j = createJuice();
  addTrauma(j, 3);
  assert.equal(j.trauma, 1);
  const strong = Math.hypot(...Object.values(shakeOffset(j, 1.234)).slice(0, 2));
  j.trauma = .3; j.kickX = j.kickY = 0;
  const weak = Math.hypot(...Object.values(shakeOffset(j, 1.234)).slice(0, 2));
  assert.ok(weak < strong * .2);
  updateJuice(j, 10, 0);
  assert.equal(j.trauma, 0);
});

test('reduced effects never shake', () => {
  const j = createJuice(); addTrauma(j, 1, 1, 0);
  assert.deepEqual(shakeOffset(j, 2, true), { x: 0, y: 0, rotation: 0 });
});

test('punch keeps the strongest impulse and hitstop expires', () => {
  const j = createJuice();
  punch(j, { zoom: .03, hitstop: .05 }); punch(j, { zoom: .01, hitstop: .02 });
  assert.equal(j.zoom, .03); assert.equal(j.hitstop, .05);
  updateJuice(j, .06, 0);
  assert.equal(j.hitstop, 0);
});

test('only the two newest shockwaves are kept and old waves expire', () => {
  const j = createJuice();
  shockwave(j, 1, 1, 1, 0); shockwave(j, 2, 2, 1, 0); shockwave(j, 3, 3, 1, .1);
  assert.deepEqual(j.waves.map(w => w.x), [2, 3]);
  updateJuice(j, .016, 2);
  assert.equal(j.waves.length, 0);
});

test('pop scale settles at exactly 1 after its duration', () => {
  assert.equal(popScale(.5), 1);
  assert.equal(popScale(-1), 1);
  assert.ok(popScale(.03) > 1);
});

test('rolling counters approach without overshooting and snap downward', () => {
  let value = 0;
  for (let i = 0; i < 200; i++) value = rollToward(value, 1000, 1 / 60);
  assert.equal(value, 1000);
  assert.equal(rollToward(1000, 0, 1 / 60), 0);
});

test('quality steps down after sustained slow frames and never upgrades', () => {
  const q = createQuality('high');
  for (let i = 0; i < 200; i++) sampleQuality(q, 40);
  assert.equal(q.tier, 'medium');
  for (let i = 0; i < 2000; i++) sampleQuality(q, 5);
  assert.equal(q.tier, 'medium');
  for (let i = 0; i < 50; i++) sampleQuality(q, 5000);
  assert.equal(q.tier, 'medium');
});

test('doppler beaming peaks on the approaching side', () => {
  assert.ok(Math.abs(doppler(DOPPLER_ANGLE) - 1.55) < 1e-9);
  assert.ok(Math.abs(doppler(DOPPLER_ANGLE + Math.PI) - .45) < 1e-9);
});

test('heat tiers follow the multiplier', () => {
  assert.deepEqual([1, 2.2, 3.4, 4.8].map(heatTier), ['cool', 'warm', 'hot', 'blaze']);
});
