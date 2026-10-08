// Presentation only: Darkn1de's staging is a pure function of the run, so it
// never touches simulation RNG, input, or scoring, and it scrubs and replays
// identically for players, spectators, and the timeline preview.
export const SIGHTINGS = [30, 82, 127, 172, 217];
export const SIGHT_SECONDS = [3.2, 2.6, 3.6, 3.6, 4.2];
export const ARRIVAL = 240, BREACH = 285, LEAD_IN = 1.5, EMERGE_SECONDS = 3.6, IGNITE = 1.35, DEFEAT_SECONDS = 3.2;
// Eye and hand anchors are measured from the artwork, in image UV space.
export const POSES = {
  arrival: { eyes: [[.361, .299], [.498, .281]], pivot: [.43, .29] },
  inversion: { eyes: [[.412, .273], [.547, .281]], pivot: [.48, .27], hand: [.19, .23] },
  apparition: { eyes: [[.405, .466], [.59, .452]], pivot: [.5, .45] },
  emerge: { eyes: [[.437, .453], [.579, .439]], pivot: [.5, .42] },
  lunge: { eyes: [[.426, .376], [.576, .352]], pivot: [.5, .35] },
  recoil: { eyes: [[.582, .188], [.686, .232]], pivot: [.63, .22] },
};
export const POSE_NAMES = Object.keys(POSES);
// The gripping hands are cut from the emergence pose: [u0, v0, u1, v1].
export const HAND_RECTS = [[0, .5, .36, 1], [.64, .5, 1, 1]];
const WARNING = { claw: .9, spear: 1.3 };

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const easeOut = x => 1 - (1 - clamp(x)) ** 3;
const pulse = (time, at, decay) => time < at ? 0 : Math.exp(-(time - at) * decay);
const envelope = (p, rise = .2, fall = .75) => Math.min(smooth(0, rise, p), 1 - smooth(fall, 1, p));
const layer = (pose, o) => ({ pose, x: 0, y: 0, h: .7, sx: 1, sy: 1, rotation: 0, alpha: 1, silhouette: 0, eye: 1, sway: 1, glitch: 0, crack: 0, dissolve: 0, hit: 0, ...o });

// The accretion disk stalls before he arrives, runs backwards while he holds the
// thrusters, and recovers at Breachstorm. Returns seconds to subtract from hole time.
export function holeTimeOffset(time) {
  const a = clamp((time - (ARRIVAL - LEAD_IN)) / LEAD_IN), b = clamp((time - ARRIVAL) / 1.5);
  const c = clamp(time - ARRIVAL - 1.5, 0, BREACH - 1 - ARRIVAL - 1.5), d = clamp((time - (BREACH - 1)) / 1.5);
  return LEAD_IN * a * a / 2 + 1.5 * (b + b * b / 2) + 2 * c + 1.5 * (2 * d - d * d);
}

// Shard hits are the only staging that needs history: remember when resonance last rose.
export function createDarkMemory() { return { resonance: 0, hitAt: -10, time: 0 }; }
export function trackDark(memory, run) {
  const resonance = run.resonance || 0;
  // A seek, resize, or new run is not a hit: only count a rise between consecutive frames.
  const continuous = run.time >= memory.time && run.time - memory.time < .5;
  if (!continuous || run.darkStage !== 2) memory.hitAt = -10;
  else if (resonance > memory.resonance) memory.hitAt = run.time;
  memory.resonance = resonance; memory.time = run.time; return memory;
}

// Rare between-beat intrusions, chosen by a hash of the clock (never the sim RNG).
function microEvent(time) {
  if (time < 44 || time > ARRIVAL - 8) return null;
  const bucket = Math.floor(time / 12), start = bucket * 12 + 2 + hash(bucket) * 7;
  const kind = ['glance', 'flicker', 'glitch'][Math.floor(hash(bucket + 91) * 3)];
  const duration = kind === 'glance' ? .7 : kind === 'flicker' ? .5 : .22;
  if (time < start || time >= start + duration) return null;
  if (SIGHTINGS.some((s, i) => start > s - 6 && start < s + SIGHT_SECONDS[i] + 6)) return null;
  return { kind, p: (time - start) / duration };
}

