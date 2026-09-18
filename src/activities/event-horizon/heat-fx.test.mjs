import test from 'node:test';
import assert from 'node:assert/strict';
import {heatAnchor,HEAT_ANGLE,ROCKET_NOSE_X,ROCKET_NOSE_Y} from './rocket-art.mjs';
import { drawNoseHeat, drawPhaseReady, visualHeat } from './heat-fx.mjs';

function canvasSpy() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, name) => (...args) => {
      calls.push([name, ...args]);
      if (name === 'createLinearGradient') return { addColorStop: (...stop) => calls.push(['stop', ...stop]) };
    },
    set: (_, name, value) => { calls.push([name, typeof value === 'object' ? 'gradient' : value]); return true; },
  });
  return { ctx, calls };
}
test('ready cue appears only at full charge and never during active shift', () => {
  for (const [energy, phase, visible] of [[0,0,false],[99.99,0,false],[100,0,true],[100,.2,false]]) {
    const { ctx, calls } = canvasSpy(); drawPhaseReady(ctx, 30, energy, phase, 1);
    assert.equal(calls.length > 0, visible);
    if (visible) { assert.equal(calls.filter(c => c[0] === 'arc').length, 2); assert.equal(calls.at(-1)[0], 'restore'); }
  }
});
test('reduced effects keeps both indicators steady across time', () => {
  for (const draw of [c => drawNoseHeat(c,84,75,1,true), c => drawPhaseReady(c,84,100,0,1,true)]) {
    const a = canvasSpy(); draw(a.ctx); assert.equal(a.calls.at(-1)[0], 'restore');
  }
  for (const effect of ['heat', 'ready']) {
    const samples = [1, 7].map(t => { const s = canvasSpy();
      if (effect === 'heat') drawNoseHeat(s.ctx,84,75,t,true);
      else drawPhaseReady(s.ctx,84,100,0,t,true);
      return s.calls;
    });
    assert.deepEqual(...samples);
  }
});
test('heat stays off when cold, is visible early, and uses four swept fills', () => {
  const cold = canvasSpy(); drawNoseHeat(cold.ctx,84,0,1); assert.equal(cold.calls.length, 0);
  assert.ok(visualHeat(0,2.5) > 0);
  for (const size of [30,84]) {
    const hot = canvasSpy(); drawNoseHeat(hot.ctx,size,100,1,true);
    assert.equal(hot.calls.filter(c => c[0] === 'fill').length,4);
    assert.equal(hot.calls.some(c => c[0] === 'arc'),false);
    const anchor=heatAnchor(size);
    assert.deepEqual(hot.calls.find(c => c[0] === 'translate'), ['translate',anchor.x,anchor.y]);
    assert.ok(Math.abs(anchor.x+Math.cos(HEAT_ANGLE)*size*.035-size*ROCKET_NOSE_X)<1e-9);
    assert.ok(Math.abs(anchor.y+Math.sin(HEAT_ANGLE)*size*.035-size*ROCKET_NOSE_Y)<1e-9);
    assert.ok(hot.calls.some(c => c[0] === 'stop' && c[2] === 'rgba(255,240,190,1)'));
  }
});
