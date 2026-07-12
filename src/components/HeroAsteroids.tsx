import React, { useEffect, useRef, useState } from 'react';

/**
 * Playable "Asteroids" behind the hero.
 *
 * Runs a self-playing AI attract-mode demo until a visitor presses Play, then
 * hands them the controls (← → / A D to turn, ↑ / W to thrust, Space to fire,
 * Esc to bail out). Score, lives, and a localStorage high score are tracked in
 * play mode; the demo is deathless and scoreless.
 *
 * Drop it as the FIRST child of a `position: relative; overflow: hidden`
 * container (`.hero`). It paints a wireframe canvas (z0) + readability veil (z1)
 * and a HUD (z3); keep hero content at z2 between them.
 *
 * Behaviour: respects `prefers-reduced-motion` (static frame while idle, but the
 * loop runs while you're actually playing), pauses off-screen, resizes with its
 * container, and cleans up on unmount. Arrow/Space keys are only intercepted
 * while playing, so ambient visitors scroll normally.
 *
 * Colours match globals.css (--primary-color #00D9FF, --bg-primary #1A1A1A).
 */

interface Ship { x: number; y: number; a: number; vx: number; vy: number; thrust: boolean; invuln: number; }
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

type Mode = 'ambient' | 'playing' | 'over';
const BEST_KEY = 'acosmibot_asteroids_best';
const SHIP_R = 11;
const SCORE_BY_TIER: Record<number, number> = { 3: 20, 2: 50, 1: 100 };

