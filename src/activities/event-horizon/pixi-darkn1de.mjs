// Darkn1de's GPU staging. Each pose is one textured quad whose shader fakes the
// animation the stills lack: cloth sway, a black silhouette with live eyes,
// glitch tears, resonance cracks, and a noise dissolve. Uniforms only per frame.
import { Container, Geometry, Graphics, ImageSource, Mesh, Shader, Sprite, Texture } from 'pixi.js';
import { HAND_RECTS, POSES, POSE_NAMES, bossCaption } from './darkn1de-fx.mjs';

const TAU = Math.PI * 2, RED = 0xff3b52, HOT = 0xffd8df, CYAN = 0x8afff5;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const SHADOW = .354;

const vertex = `
precision highp float;
attribute vec2 aPosition;attribute vec2 aUV;
uniform mat3 uProjectionMatrix;uniform mat3 uWorldTransformMatrix;uniform mat3 uTransformMatrix;
varying vec2 vUV;
void main(){vUV=aUV;vec3 p=uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix*vec3(aPosition,1.);gl_Position=vec4(p.xy,0.,1.);}
`;
const fragment = `
precision highp float;
varying vec2 vUV;
uniform sampler2D uTexture;
uniform float uTime;uniform float uAlpha;uniform float uSway;uniform float uSilhouette;uniform float uEye;
uniform float uGlitch;uniform float uCrack;uniform float uDissolve;uniform float uHit;uniform float uFeather;
uniform vec2 uPivot;uniform vec4 uRect;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float cells(vec2 p){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));
    float d=length(g+vec2(hash(i+g),hash(i+g+17.3))-f);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}
  return d2-d1;}
vec4 sampleArt(vec2 uv){
  float inside=step(uRect.x,uv.x)*step(uv.x,uRect.z)*step(uRect.y,uv.y)*step(uv.y,uRect.w);
  return texture2D(uTexture,clamp(uv,0.,1.))*inside;}
void main(){
  vec2 uv=vUV;
  // Glitch: a few horizontal bands tear sideways, with a red/blue split.
  float band=floor(uv.y*20.+uTime*11.);
  float tear=step(.7,hash(vec2(band*1.7,floor(uTime*19.))))*(hash(vec2(band,floor(uTime*27.)))-.5);
  uv.x+=tear*uGlitch*.2;
  // Cloth sway grows with distance from the head, so the face holds still.
  float loose=smoothstep(.1,.62,distance(uv,uPivot));
  uv+=uSway*loose*.011*vec2(sin(uv.y*9.+uTime*2.3)+.5*sin(uv.y*21.-uTime*3.7),.6*sin(uv.x*8.+uTime*1.9));
  vec4 c=sampleArt(uv);
  if(uGlitch>.01){float s=uGlitch*.018;c.r=sampleArt(uv+vec2(s,0.)).r;c.b=sampleArt(uv-vec2(s,0.)).b;}
  float a=c.a;
  vec3 col=a>.001?c.rgb/a:vec3(0.);
  // Emissive mask: the eyes, sigil, and rim light are the only strongly red pixels.
  float lit=clamp((col.r-max(col.g,col.b)*1.5)*2.4,0.,1.)*smoothstep(.4,.85,col.r);
  vec3 outc=col*(1.-lit)*(1.-uSilhouette)+col*lit*uEye;
  if(uCrack>.001){
    float seam=1.-smoothstep(0.,.07,cells(uv*6.5));
    float shown=smoothstep(0.,.14,uCrack*1.25-vnoise(uv*2.6+3.1));
    outc+=vec3(.45,1.,.95)*seam*shown*(1.4+.5*sin(uTime*9.+uv.y*30.));
  }
  outc=mix(outc,vec3(.75,1.,.98),uHit*.8);
  if(uDissolve>.001){
    float n=vnoise(uv*9.+1.7)*.7+vnoise(uv*23.)*.3,edge=uDissolve*1.15;
    float keep=smoothstep(edge-.06,edge,n);
    outc+=vec3(1.,.2,.25)*keep*(1.-smoothstep(edge,edge+.12,n))*2.;
    a*=keep;
  }
  if(uFeather>0.){
    vec2 lo=smoothstep(uRect.xy,uRect.xy+uFeather,vUV),hi=1.-smoothstep(uRect.zw-uFeather,uRect.zw,vUV);
    a*=mix(1.,lo.x,step(.001,uRect.x))*mix(1.,hi.x,step(uRect.z,.999))*mix(1.,lo.y,step(.001,uRect.y));
  }
  a*=uAlpha;
  gl_FragColor=vec4(outc*a,a);
}`;

