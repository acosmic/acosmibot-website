import React, { useEffect, useRef } from 'react';

/**
 * Ambient, self-playing "Asteroids" attract-mode demo rendered behind the hero.
 *
 * Drop it as the FIRST child of a `position: relative; overflow: hidden`
 * container (the `.hero` section). It paints two absolutely-positioned layers —
 * a vector-wireframe canvas and a readability veil — and never captures pointer
 * or keyboard input, so it stays purely decorative.
 *
 * Behaviour:
 *   - Respects `prefers-reduced-motion` (renders a single static frame).
 *   - Pauses the animation loop when scrolled out of view (IntersectionObserver).
 *   - Resizes with its container (ResizeObserver) and cleans everything up on unmount.
 *
 * Colours are hard-coded to the site's cyan-on-dark scheme (see globals.css:
 * --primary-color #00D9FF, --bg-primary #1A1A1A).
 */

interface Ship { x: number; y: number; a: number; vx: number; vy: number; thrust: boolean; }
interface Asteroid {
  x: number; y: number; tier: number; r: number; shape: number[];
  vx: number; vy: number; rot: number; rotSpeed: number;
}
interface Bullet { x: number; y: number; vx: number; vy: number; life: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; }
interface Game {
  ship: Ship;
  asteroids: Asteroid[];
  bullets: Bullet[];
  particles: Particle[];
  fireCd: number;
  minRocks: number;
}

