// Canvas 2D artwork baked once per resize into GPU textures. Seeded randomness
// keeps the painted sky identical between sessions and never touches the sim.
const TAU = Math.PI * 2;
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function drawGlow(ctx, size) {
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.55)');
  g.addColorStop(.6, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
}
// Horizontal streak; scaled along velocity for motion-stretched sparks.
export function drawSpark(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.7, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, TAU); ctx.fill();
}
export function drawStar(ctx, size) {
  const c = size / 2; drawGlow(ctx, size);
  ctx.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[size, size * .06], [size * .06, size]]) {
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(c - w / 2, c - h / 2, w, h);
  }
  ctx.globalCompositeOperation = 'source-over';
}
export function drawRing(ctx, size, thickness = .06) {
  const c = size / 2, r = c * (1 - thickness * 2);
  const g = ctx.createRadialGradient(c, c, r - c * thickness * 1.5, c, c, r + c * thickness * 1.5);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
}
// A warm crescent facing local +X. Rotated toward the hole, it rim-lights rocks.
export function drawRim(ctx, rr) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(rr * .55, 0, 0, rr * .55, 0, rr * 1.15);
  g.addColorStop(0, 'rgba(255,190,120,.85)'); g.addColorStop(.55, 'rgba(255,120,60,.35)'); g.addColorStop(1, 'rgba(255,90,40,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rr * 1.04, -1.25, 1.25); ctx.arc(rr * -.25, 0, rr * 1.02, 1.05, -1.05, true); ctx.closePath(); ctx.fill();
  ctx.restore();
}
export function drawChevron(ctx, size) {
  ctx.save(); ctx.translate(size / 2, size / 2);
  ctx.shadowColor = '#ff9a5a'; ctx.shadowBlur = size * .25;
  ctx.fillStyle = '#ffd2a6';
  for (const offset of [-size * .18, size * .08]) {
    ctx.beginPath(); ctx.moveTo(offset - size * .12, -size * .26); ctx.lineTo(offset + size * .16, 0); ctx.lineTo(offset - size * .12, size * .26);
    ctx.lineTo(offset - size * .04, 0); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
export function drawReticle(ctx, size) {
  const c = size / 2, r = size * .34;
  ctx.save(); ctx.translate(c, c); ctx.strokeStyle = '#ffc48f'; ctx.lineWidth = Math.max(1.5, size * .035);
  ctx.shadowColor = '#ff8a4a'; ctx.shadowBlur = size * .12;
  for (let i = 0; i < 4; i++) { const a = i * TAU / 4; ctx.beginPath(); ctx.arc(0, 0, r, a + .25, a + TAU / 4 - .25); ctx.stroke(); }
  for (let i = 0; i < 4; i++) { const a = i * TAU / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * .55, Math.sin(a) * r * .55); ctx.lineTo(Math.cos(a) * r * .85, Math.sin(a) * r * .85); ctx.stroke(); }
  ctx.restore();
}
// A soft wedge from local origin along +X for volumetric pulsar god rays.
export function drawCone(ctx, length, width) {
  const g = ctx.createLinearGradient(0, 0, length, 0);
  g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, width / 2); ctx.lineTo(length, 0); ctx.lineTo(length, width); ctx.closePath(); ctx.fill();
  ctx.globalCompositeOperation = 'destination-in';
  const v = ctx.createLinearGradient(0, 0, 0, width);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(.5, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, length, width); ctx.globalCompositeOperation = 'source-over';
}
// Radial speed lines around the screen centre, transparent in the middle.
export function drawSpeedLines(ctx, w, h, seed = 7) {
  const rand = seeded(seed), cx = w / 2, cy = h / 2, far = Math.hypot(w, h) / 2;
  ctx.save(); ctx.translate(cx, cy);
  for (let i = 0; i < 90; i++) {
    const a = rand() * TAU, start = far * (.42 + rand() * .25), end = far * (1 + rand() * .1), width = .6 + rand() * 1.8;
    const g = ctx.createLinearGradient(Math.cos(a) * start, Math.sin(a) * start, Math.cos(a) * end, Math.sin(a) * end);
    g.addColorStop(0, 'rgba(210,250,255,0)'); g.addColorStop(1, 'rgba(210,250,255,.75)');
    ctx.strokeStyle = g; ctx.lineWidth = width; ctx.beginPath();
    ctx.moveTo(Math.cos(a) * start, Math.sin(a) * start); ctx.lineTo(Math.cos(a) * end, Math.sin(a) * end); ctx.stroke();
  }
  ctx.restore();
}

// Painterly nebula: additive gas clouds along curved filaments, then dust lanes.
const NEBULA_PALETTES = [
  ['rgba(110,70,210,A)', 'rgba(40,120,200,A)', 'rgba(190,60,150,A)', 'rgba(60,200,220,A)'],
  ['rgba(30,110,170,A)', 'rgba(140,60,190,A)', 'rgba(220,110,90,A)', 'rgba(70,60,160,A)'],
];
export function drawNebula(ctx, w, h, seed, palette = 0, density = 1) {
  const rand = seeded(seed), colors = NEBULA_PALETTES[palette % NEBULA_PALETTES.length];
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const filaments = 3;
  for (let f = 0; f < filaments; f++) {
    const x0 = rand() * w, y0 = rand() * h, x1 = rand() * w, y1 = rand() * h, mx = rand() * w, my = rand() * h;
    const color = colors[f % colors.length];
    for (let i = 0; i < 26 * density; i++) {
      const t = rand(), u = 1 - t;
      const x = u * u * x0 + 2 * u * t * mx + t * t * x1 + (rand() - .5) * w * .12;
      const y = u * u * y0 + 2 * u * t * my + t * t * y1 + (rand() - .5) * h * .12;
      const r = Math.max(w, h) * (.04 + rand() * .12), a = (.025 + rand() * .05).toFixed(3);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color.replace('A', a)); g.addColorStop(1, color.replace('A', '0'));
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 14 * density; i++) {
    const x = rand() * w, y = rand() * h, r = Math.max(w, h) * (.03 + rand() * .07);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(3,5,12,.32)'); g.addColorStop(1, 'rgba(3,5,12,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5 * density; i++) {
    const x = rand() * w, y = rand() * h, r = 3 + rand() * 7;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, 'rgba(255,240,255,.35)'); g.addColorStop(1, 'rgba(160,140,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  }
  ctx.restore();
}
export function drawGalaxy(ctx, size, seed) {
  const rand = seeded(seed), c = size / 2;
  ctx.save(); ctx.translate(c, c); ctx.rotate(rand() * TAU); ctx.scale(1, .38 + rand() * .3);
  ctx.globalCompositeOperation = 'lighter';
  for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 70; i++) {
    const t = i / 70, a = arm * Math.PI + t * 4.4, r = t * c * .9;
    ctx.fillStyle = `rgba(${200 + rand() * 55},${190 + rand() * 50},255,${.12 * (1 - t)})`;
    ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1 + (1 - t) * c * .08, 0, TAU); ctx.fill();
  }
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, c * .3);
  g.addColorStop(0, 'rgba(255,245,225,.8)'); g.addColorStop(1, 'rgba(255,220,200,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, c * .3, 0, TAU); ctx.fill();
  ctx.restore();
}