export function darkn1deView(run, reduced = false, memory = null) {
  const time = run.time, stage = run.darkStage || 0;
  const view = {
    stage: 'idle', sight: -1, sightP: 0, opacity: 0, micro: null, active: stage === 1 || stage === 2, defeating: false,
    layers: [], hands: [], voidEyes: null, fissure: null, outflow: 0, aura: 0, embers: 0, rim: 0, tether: 0,
    title: null, captionGlitch: false, bolt: -1, emp: null, attackGlow: 0,
    holeTime: reduced ? 0 : holeTimeOffset(time), holeDim: 0, starDim: 0,
    fx: { shake: 0, flash: 0, flashColor: [1, .16, .22], chroma: 0, zoom: 0, saturation: 1, gain: [1, 1, 1], waves: [] },
  };
  const fx = view.fx, wave = (age, strength) => { if (age >= 0 && age < 1.4) fx.waves.push({ age, strength: strength * (1 - age / 1.4) }); };
  const bob = Math.sin(time * 1.3) * .012;

  if (stage === 0) {
    const dread = smooth(20, ARRIVAL, time);
    view.rim = dread * .1 * (.6 + .4 * Math.sin(time * .9));
    const sight = SIGHTINGS.findIndex((t, i) => time >= t && time < t + SIGHT_SECONDS[i]);
    if (sight >= 0) {
      const p = (time - SIGHTINGS[sight]) / SIGHT_SECONDS[sight], env = envelope(p);
      Object.assign(view, { stage: 'omen', sight, sightP: p, opacity: env });
      if (sight === 0) {
        // Eyes open in the dark, find the rocket, blink once, and close.
        const blink = Math.exp(-(((p - .56) / .035) ** 2));
        view.voidEyes = { alpha: .9 * env, open: smooth(0, .16, p) * (1 - blink) * (1 - smooth(.86, 1, p)), y: -.04 - .035 * smooth(.2, .45, p), scale: 1 };
      } else if (sight === 1) {
        view.fissure = { count: 1, progress: smooth(0, .3, p), alpha: env, seed: 3 };
        view.outflow = .3 * env; view.rim += .12 * env;
      } else if (sight === 2) {
        // The hood rises as an absence of light, then the eyes ignite for a moment.
        const rise = smooth(0, .4, p) - smooth(.72, 1, p), ignite = smooth(.5, .56, p) * (1 - smooth(.66, .74, p));
        view.layers.push(layer('apparition', { h: .66, y: lerp(.2, -.1, rise), alpha: envelope(p, .14, .84), silhouette: 1, eye: ignite * (.8 + .2 * Math.sin(time * 47)), sway: .6 }));
      } else if (sight === 3) {
        view.outflow = env; view.rim += .3 * env; fx.gain = [1 + .1 * env, 1 - .05 * env, 1 - .07 * env];
      } else {
        // Metal hands press against the horizon from the inside, eyes behind them.
        const land = smooth(.1, .3, p) - smooth(.8, 1, p);
        for (const side of [0, 1]) view.hands.push({ side, x: (side ? .17 : -.17), y: lerp(.5, .1, land), h: .66, alpha: envelope(p, .12, .86), silhouette: .5, rotation: (side ? -1 : 1) * .12 * (1 - land) });
        view.voidEyes = { alpha: .6 * smooth(.28, .45, p) * (1 - smooth(.72, .86, p)), open: .75, y: -.17, scale: .85 };
        wave(time - SIGHTINGS[4] - SIGHT_SECONDS[4] * .28, .55); view.rim += .16 * env;
      }
    } else {
      view.micro = reduced ? null : microEvent(time);
      if (view.micro) {
        const { kind, p } = view.micro, env = envelope(p, .25, .6);
        view.stage = 'omen';
        if (kind === 'glance') view.voidEyes = { alpha: .5 * env, open: .7 * env, y: -.05, scale: .8 };
        else if (kind === 'flicker') { view.starDim = .55 * env; view.rim += .14 * env; }
        else { view.captionGlitch = true; fx.chroma = .5; }
      }
    }
    const lead = clamp((time - (ARRIVAL - LEAD_IN)) / LEAD_IN);
    if (lead > 0) {
      view.stage = 'leadin';
      view.fissure = { count: 5, progress: lead, alpha: 1, seed: 11 };
      view.voidEyes = { alpha: lead, open: .55 + .45 * lead, y: -.17, scale: 1 + .25 * lead };
      view.holeDim = .45 * lead; view.starDim = .6 * lead; view.rim += .3 * lead;
      fx.saturation = 1 - .6 * lead; fx.shake = .3 * lead * lead;
    }
  } else if (stage === 1) {
    const e = time - ARRIVAL, ending = smooth(BREACH - .7, BREACH, time);
    view.aura = .65 * smooth(.2, 1.6, e); view.embers = smooth(1.2, 2.2, e); view.rim = .35;
    if (e < EMERGE_SECONDS) {
      view.stage = 'emerge';
      const slam = Math.exp(-e * 5), ignite = pulse(e, IGNITE, 5), swap = smooth(2.7, 3.2, e);
      fx.flash = Math.max(slam * .6, pulse(e, IGNITE, 6) * .45); fx.chroma = slam * 1.4 + ignite * .9 + Math.sin(swap * Math.PI) * .7;
      fx.shake = Math.max(slam * .9, .32 * (1 - smooth(1.1, 1.6, e)), ignite * .6); fx.zoom = .03 * ignite;
      fx.saturation = lerp(.4, 1, smooth(IGNITE, 1.9, e));
      view.holeDim = .45 * (1 - smooth(IGNITE, 2.1, e)); view.starDim = .6 * (1 - smooth(IGNITE, 2.4, e));
      wave(e, 1.6); wave(e - .55, .8); wave(e - IGNITE, 1.2);
      view.fissure = { count: 7, progress: 1, alpha: 1 - smooth(.3, 1.3, e), seed: 11 };
      // He hauls himself out as a silhouette, then his lights ignite.
      const rise = easeOut(e / 1.3), lit = smooth(IGNITE, IGNITE + .22, e);
      if (e < 3.2) view.layers.push(layer('emerge', {
        h: lerp(.3, 1.02, rise) * (1 + .012 * Math.sin(time * 2.4)) * lerp(1, .82, swap), y: lerp(.14, -.05, rise), alpha: 1 - smooth(2.85, 3.2, e),
        silhouette: 1 - lit, eye: lit < 1 ? 1.25 + .35 * Math.sin(time * 39) + ignite * 1.6 : 1 + ignite * 1.6,
        dissolve: 1 - smooth(0, .5, e), glitch: Math.sin(swap * Math.PI) * .9, sway: 1.3,
      }));
      if (e > 2.75) view.layers.push(layer('inversion', { h: lerp(.95, .68, smooth(2.75, EMERGE_SECONDS, e)), y: -.02, alpha: smooth(2.75, 3.1, e), glitch: 1 - smooth(2.9, 3.5, e) }));
      view.title = { text: 'DARKN1DE', alpha: smooth(IGNITE, IGNITE + .12, e) * (1 - smooth(3.0, 3.5, e)), glitch: Math.max(ignite, pulse(e, 2.3, 9) * .6), scale: 1 + .25 * pulse(e, IGNITE, 9) };
      view.tether = smooth(3.2, EMERGE_SECONDS, e);
    } else {
      view.stage = 'inversion';
      const blip = hash(Math.floor(time * 9)) > .965 ? .55 : 0;
      view.layers.push(layer('inversion', { h: .68, y: -.02 + bob, glitch: Math.max(blip, ending), eye: 1 + .12 * Math.sin(time * 5.1) }));
      view.tether = 1 - ending; fx.chroma = ending * .6;
    }
  } else if (stage === 2) {
    view.stage = 'breach'; view.embers = 1; view.rim = .3;
    const b = time - BREACH, rage = clamp((run.resonance || 0) / 10), enter = 1 - smooth(0, .5, b);
    // Wind up while an attack is telegraphed, then snap through as it fires.
    let lunge = 0, strike = 0;
    for (const o of run.attacks ?? []) {
      const fired = o.age - WARNING[o.type];
      lunge = Math.max(lunge, o.warning > 0 ? smooth(.65, .12, o.warning) : Math.exp(-fired * 4));
      if (o.warning <= 0) strike = Math.max(strike, Math.exp(-fired * 7));
    }
    const hitAge = memory ? time - memory.hitAt : 99, hit = hitAge >= 0 && hitAge < .5 ? Math.exp(-hitAge * 6) : 0;
    const blip = hash(Math.floor(time * 11)) > .975 - rage * .09 ? .5 : 0, jitter = reduced ? 0 : rage * .007;
    const shared = { crack: rage * .85, glitch: Math.max(blip, enter), x: Math.sin(time * 53) * jitter, eye: 1 + .15 * Math.sin(time * (5 + rage * 14)) + strike };
    if (hit > .05) {
      view.layers.push(layer('recoil', { ...shared, h: .74 * (1 + .1 * hit), y: -.02 - .04 * hit, rotation: -.14 * hit, hit, glitch: Math.max(shared.glitch, hit * .6) }));
      fx.chroma = hit * .5; fx.shake = hit * .25; view.bolt = hitAge / .3;
    } else {
      const reach = smooth(.25, .5, lunge);
      if (reach < 1) view.layers.push(layer('arrival', { ...shared, h: .7, y: -.02 + bob, alpha: 1 - reach }));
      if (reach > 0) view.layers.push(layer('lunge', { ...shared, h: .72 * (1 + .14 * lunge + .08 * strike), x: shared.x + .02 * lunge, y: -.01 + bob, alpha: reach, sway: 1.5 }));
    }
    if (enter > 0) fx.chroma = Math.max(fx.chroma, enter * .5);
    view.aura = .6 + .3 * rage + .25 * lunge; view.attackGlow = lunge; fx.shake = Math.max(fx.shake, strike * .14);
  } else if (stage === 3) {
    const a = time - (run.darkDefeatedAt || 0);
    if (a < DEFEAT_SECONDS) {
      view.stage = 'defeat'; view.defeating = true;
      fx.flash = Math.exp(-a * 6) * .65; fx.flashColor = [.5, 1, .95]; fx.chroma = Math.exp(-a * 4) * 1.3;
      fx.shake = Math.max(Math.exp(-a * 3) * .8, .3 * smooth(.9, 1.2, a) * (1 - smooth(2.2, 2.8, a))); fx.zoom = .035 * Math.exp(-a * 8);
      wave(a, 1.8); wave(a - .9, .9);
      if (a < 1.6) view.emp = { radius: a * 1.25, alpha: 1 - a / 1.6 };
      view.aura = .7 * (1 - smooth(1.2, 2.4, a)); view.embers = 1 - smooth(1, 2.2, a); view.rim = .4 * (1 - smooth(2, 3, a));
      const drag = clamp((a - .9) / 1.7);
      // The pulse staggers him; then the hole takes him back, clawing at the rim.
      if (a < 1.05) view.layers.push(layer('recoil', { h: .74 * (1 + .12 * Math.exp(-a * 8)), y: -.03 - .05 * Math.exp(-a * 5), rotation: -.16 * smooth(0, .3, a), alpha: 1 - smooth(.9, 1.05, a), hit: Math.exp(-a * 2.5), crack: 1, glitch: .35 + .5 * Math.exp(-a * 4) }));
      if (a > .9 && drag < 1) view.layers.push(layer('emerge', {
        h: lerp(.82, .3, drag * drag), x: Math.sin(time * 41) * .012 * (1 - drag), y: lerp(-.02, .13, drag), sx: lerp(1, .55, drag * drag), sy: lerp(1, 1.5, drag * drag),
        alpha: smooth(.9, 1.05, a) * (1 - smooth(.86, 1, drag)), silhouette: smooth(.25, .9, drag), crack: 1 - drag, dissolve: smooth(.5, 1, drag) * .9, glitch: .3, sway: 2,
      }));
      // His eyes are the last thing to go out.
      view.voidEyes = { alpha: smooth(2.2, 2.5, a) * (1 - smooth(3, DEFEAT_SECONDS, a)), open: 1 - smooth(2.6, 3.15, a), y: lerp(-.05, .02, smooth(2.2, DEFEAT_SECONDS, a)), scale: lerp(.9, .5, smooth(2.2, DEFEAT_SECONDS, a)) };
    } else if (a >= 20 && a < 21.4) {
      // Sealed, not gone.
      const p = (a - 20) / 1.4;
      view.voidEyes = { alpha: .45 * envelope(p), open: 1 - Math.exp(-(((p - .5) / .06) ** 2)), y: -.04, scale: .8 };
    }
  }
  if (reduced) {
    Object.assign(fx, { shake: 0, chroma: 0, zoom: 0, flash: fx.flash * .3, waves: [] });
    for (const item of view.layers) Object.assign(item, { glitch: 0, sway: 0, rotation: 0, x: 0 });
    if (view.title) view.title.glitch = 0;
    view.captionGlitch = false;
  }
  return view;
}

