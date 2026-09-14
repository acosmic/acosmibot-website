import test from 'node:test';
import assert from 'node:assert/strict';
import { flightCamera, rocketSize, obstacleSize } from './camera.mjs';

for (const [width, height] of [[390,844], [320,568], [768,1024], [1440,900], [1920,1080], [844,390]]) {
  test(`upper-orbit framing at ${width}×${height}`, () => {
    const {cx, cy, r} = flightCamera(width, height);
    assert.equal(cx, width / 2);
    assert.ok(cy >= height * (height > width ? .58 : .70) && cy < height, 'hole center lower but visible');
    assert.ok(cy - r >= (height > width ? 190 : height < 500 ? 100 : 140) - .001, 'upper orbit below HUD');
    if (height > width) {
      assert.ok(cx - r * 1.05 >= 6 - .001, 'left approach fits with margin');
      assert.ok(cx + r * 1.05 <= width - 6 + .001, 'right approach fits with margin');
    } else {
      assert.equal(r, Math.min(width * .48, height * .56), 'desktop camera unchanged');
    }
  });
}

test('mobile artwork scales with the world like the reference desktop view', () => {
  const reference = flightCamera(1440, 900).r;
  assert.equal(rocketSize(reference), 84);
  for (const [w,h] of [[320,568],[390,844],[430,932],[768,1024],[844,390]]) {
    const r = flightCamera(w,h).r;
    assert.ok(Math.abs(rocketSize(r)/r - rocketSize(reference)/reference) < 1e-12);
    for (const size of [.018,.032,.044,.046,.050]) {
      assert.ok(Math.abs(obstacleSize(r,size)/r - size) < 1e-12);
      assert.ok(Math.abs(rocketSize(r)/obstacleSize(r,size) - rocketSize(reference)/obstacleSize(reference,size)) < 1e-12);
    }
  }
});

test('large desktop sprite retains its established cap', () => {
  assert.equal(rocketSize(flightCamera(1920,1080).r),84);
});