export const HeroAsteroids: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  const [mode, setMode] = useState<Mode>('ambient');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [best, setBest] = useState(0);

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

    // authoritative game vars (mirrored into React for the HUD)
    let modeV: Mode = 'ambient';
    let scoreV = 0;
    let livesV = 3;
    let bestV = 0;
    try { bestV = Number(localStorage.getItem(BEST_KEY)) || 0; } catch { /* ignore */ }
    setBest(bestV);

    const keys = { left: false, right: false, thrust: false, fire: false };

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
      const ship: Ship = { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, thrust: false, invuln: 0 };
      const asteroids: Asteroid[] = [];
      const count = Math.max(8, Math.round((W * H) / 210000));
      for (let i = 0; i < count; i++) {
        let x: number, y: number;
        do { x = Math.random() * W; y = Math.random() * H; }
        while (Math.hypot(x - W / 2, y - H / 2) < 130);
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

    const fire = (g: Game, ship: Ship) => {
      g.bullets.push({
        x: ship.x + Math.cos(ship.a) * 14, y: ship.y + Math.sin(ship.a) * 14,
        vx: Math.cos(ship.a) * 7 + ship.vx, vy: Math.sin(ship.a) * 7 + ship.vy, life: 55,
      });
      g.fireCd = 13;
    };

    // ── mode transitions ─────────────────────────────────────
    const startPlay = () => {
      initGame();
      const s = game!.ship;
      s.invuln = 120;
      scoreV = 0; setScore(0);
      livesV = 3; setLives(3);
      keys.left = keys.right = keys.thrust = keys.fire = false;
      modeV = 'playing'; setMode('playing');
      sync();
    };
    const stopPlay = () => {
      modeV = 'ambient'; setMode('ambient');
      initGame();
      sync();
    };
    const gameOver = () => {
      modeV = 'over'; setMode('over');
      if (scoreV > bestV) {
        bestV = scoreV; setBest(bestV);
        try { localStorage.setItem(BEST_KEY, String(bestV)); } catch { /* ignore */ }
      }
      sync();
    };
    apiRef.current = { start: startPlay, stop: stopPlay };

    // ── one frame ────────────────────────────────────────────
    const drawGame = () => {
      if (!game) initGame();
      const g = game!;
      const { ship, asteroids, bullets, particles } = g;
      ctx.clearRect(0, 0, W, H);
      const playing = modeV === 'playing';

      if (playing) {
        // ── player control ──
        if (keys.left) ship.a -= 0.062;
        if (keys.right) ship.a += 0.062;
        ship.thrust = keys.thrust;
        if (keys.thrust) { ship.vx += Math.cos(ship.a) * 0.12; ship.vy += Math.sin(ship.a) * 0.12; }
        if (g.fireCd > 0) g.fireCd--;
        if (keys.fire && g.fireCd === 0) fire(g, ship);
      } else if (modeV === 'ambient') {
        // ── AI attract-mode ──
        let target: Asteroid | null = null, tdist = Infinity;
        let danger: Asteroid | null = null, ddist = Infinity;
        for (const a of asteroids) {
          const d = Math.hypot(a.x - ship.x, a.y - ship.y);
          if (d < tdist) { tdist = d; target = a; }
          if (d - a.r < ddist) { ddist = d - a.r; danger = a; }
        }
        let desired = ship.a, wantThrust = false;
        if (danger && ddist < 110) {
          desired = Math.atan2(ship.y - danger.y, ship.x - danger.x);
          wantThrust = true;
        } else if (target) {
          const lead = Math.min(tdist / 6, 26);
          desired = Math.atan2(target.y + target.vy * lead - ship.y, target.x + target.vx * lead - ship.x);
          wantThrust = Math.random() < 0.02;
        }
        const diff = normAngle(desired - ship.a);
        ship.a += Math.max(-0.075, Math.min(0.075, diff));
        ship.thrust = wantThrust;
        if (wantThrust) { ship.vx += Math.cos(ship.a) * 0.12; ship.vy += Math.sin(ship.a) * 0.12; }
        if (g.fireCd > 0) g.fireCd--;
        if (target && tdist < 460 && Math.abs(diff) < 0.16 && g.fireCd === 0) fire(g, ship);
      } else {
        ship.thrust = false; // 'over' → ship coasts
      }

      // ship physics (all modes)
      ship.vx *= 0.99; ship.vy *= 0.99;
      const sp = Math.hypot(ship.vx, ship.vy);
      if (sp > 3.4) { ship.vx = ship.vx / sp * 3.4; ship.vy = ship.vy / sp * 3.4; }
      ship.x += ship.vx; ship.y += ship.vy; wrap(ship);
      if (ship.invuln > 0) ship.invuln--;

      // bullets + asteroid collisions
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
            if (playing) { scoreV += SCORE_BY_TIER[a.tier] ?? 100; setScore(scoreV); }
            if (a.tier > 1) {
              asteroids.push(makeAsteroid(a.x, a.y, a.tier - 1));
              asteroids.push(makeAsteroid(a.x, a.y, a.tier - 1));
            }
            break;
          }
        }
      }
      if (asteroids.length < g.minRocks) asteroids.push(spawnEdgeAsteroid());

      // ship vs asteroid (player only, unless invulnerable)
      if (playing && ship.invuln <= 0) {
        for (const a of asteroids) {
          if (Math.hypot(a.x - ship.x, a.y - ship.y) < a.r + SHIP_R) {
            boom(g, ship.x, ship.y, 22, 3.2);
            livesV -= 1; setLives(Math.max(0, livesV));
            if (livesV <= 0) { gameOver(); }
            else { ship.x = W / 2; ship.y = H / 2; ship.vx = 0; ship.vy = 0; ship.a = -Math.PI / 2; ship.invuln = 120; }
            break;
          }
        }
      }

      // ── render: asteroids ──
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

      // ship (hidden on game over; blinks while invulnerable)
      const blink = ship.invuln > 0 && (ship.invuln >> 2) % 2 === 0;
      if (modeV !== 'over' && !blink) {
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
      }
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

    // ── loop / lifecycle ─────────────────────────────────────
    const shouldAnimate = () => visible && (!reduce || modeV !== 'ambient');
    const frame = () => { drawGame(); raf = requestAnimationFrame(frame); };
    function sync() {
      if (shouldAnimate()) { if (raf === 0) raf = requestAnimationFrame(frame); }
      else { if (raf) { cancelAnimationFrame(raf); raf = 0; } if (reduce) drawGame(); }
    }

    const resize = () => {
      W = parent.clientWidth; H = parent.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (modeV === 'ambient') initGame();
      sync();
    };

    // ── input (only intercepts keys while playing) ───────────
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (modeV !== 'playing') return;
      const t = e.target;
      if (t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      let handled = true;
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': keys.left = down; break;
        case 'ArrowRight': case 'KeyD': keys.right = down; break;
        case 'ArrowUp': case 'KeyW': keys.thrust = down; break;
        case 'Space': keys.fire = down; break;
        case 'Escape': if (down) stopPlay(); break;
        default: handled = false;
      }
      if (handled) e.preventDefault();
    };
    const onKeyDown = (e: KeyboardEvent) => onKey(e, true);
    const onKeyUp = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }, { threshold: 0 });
    io.observe(canvas);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      apiRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pad = (n: number) => n.toString().padStart(6, '0');

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

      {/* HUD — container ignores pointer events; controls opt back in */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
        {/* Scoreboard (play + game-over) */}
        {mode !== 'ambient' && (
          <div style={hudRow}>
            <span style={hudStat}><span style={hudLabel}>Score</span> {pad(score)}</span>
            <span style={hudStat}><span style={hudLabel}>Best</span> {pad(best)}</span>
            <span style={hudStat}>
              <span style={hudLabel}>Ships</span>
              <span style={{ color: '#7df4ff', letterSpacing: 2 }}>{'▲'.repeat(Math.max(0, lives)) || '—'}</span>
            </span>
          </div>
        )}

        {/* Ambient → invite to play */}
        {mode === 'ambient' && (
          <button style={{ ...pillBtn, position: 'absolute', right: 20, bottom: 24 }} onClick={() => apiRef.current?.start()}>
            ▶ Play Asteroids
          </button>
        )}

        {/* Playing → controls hint + exit */}
        {mode === 'playing' && (
          <>
            <div style={{ ...hintText, position: 'absolute', left: 0, right: 0, bottom: 22 }}>
              ← → turn · ↑ thrust · Space fire · Esc exit
            </div>
            <button style={{ ...ghostBtn, position: 'absolute', right: 20, bottom: 20 }} onClick={() => apiRef.current?.stop()}>
              Esc · Exit
            </button>
          </>
        )}

        {/* Game over card */}
        {mode === 'over' && (
          <div style={overWrap}>
            <div style={overCard}>
              <div style={{ fontSize: 12, letterSpacing: 3, color: '#808080', textTransform: 'uppercase' }}>Game Over</div>
              <div style={{ fontSize: 44, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{pad(score)}</div>
              <div style={{ fontSize: 13, color: score >= best && score > 0 ? '#00D9FF' : '#B0B0B0' }}>
                {score >= best && score > 0 ? 'New best!' : `Best ${pad(best)}`}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button style={pillBtn} onClick={() => apiRef.current?.start()}>Play again</button>
                <button style={ghostBtn} onClick={() => apiRef.current?.stop()}>Back to demo</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ── HUD styles ─────────────────────────────────────────────
const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const hudRow: React.CSSProperties = {
  position: 'absolute', top: 18, left: 20, right: 20,
  display: 'flex', gap: 22, flexWrap: 'wrap',
  fontFamily: mono, fontSize: 14, fontWeight: 700, color: '#fff',
  fontVariantNumeric: 'tabular-nums', textShadow: '0 0 12px rgba(0,217,255,.35)',
};
const hudStat: React.CSSProperties = { display: 'inline-flex', alignItems: 'baseline', gap: 7 };
const hudLabel: React.CSSProperties = {
  fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#808080', fontWeight: 600,
};
const pillBtn: React.CSSProperties = {
  pointerEvents: 'auto', fontFamily: "'Poppins', sans-serif", fontSize: 14, fontWeight: 700,
  color: '#06262e', background: 'linear-gradient(135deg,#00D9FF,#00A0CC)', border: 'none',
  padding: '11px 20px', borderRadius: 999, cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,217,255,.35)',
};
const ghostBtn: React.CSSProperties = {
  pointerEvents: 'auto', fontFamily: "'Poppins', sans-serif", fontSize: 13, fontWeight: 600,
  color: '#B0B0B0', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(0,217,255,.22)',
  padding: '10px 18px', borderRadius: 999, cursor: 'pointer',
};
const hintText: React.CSSProperties = {
  textAlign: 'center', fontFamily: mono, fontSize: 12, letterSpacing: 1, color: '#808080',
};
const overWrap: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const overCard: React.CSSProperties = {
  pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
  background: 'rgba(20,20,20,.82)', border: '1px solid rgba(0,217,255,.25)', backdropFilter: 'blur(14px)',
  borderRadius: 20, padding: '28px 40px', boxShadow: '0 20px 60px rgba(0,0,0,.55)',
};