export function bossCaption(run) {
  if (run.darkStage === 1) return ['DARKN1DE', 'RELEASE TO CLIMB'];
  if (run.darkStage === 2) return ['BREACHSTORM', run.resonance >= 10 ? 'RESONANCE PULSE · SHIFT' : `RESONANCE ${run.resonance}/10`];
  return ['', ''];
}

// Sound and haptic cues, derived by comparing consecutive frames of a run so
// players and spectators hear the same thing. Seeking or a new run stays silent.
export function createDarkCues() {
  let time = 0, stage = 0;
  const seen = new Map();
  return run => {
    const cues = [], from = time, to = run.time, previous = stage;
    time = to; stage = run.darkStage || 0;
    if (to < from || to - from > 1) { seen.clear(); return cues; }
    if (stage === 0) {
      SIGHTINGS.forEach((at, i) => { if (from < at && to >= at) cues.push(['omen', i]); });
      if (from < ARRIVAL - LEAD_IN && to >= ARRIVAL - LEAD_IN) cues.push(['lead']);
    }
    if (stage !== previous) cues.push([['', 'arrival', 'breach', 'defeat'][stage]]);
    if (stage === 1 && from < ARRIVAL + IGNITE && to >= ARRIVAL + IGNITE) cues.push(['ignite']);
    for (const o of run.attacks ?? []) {
      let entry = seen.get(o.id);
      if (!entry) { entry = { fired: false }; seen.set(o.id, entry); cues.push([`${o.type}-warn`]); }
      if (!entry.fired && o.warning <= 0) { entry.fired = true; cues.push([`${o.type}-fire`]); }
    }
    for (const id of seen.keys()) if (!run.attacks?.some(o => o.id === id)) seen.delete(id);
    return cues;
  };
}