function poseLayer(texture, pose, rect = [0, 0, 1, 1], feather = 0) {
  const [u0, v0, u1, v1] = rect;
  const geometry = new Geometry({ attributes: {
    aPosition: { buffer: new Float32Array([-.5, -.5, .5, -.5, .5, .5, -.5, .5]), format: 'float32x2' },
    aUV: { buffer: new Float32Array([u0, v0, u1, v0, u1, v1, u0, v1]), format: 'float32x2' },
  }, indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]) });
  const shader = Shader.from({ gl: { vertex, fragment }, resources: { uTexture: texture.source, boss: {
    uTime: { value: 0, type: 'f32' }, uAlpha: { value: 1, type: 'f32' }, uSway: { value: 0, type: 'f32' },
    uSilhouette: { value: 0, type: 'f32' }, uEye: { value: 1, type: 'f32' }, uGlitch: { value: 0, type: 'f32' },
    uCrack: { value: 0, type: 'f32' }, uDissolve: { value: 0, type: 'f32' }, uHit: { value: 0, type: 'f32' },
    uFeather: { value: feather, type: 'f32' }, uPivot: { value: new Float32Array(pose.pivot), type: 'vec2<f32>' },
    uRect: { value: new Float32Array(rect), type: 'vec4<f32>' },
  } } });
  const mesh = new Mesh({ geometry, shader }); mesh.visible = false;
  const aspect = texture.source.pixelWidth / texture.source.pixelHeight;
  return { mesh, aspect, rect, pose, u: shader.resources.boss.uniforms, destroy() { mesh.destroy(); geometry.destroy(); shader.destroy(); } };
}

function drawEye(ctx, w, h) {
  // One slanted, flat-bottomed eye; the other is mirrored.
  ctx.translate(w / 2, h / 2); ctx.rotate(-.3);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, w * .48);
  glow.addColorStop(0, 'rgba(255,60,70,.55)'); glow.addColorStop(1, 'rgba(255,40,60,0)');
  ctx.fillStyle = glow; ctx.fillRect(-w, -h, w * 2, h * 2);
  const shape = () => { ctx.beginPath(); ctx.moveTo(-w * .36, h * .04); ctx.quadraticCurveTo(0, -h * .42, w * .38, -h * .02); ctx.quadraticCurveTo(0, h * .16, -w * .36, h * .04); };
  const fill = ctx.createLinearGradient(0, -h * .25, 0, h * .12);
  fill.addColorStop(0, '#ff2038'); fill.addColorStop(.6, '#ff5a4a'); fill.addColorStop(1, '#ffd2c2');
  ctx.shadowColor = '#ff2a40'; ctx.shadowBlur = h * .3; ctx.fillStyle = fill; shape(); ctx.fill();
}