export const HeroAsteroids: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !parent || !ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    let raf = 0;
    let visible = true;
    let game: Game | null = null;

    // ── helpers ──────────────────────────────────────────────
    const wrap = (o: { x: number; y: number }, m = 30) => {
      if (o.x < -m) o.x = W + m; else if (o.x > W + m) o.x = -m;
      if (o.y < -m) o.y = H + m; else if (o.y > H + m) o.y = -m;
    };
    const normAngle = (a: number) => {
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    };

    const makeAsteroid = (x: number, y: number, tier: number): Asteroid => {
      const r = tier * 15 + 8;
      const n = 9 + ((Math.random() * 4) | 0);
      const shape = Array.from({ length: n }, () => 0.72 + Math.random() * 0.42);
      const ang = Math.random() * Math.PI * 2;
      const spd = (4 - tier) * 0.28 + 0.25 + Math.random() * 0.3;
      return {
        x, y, tier, r, shape,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
      };
    };

    const spawnEdgeAsteroid = (): Asteroid => {
      const side = (Math.random() * 4) | 0;
      let x: number, y: number;
      if (side === 0) { x = Math.random() * W; y = -30; }
      else if (side === 1) { x = W + 30; y = Math.random() * H; }
      else if (side === 2) { x = Math.random() * W; y = H + 30; }
      else { x = -30; y = Math.random() * H; }
      return makeAsteroid(x, y, 3);
    };

    const initGame = () => {
      const ship: Ship = { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, thrust: false };
      const asteroids: Asteroid[] = [];
      // scale rock count to the viewport, scattered across the whole field
      const count = Math.max(8, Math.round((W * H) / 210000));
      for (let i = 0; i < count; i++) {
        let x: number, y: number;
        do { x = Math.random() * W; y = Math.random() * H; }
        while (Math.hypot(x - W / 2, y - H / 2) < 130); // keep clear of the ship
        asteroids.push(makeAsteroid(x, y, Math.random() < 0.7 ? 3 : 2));
      }
      game = { ship, asteroids, bullets: [], particles: [], fireCd: 0, minRocks: count - 2 };
    };

    const boom = (g: Game, x: number, y: number, n: number, spread: number) => {
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = Math.random() * spread + 0.5;
        g.particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1 });
      }
    };

    // ── one frame of the simulation + render ─────────────────
    const drawGame = () => {
      if (!game) initGame();
      const g = game!;
      const { ship, asteroids, bullets, particles } = g;
      ctx.clearRect(0, 0, W, H);

      // AI: nearest asteroid to shoot, closest surface to flee
      let target: Asteroid | null = null, tdist = Infinity;
      let danger: Asteroid | null = null, ddist = Infinity;
      for (const a of asteroids) {
        const d = Math.hypot(a.x - ship.x, a.y - ship.y);
        if (d < tdist) { tdist = d; target = a; }
        if (d - a.r < ddist) { ddist = d - a.r; danger = a; }
      }

      let desired = ship.a, wantThrust = false;
      if (danger && ddist < 110) {
        desired = Math.atan2(ship.y - danger.y, ship.x - danger.x); // flee
        wantThrust = true;
      } else if (target) {
        const lead = Math.min(tdist / 6, 26);
        const tx = target.x + target.vx * lead, ty = target.y + target.vy * lead;
        desired = Math.atan2(ty - ship.y, tx - ship.x); // lead & aim
        wantThrust = Math.random() < 0.02;
      }

      const diff = normAngle(desired - ship.a);
      const turn = 0.075;
      ship.a += Math.max(-turn, Math.min(turn, diff));
      ship.thrust = wantThrust;

      if (wantThrust) { ship.vx += Math.cos(ship.a) * 0.12; ship.vy += Math.sin(ship.a) * 0.12; }
      ship.vx *= 0.99; ship.vy *= 0.99;
      const sp = Math.hypot(ship.vx, ship.vy);
      const MAX = 3.4;
      if (sp > MAX) { ship.vx = ship.vx / sp * MAX; ship.vy = ship.vy / sp * MAX; }
      ship.x += ship.vx; ship.y += ship.vy; wrap(ship);

      // fire when aligned on an in-range target
      if (g.fireCd > 0) g.fireCd--;
      if (target && tdist < 460 && Math.abs(diff) < 0.16 && g.fireCd === 0) {
        bullets.push({
          x: ship.x + Math.cos(ship.a) * 14, y: ship.y + Math.sin(ship.a) * 14,
          vx: Math.cos(ship.a) * 7 + ship.vx, vy: Math.sin(ship.a) * 7 + ship.vy, life: 55,
        });
        g.fireCd = 13;
      }

      // bullets + collisions
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx; b.y += b.vy; wrap(b); b.life--;
        if (b.life <= 0) { bullets.splice(i, 1); continue; }
        for (let j = asteroids.length - 1; j >= 0; j--) {
          const a = asteroids[j];
          if (Math.hypot(a.x - b.x, a.y - b.y) < a.r) {
            bullets.splice(i, 1);
            boom(g, a.x, a.y, a.tier * 5 + 4, a.tier * 0.9 + 1);
            asteroids.splice(j, 1);
            if (a.tier > 1) {
              asteroids.push(makeAsteroid(a.x, a.y, a.tier - 1));
              asteroids.push(makeAsteroid(a.x, a.y, a.tier - 1));
            }
            break;
          }
        }
      }
      if (asteroids.length < g.minRocks) asteroids.push(spawnEdgeAsteroid());

      // asteroids
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = 'rgba(0,217,255,.55)';
      ctx.shadowColor = 'rgba(0,217,255,.6)';
      ctx.shadowBlur = 8;
      for (const a of asteroids) {
        a.x += a.vx; a.y += a.vy; a.rot += a.rotSpeed; wrap(a);
        ctx.beginPath();
        for (let k = 0; k < a.shape.length; k++) {
          const ang = a.rot + (k / a.shape.length) * Math.PI * 2;
          const rr = a.r * a.shape[k];
          const px = a.x + Math.cos(ang) * rr, py = a.y + Math.sin(ang) * rr;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.stroke();
      }

      // bullets
      ctx.fillStyle = 'rgba(150,245,255,.95)';
      for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 1.8, 0, Math.PI * 2); ctx.fill(); }

      // ship + thrust flame
      ctx.save();
      ctx.translate(ship.x, ship.y); ctx.rotate(ship.a);
      ctx.strokeStyle = 'rgba(125,244,255,.95)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(15, 0); ctx.lineTo(-11, -9); ctx.lineTo(-6, 0); ctx.lineTo(-11, 9);
      ctx.closePath(); ctx.stroke();
      if (ship.thrust && Math.random() < 0.7) {
        ctx.strokeStyle = 'rgba(255,190,90,.9)';
        ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-15 - Math.random() * 5, 0); ctx.lineTo(-6, 4); ctx.stroke();
      }
      ctx.restore();
      ctx.shadowBlur = 0;

      // debris
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96; p.life -= 0.025;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(0,217,255,${p.life})`;
        ctx.fillRect(p.x, p.y, 2, 2);
      }
    };

    // ── lifecycle ────────────────────────────────────────────
    const resize = () => {
      W = parent.clientWidth; H = parent.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      initGame();
      if (reduce) drawGame(); // static frame; no loop
    };

    const frame = () => { drawGame(); raf = requestAnimationFrame(frame); };

    resize();
    if (!reduce) raf = requestAnimationFrame(frame);

    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    const io = new IntersectionObserver(([entry]) => {
      const nowVisible = entry.isIntersecting;
      if (nowVisible && !visible && !reduce && raf === 0) raf = requestAnimationFrame(frame);
      if (!nowVisible && raf) { cancelAnimationFrame(raf); raf = 0; }
      visible = nowVisible;
    }, { threshold: 0 });
    io.observe(canvas);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: 'radial-gradient(135% 115% at 50% 45%, transparent 60%, rgba(26,26,26,.5) 100%)',
        }}
      />
    </>
  );
};