// Canvas fallback (no WebGL): the same staging, drawn with plain strokes.
function fallbackShapes(run, view) {
  const shapes = [], line = (points, color, alpha, width) => shapes.push({ points, color, alpha, width });
  const red = 0xff546a, cyan = 0x8afff5;
  if (view.voidEyes) for (const side of [-1, 1]) line([side * .035 - .02, view.voidEyes.y - side * .006, side * .035 + .02, view.voidEyes.y + side * .006], red, view.voidEyes.alpha * view.voidEyes.open, .008);
  if (view.fissure) for (let i = 0; i < view.fissure.count; i++) {
    const a = i * 2.4 + view.fissure.seed, reach = .3 * view.fissure.progress;
    line([0, 0, Math.cos(a) * reach * .5 + .02, Math.sin(a) * reach * .5, Math.cos(a) * reach, Math.sin(a) * reach], red, view.fissure.alpha * .7, .004);
  }
  for (const o of run.attacks ?? []) {
    const warn = o.warning > 0;
    if (o.type === 'spear') {
      if (warn) line([-1.15, o.y, 1.15, o.y], red, .22, .003);
      else { const points = [o.x - Math.sign(o.vx) * .13, o.y, o.x, o.y]; line(points, red, .18, .06); line(points, red, .95, .014); line(points, 0xffd8df, .95, .004); }
    } else {
      const x = Math.sin(o.angle) * o.radius, y = -Math.cos(o.angle) * o.radius;
      const points = [x - .010, y - .036, x + .009, y - .014, x - .008, y + .008, x + .004, y + .034];
      if (!warn) line(points, red, .16, .026);
      line(points, red, warn ? .32 : .9, warn ? .004 : .009);
      if (warn) line([Math.sin(.16) * o.radius, -Math.cos(.16) * o.radius, 0, -o.radius], red, .18, .004);
    }
  }
  if (view.emp) shapes.push({ circle: view.emp.radius, color: cyan, alpha: view.emp.alpha * .7, width: .012 });
  return shapes;
}
export function drawDarkn1de(ctx, g, run, images, reduced, memory = null) {
  const view = darkn1deView(run, reduced, memory);
  ctx.save(); ctx.translate(g.cx, g.cy);
  for (const item of view.layers) {
    const image = images[item.pose];
    if (!image?.complete || !image.naturalWidth || item.alpha <= 0) continue;
    const h = g.r * item.h * item.sy, w = g.r * item.h * item.sx * image.naturalWidth / image.naturalHeight;
    ctx.save(); ctx.translate(item.x * g.r, item.y * g.r); ctx.rotate(item.rotation);
    ctx.globalAlpha = item.alpha * (1 - item.dissolve); ctx.filter = item.silhouette > .05 ? `brightness(${1 - item.silhouette * .9})` : 'none';
    ctx.drawImage(image, -w / 2, -h / 2, w, h); ctx.restore();
  }
  for (const shape of fallbackShapes(run, view)) {
    ctx.beginPath(); ctx.globalAlpha = clamp(shape.alpha); ctx.strokeStyle = '#' + shape.color.toString(16).padStart(6, '0'); ctx.lineWidth = Math.max(.7, shape.width * g.r);
    if (shape.circle !== undefined) ctx.arc(0, 0, shape.circle * g.r, 0, Math.PI * 2);
    else for (let i = 0; i < shape.points.length; i += 2) { if (i) ctx.lineTo(shape.points[i] * g.r, shape.points[i + 1] * g.r); else ctx.moveTo(shape.points[i] * g.r, shape.points[i + 1] * g.r); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.fillStyle = '#dceff5'; ctx.font = `700 ${Math.max(10, g.r * .034)}px system-ui`;
  bossCaption(run).forEach((text, i) => ctx.fillText(text, 0, g.r * (.32 + i * .05), g.r * .85));
  ctx.restore();
}