export function createDarkScene({ back, front, ui, tex, bake, text, font, track }) {
  const made = [], layers = new Map(), handLayers = [];
  const add = (parent, node) => { parent.addChild(node); return node; };
  const glow = (parent, texture = tex.glow, tint = RED) => { const s = add(parent, new Sprite(texture)); s.anchor.set(.5); s.blendMode = 'add'; s.tint = tint; s.visible = false; return s; };
  const aura = glow(back), rim = glow(back, tex.ring);
  const fissures = add(back, new Graphics()); fissures.blendMode = 'add';
  const outflow = add(back, new Container()), embers = add(back, new Container());
  for (let i = 0; i < 40; i++) glow(outflow, tex.spark);
  const eyeTexture = bake(128, 72, c => drawEye(c, 128, 72), 2).texture;
  const voidEyes = [glow(back, eyeTexture, 0xffffff), glow(back, eyeTexture, 0xffffff)];
  const body = add(back, new Container()), hands = add(back, new Container());
  const flares = [0, 1].map(() => ({ halo: glow(back), streak: glow(back, tex.spark, 0xff7a80) }));
  for (let i = 0; i < 30; i++) glow(embers, i % 3 ? tex.glow : tex.spark, i % 4 ? RED : 0xff8a5c);
  const emp = [glow(back, tex.ring, CYAN), glow(back, tex.ring, 0xffffff)];
  const strokes = add(front, new Graphics()); strokes.blendMode = 'add';
  const sparks = add(front, new Container());
  for (let i = 0; i < 44; i++) glow(sparks);
  const title = add(ui, new Container());
  for (let i = 0; i < 3; i++) add(title, new Sprite(Texture.EMPTY));
  const captions = add(ui, new Container());
  for (let i = 0; i < 3; i++) add(captions, new Sprite(Texture.EMPTY));
  // Fissure paths are fixed per seed: jagged cracks running out from the centre.
  const cracks = new Map();
  function crackPaths(seed, count) {
    const key = `${seed}:${count}`; let paths = cracks.get(key);
    if (!paths) {
      paths = Array.from({ length: count }, (_, i) => {
        const base = seed + i * 7.31, single = count === 1;
        let angle = single ? .12 : hash(base) * TAU, x = single ? -SHADOW * .92 : 0, y = single ? .02 : 0;
        const points = [x, y], steps = single ? 11 : 6 + Math.floor(hash(base + 1) * 3), length = (single ? SHADOW * 1.84 : SHADOW * (.75 + .3 * hash(base + 2))) / steps;
        for (let s = 0; s < steps; s++) { angle += (hash(base + s * 3.7) - .5) * 1.1; if (single) angle *= .6; x += Math.cos(angle) * length; y += Math.sin(angle) * length; points.push(x, y); }
        return points;
      });
      cracks.set(key, paths);
    }
    return paths;
  }
  function poseTexture(image) {
    const texture = new Texture({ source: new ImageSource({ resource: image }) }); track(texture); return texture;
  }
  function ensure(images) {
    for (const name of POSE_NAMES) {
      const image = images?.[name];
      if (layers.has(name) || !image?.complete || !image.naturalWidth) continue;
      const texture = poseTexture(image), item = poseLayer(texture, POSES[name]);
      made.push(item); layers.set(name, item); body.addChild(item.mesh);
      if (name === 'emerge') for (const rect of HAND_RECTS) { const hand = poseLayer(texture, POSES.emerge, rect, .09); made.push(hand); handLayers.push(hand); hands.addChild(hand.mesh); }
    }
  }
  function place(item, o, g, t, reduced) {
    const { mesh, u, aspect, rect } = item, h = g.r * o.h;
    mesh.visible = o.alpha > .003; if (!mesh.visible) return;
    mesh.position.set(g.cx + o.x * g.r, g.cy + o.y * g.r); mesh.rotation = o.rotation ?? 0;
    mesh.scale.set(h * aspect * (o.sx ?? 1) * (rect[2] - rect[0]), h * (o.sy ?? 1) * (rect[3] - rect[1]));
    u.uTime = reduced ? 0 : t; u.uAlpha = o.alpha; u.uSway = reduced ? 0 : o.sway ?? 0; u.uSilhouette = o.silhouette ?? 0; u.uEye = o.eye ?? 1;
    u.uGlitch = o.glitch ?? 0; u.uCrack = o.crack ?? 0; u.uDissolve = o.dissolve ?? 0; u.uHit = o.hit ?? 0;
  }
  // A point in a pose's UV space, in world pixels.
  function anchor(item, o, g, uv) {
    const h = g.r * o.h, lx = (uv[0] - .5) * h * item.aspect * (o.sx ?? 1), ly = (uv[1] - .5) * h * (o.sy ?? 1), c = Math.cos(o.rotation ?? 0), s = Math.sin(o.rotation ?? 0);
    return [g.cx + o.x * g.r + lx * c - ly * s, g.cy + o.y * g.r + lx * s + ly * c];
  }
  const jag = (x0, y0, x1, y1, parts, amount, seed) => {
    const points = [x0, y0], nx = -(y1 - y0), ny = x1 - x0, length = Math.hypot(nx, ny) || 1;
    for (let i = 1; i < parts; i++) { const k = i / parts, off = (hash(seed + i * 5.3) - .5) * amount; points.push(x0 + (x1 - x0) * k + nx / length * off, y0 + (y1 - y0) * k + ny / length * off); }
    points.push(x1, y1); return points;
  };
  function path(graphics, points, style) {
    graphics.beginPath().moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) graphics.lineTo(points[i], points[i + 1]);
    graphics.stroke(style);
  }
  function hot(graphics, points, r, width, alpha, color = RED) {
    path(graphics, points, { color, alpha: alpha * .16, width: Math.max(2, width * 5 * r) });
    path(graphics, points, { color, alpha: alpha * .9, width: Math.max(1, width * 1.6 * r) });
    path(graphics, points, { color: color === RED ? HOT : 0xffffff, alpha: alpha * .95, width: Math.max(.6, width * .5 * r) });
  }

  function update({ view, run, g, t, reduced, tier, show, shipX, shipY, labelGlitch }) {
    back.visible = front.visible = title.visible = captions.visible = show;
    if (!show) return;
    const { r } = g, lite = tier === 'low', time = run.time;
    for (const item of made) item.mesh.visible = false;
    for (const o of view.layers) { const item = layers.get(o.pose); if (item) place(item, o, g, t, reduced); }
    view.hands.forEach(o => { const item = handLayers[o.side]; if (item) place(item, { ...o, eye: 1.2, sway: 0 }, g, t, reduced); });
    // The brightest pose owns the eye flares and the tether hand.
    const lead = view.layers.reduce((best, o) => !best || o.alpha > best.alpha ? o : best, null), leadItem = lead && layers.get(lead.pose);
    aura.visible = !lite && view.aura > .01;
    if (aura.visible) { aura.position.set(g.cx, g.cy + (lead?.y ?? 0) * r); aura.width = aura.height = r * (1.5 + .12 * Math.sin(t * 2.1)); aura.alpha = view.aura * .32; }
    rim.visible = view.rim > .01;
    if (rim.visible) { rim.position.set(g.cx, g.cy); rim.width = rim.height = r * SHADOW * 2 * 1.16; rim.alpha = clamp(view.rim); }
    flares.forEach(({ halo, streak }, i) => {
      const uv = leadItem?.pose.eyes[i], power = lead ? lead.alpha * Math.max(0, lead.eye - (1 - lead.silhouette) * .55) : 0;
      halo.visible = streak.visible = !!uv && power > .05 && !lite;
      if (!halo.visible) return;
      const [x, y] = anchor(leadItem, lead, g, uv), size = r * lead.h * .17;
      halo.position.set(x, y); halo.width = halo.height = size * (1 + .3 * power); halo.alpha = clamp(power * .5);
      streak.position.set(x, y); streak.width = size * 2.6 * power; streak.height = Math.max(1.5, size * .12); streak.alpha = clamp(power * .55);
    });
    const eyes = view.voidEyes;
    voidEyes.forEach((s, i) => {
      s.visible = !!eyes && eyes.alpha > .01 && eyes.open > .02;
      if (!s.visible) return;
      const side = i ? 1 : -1, w = r * .135 * eyes.scale;
      s.position.set(g.cx + side * r * .062 * eyes.scale, g.cy + eyes.y * r); s.width = w; s.height = w * .5625 * eyes.open; s.scale.x = Math.abs(s.scale.x) * side;
      s.alpha = clamp(eyes.alpha * (reduced ? 1 : .88 + .12 * Math.sin(t * 31 + i)));
    });
    fissures.clear(); fissures.position.set(g.cx, g.cy);
    if (view.fissure && view.fissure.alpha > .01) {
      const { count, progress, alpha, seed } = view.fissure, flicker = reduced ? 1 : .8 + .2 * Math.sin(t * 43);
      for (const points of crackPaths(seed, count)) {
        const shown = Math.max(2, Math.ceil(points.length / 2 * progress)) * 2;
        hot(fissures, points.slice(0, shown).map(v => v * r), r, .004, alpha * flicker);
      }
    }
    outflow.visible = view.outflow > .01 && !reduced;
    if (outflow.visible) outflow.children.forEach((s, i) => {
      // Matter is supposed to fall in. These climb out.
      const k = (time * (.22 + hash(i) * .2) + hash(i + 40)) % 1, a = hash(i + 9) * TAU + time * .15, rr = r * (SHADOW + .02 + k * .5);
      s.visible = !lite || i % 2 === 0; s.position.set(g.cx + Math.cos(a) * rr, g.cy + Math.sin(a) * rr * .9); s.rotation = a;
      s.width = r * .05; s.height = Math.max(1.2, r * .005); s.alpha = view.outflow * Math.sin(k * Math.PI) * .8;
    });
    embers.visible = view.embers > .01 && !reduced && !lite;
    if (embers.visible) embers.children.forEach((s, i) => {
      const k = (t * (.16 + hash(i + 3) * .2) + hash(i + 70)) % 1, x = (hash(i + 5) - .5) * .62 + Math.sin(t * 1.4 + i) * .02, y = .26 - k * .62;
      s.position.set(g.cx + x * r, g.cy + y * r); s.rotation = -Math.PI / 2;
      const size = r * (.012 + hash(i + 21) * .02); s.width = i % 3 ? size : size * 2.4; s.height = i % 3 ? size : Math.max(1, size * .25);
      s.alpha = view.embers * Math.sin(k * Math.PI) * .55;
    });
    emp.forEach((s, i) => {
      s.visible = !!view.emp && view.emp.alpha > .01;
      if (!s.visible) return;
      s.position.set(shipX, shipY); s.width = s.height = r * view.emp.radius * 2 * 1.13 * (i ? .82 : 1); s.alpha = view.emp.alpha * (i ? .45 : .85);
    });

    // Attacks, tethers, and the shard bolt: additive strokes above the debris.
    strokes.clear(); strokes.position.set(g.cx, g.cy);
    let spark = 0;
    const dot = (x, y, size, alpha, tint = RED, texture = tex.glow, rotation = 0, height = size) => {
      const s = sparks.children[spark++]; if (!s) return;
      s.visible = true; s.texture = texture; s.tint = tint; s.position.set(g.cx + x, g.cy + y); s.width = size; s.height = height; s.rotation = rotation; s.alpha = clamp(alpha);
    };
    const flick = reduced ? 1 : .75 + .25 * Math.sin(t * 37);
    for (const o of run.attacks ?? []) {
      const warn = o.warning > 0, seed = Math.floor(t * (reduced ? 0 : 18)) + o.radius * 91;
      if (o.type === 'claw') {
        // A rift tear: a radial wound that sweeps along its orbit toward the rocket.
        const sin = Math.sin(o.angle), cos = Math.cos(o.angle), cx = sin * o.radius * r, cy = -cos * o.radius * r;
        const grow = warn ? 1 - o.warning / .9 : 1, half = r * .052 * (warn ? .25 + .75 * grow : 1);
        const points = jag(cx - sin * half, cy + cos * half, cx + sin * half, cy - cos * half, 5, r * (warn ? .012 : .03), seed);
        if (warn) {
          strokes.beginPath().arc(0, 0, o.radius * r, -.1 - Math.PI / 2, o.angle - Math.PI / 2).stroke({ color: RED, alpha: .16 + .16 * grow * flick, width: Math.max(1.2, r * .005) });
          hot(strokes, points, r, .004, (.35 + .45 * grow) * flick);
          dot(cx, cy, r * .16 * grow, .3 * grow);
        } else {
          // The scar it leaves behind, trailing back along the orbit.
          const back = o.angle + .13;
          dot(Math.sin(back) * o.radius * r, -Math.cos(back) * o.radius * r, r * .3, .6, RED, tex.spark, back, r * .034);
          hot(strokes, points, r, .008, 1);
          dot(cx, cy, r * .22, .5);
        }
      } else {
        // A gravity spear: a committed lane that charges, then fires straight through.
        const y = o.y * r, dir = Math.sign(o.vx) || 1;
        if (warn) {
          const charge = 1 - o.warning / 1.3;
          path(strokes, [-1.15 * r, y, 1.15 * r, y], { color: RED, alpha: (.12 + .25 * charge) * flick, width: Math.max(1, r * (.003 + .006 * charge)) });
          for (let i = 0; i < 4; i++) { const x = -dir * r * (1.1 - ((charge * 1.6 + i * .25) % 1) * .5); path(strokes, [x - dir * r * .02, y - r * .02, x, y, x - dir * r * .02, y + r * .02], { color: HOT, alpha: .5 * flick, width: Math.max(1, r * .004) }); }
          dot(-dir * r * 1.02, y, r * (.08 + .22 * charge), .35 + .5 * charge);
        } else {
          const x = o.x * r;
          dot(x - dir * r * .16, y, r * .5, .55, RED, tex.spark, dir > 0 ? 0 : Math.PI, r * .06);
          dot(x - dir * r * .06, y, r * .26, 1, HOT, tex.spark, dir > 0 ? 0 : Math.PI, r * .022);
          dot(x, y, r * .13, .9, 0xff8090);
        }
      }
    }
    // Puppet strings from his raised hand to the rocket's thrusters.
    const puppeteer = layers.get('inversion'), strings = view.layers.find(o => o.pose === 'inversion');
    if (view.tether > .01 && puppeteer && strings) {
      const [hx, hy] = anchor(puppeteer, strings, g, POSES.inversion.hand), x0 = hx - g.cx, y0 = hy - g.cy;
      for (let i = 0; i < 2; i++) {
        const x1 = shipX - g.cx + (i ? .012 : -.012) * r, y1 = shipY - g.cy + r * .015;
        const mx = (x0 + x1) / 2 + (i ? 1 : -1) * r * .05 + (reduced ? 0 : Math.sin(t * 6.3 + i * 2) * r * .008), my = (y0 + y1) / 2 + r * .03;
        for (const [width, alpha] of [[r * .012, .1], [Math.max(1, r * .003), .7]]) strokes.beginPath().moveTo(x0, y0).quadraticCurveTo(mx, my, x1, y1).stroke({ color: RED, alpha: alpha * view.tether, width });
        if (!reduced) for (let n = 0; n < 2; n++) {
          const k = (t * .9 + n * .5 + i * .25) % 1, q = 1 - k;
          dot(q * q * x0 + 2 * q * k * mx + k * k * x1, q * q * y0 + 2 * q * k * my + k * k * y1, r * .03, view.tether * Math.sin(k * Math.PI) * .9, HOT);
        }
      }
      dot(x0, y0, r * .09, view.tether * .6);
    }
    if (view.bolt >= 0 && view.bolt < 1 && lead) {
      // Each resonance shard discharges into him.
      const points = jag(shipX - g.cx, shipY - g.cy, lead.x * r, lead.y * r, 8, r * .09, Math.floor(t * 30));
      hot(strokes, points, r, .006, 1 - view.bolt, CYAN);
      dot(lead.x * r, lead.y * r, r * .4 * (1 - view.bolt), .7 * (1 - view.bolt), CYAN);
    }
    if (view.attackGlow > .05 && lead) dot(lead.x * r, lead.y * r, r * .9, view.attackGlow * .22);
    for (let i = spark; i < sparks.children.length; i++) sparks.children[i].visible = false;

    // Title card and captions. The control cue is gameplay-critical, so it never glitches away.
    const [name, cue] = bossCaption(run), card = view.title && view.title.alpha > .01 ? view.title : null;
    title.visible = !!card;
    if (card) {
      const size = Math.max(22, Math.min(64, r * .13)), style = `700 ${size}px ${font}`, shift = reduced ? 0 : card.glitch * size * .14;
      const y = g.cy + r * .31, jitter = reduced ? 0 : (hash(Math.floor(t * 24)) - .5) * card.glitch * size * .2;
      text(title.children[0], card.text, style, '#ff2a48', g.cx - shift + jitter, y, r * 1.5);
      text(title.children[1], card.text, style, '#48fff0', g.cx + shift + jitter, y + shift * .3, r * 1.5);
      text(title.children[2], card.text, style, '#fff1f3', g.cx + jitter * .4, y, r * 1.5);
      title.children[0].alpha = title.children[1].alpha = card.alpha * (card.glitch > .02 ? .75 : 0); title.children[2].alpha = card.alpha;
      for (const child of title.children) { child.blendMode = child === title.children[2] ? 'normal' : 'add'; child.scale.set(card.scale); }
    }
    const small = `700 ${Math.max(10, r * .034)}px ${font}`;
    text(captions.children[0], card ? '' : name, small, '#dceff5', g.cx, g.cy + r * .32, r * .85);
    // While the title card is up the cue is the only instruction on screen, so it grows.
    text(captions.children[1], cue, card ? `700 ${Math.max(13, r * .05)}px ${font}` : small, run.darkStage === 1 ? '#ffd3d9' : '#8afff5', g.cx, g.cy + r * (card ? .43 : .37), r * .95);
    text(captions.children[2], labelGlitch ? 'D4RKN1DE' : '', `700 ${Math.max(12, Math.min(24, r * .064))}px ${font}`, '#ff5a70', g.cx + (hash(Math.floor(t * 30)) - .5) * r * .04, g.cy - 8, r * .72);
  }
  return { update, ensure, destroy() { for (const item of made) item.destroy(); made.length = 0; layers.clear(); handLayers.length = 0; } };
}
