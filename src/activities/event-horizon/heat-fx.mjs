// Draw in the same local, rotated coordinate space as the rocket sprite.
// Small gradients only: no full-screen filters, particles, or bitmap edits.
export function visualHeat(heat, multiplier) {
  // Warn before the inner orbit starts accumulating actual heat (~3.5×).
  return Math.max(heat, Math.max(0, Math.min(25, (multiplier - 2) * 16)));
}
export function rocketTremble(multiplier, time, reduced = false) {
  const strength = reduced ? 0 : Math.max(0, Math.min(1, (multiplier - 2.8) / 2));
  return { x: Math.sin(time * 43) * .9 * strength,
    y: Math.sin(time * 57) * 1.4 * strength,
    angle: Math.sin(time * 39) * .012 * strength };
}
export function drawNoseHeat(ctx, size, heat, time, reduced = false) {
  const level = Math.max(0, Math.min(1, heat / 100));
  if (!level) return;
  // A slow breathing glow, never a strobe. Reduced effects keeps steady heat.
  const pulse = reduced ? 1 : 1 + Math.sin(time * Math.PI * 2 * .8) * .12 * level;
  const intensity = Math.min(1, level ** .4 * pulse);
  ctx.save();
  ctx.translate(size * .41, -size * .255);
  ctx.rotate(-Math.PI * .23);
  ctx.globalCompositeOperation = 'screen';
  // Local +X points forward: all heat washes rearward over the fuselage.
  const length = size * (.28 + .48 * level) * pulse;
  const width = size * (.075 + .11 * level);
  const tip = size * .035;
  const glow = ctx.createLinearGradient(-length, 0, tip, 0);
  glow.addColorStop(0, 'rgba(255,0,0,0)');
  glow.addColorStop(.45, `rgba(255,15,8,${.24 * intensity})`);
  glow.addColorStop(.85, `rgba(255,35,15,${.75 * intensity})`);
  glow.addColorStop(1, `rgba(255,125,55,${intensity})`);
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.moveTo(tip, 0);
  ctx.bezierCurveTo(0, -width, -length * .3, -width, -length, 0);
  ctx.bezierCurveTo(-length * .3, width, 0, width, tip, 0);
  ctx.fill();
  // A concentrated bow of incandescent heat, not a circular aura. Keep the
  // hottest edge at the existing tip anchor and wash the energy backwards.
  const core = ctx.createLinearGradient(-size * .24, 0, tip, 0);
  core.addColorStop(0, 'rgba(255,25,0,0)');
  core.addColorStop(.55, `rgba(255,55,12,${.8 * intensity})`);
  core.addColorStop(.86, `rgba(255,165,65,${intensity})`);
  core.addColorStop(1, `rgba(255,240,190,${intensity})`);
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.moveTo(tip, 0);
  ctx.bezierCurveTo(0, -width * .7, -size * .14, -width * .55, -size * .24, 0);
  ctx.bezierCurveTo(-size * .14, width * .55, 0, width * .7, tip, 0);
  ctx.fill();
  // Thin swept shock lines taper and fade toward the tail, not a circular halo.
  for (const side of [-1, 1]) {
    const streak = ctx.createLinearGradient(-length, 0, tip, 0);
    streak.addColorStop(0, 'rgba(255,15,0,0)');
    streak.addColorStop(.65, `rgba(255,40,15,${.35 * intensity})`);
    streak.addColorStop(1, `rgba(255,${Math.round(90 + 70 * level)},80,${.85 * intensity})`);
    ctx.fillStyle = streak;
    ctx.beginPath(); ctx.moveTo(tip, 0);
    ctx.bezierCurveTo(-length * .1, side * width, -length * .4, side * width * 1.15, -length, side * width * .7);
    ctx.bezierCurveTo(-length * .4, side * width * .8, -length * .1, side * width * .55, tip, 0);
    ctx.fill();
  }
  ctx.restore();
}

// Broken violet side brackets mean READY; the existing full circle
// remains reserved for active invulnerability. No extra collision geometry.
export function drawPhaseReady(ctx, size, energy, phase, time, reduced = false) {
  if (energy < 100 || phase > 0) return;
  const pulse = reduced ? 0 : (1 + Math.sin(time * Math.PI * 1.2)) / 2;
  const radius = size * (.59 + pulse * .025);
  ctx.save();
  ctx.strokeStyle = '#bb9aff';
  ctx.lineWidth = Math.max(1.5, size * .024);
  ctx.globalAlpha = .8 + pulse * .2;
  ctx.shadowColor = '#a879ff';
  ctx.shadowBlur = reduced ? 0 : Math.min(10, size * .12);
  for (const angle of [0, Math.PI]) {
    ctx.beginPath(); ctx.arc(0, 0, radius, angle - .65, angle + .65); ctx.stroke();
  }
  ctx.restore();
}
