import test from 'node:test';
import assert from 'node:assert/strict';
import { flightCamera } from './camera.mjs';

for (const [width, height] of [[390,844], [320,568], [768,1024], [1440,900], [1920,1080], [844,390]]) {
  test(`upper-orbit framing at ${width}×${height}`, () => {
    const {cx, cy, r} = flightCamera(width, height);
    assert.equal(cx, width / 2);
    assert.ok(r > Math.min(width * .43, height * .385), 'zoomed beyond old camera');
    assert.ok(cy >= height * .70 && cy < height, 'hole center lower but visible');
    assert.ok(cy - r >= (height > width ? 190 : height < 500 ? 100 : 140) - .001, 'upper orbit below HUD');
    assert.ok(cy + r > height, 'southern orbit continues off screen');
  });
}
