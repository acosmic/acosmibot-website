// Screen-space presentation passes. These only change pixels; collision,
// replay, and simulation coordinates are never read back from the GPU.
import { Filter } from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters/advanced-bloom';
import { DOPPLER_ANGLE } from './juice.mjs';

// Standard v8 filter vertex stage (Filter.from does not supply one in this Pixi version).
const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition(void){
  vec2 position=aPosition*uOutputFrame.zw+uOutputFrame.xy;
  position.x=position.x*(2.0/uOutputTexture.x)-1.0;
  position.y=position.y*(2.0*uOutputTexture.z/uOutputTexture.y)-uOutputTexture.z;
  return vec4(position,0.0,1.0);
}
vec2 filterTextureCoord(void){ return aPosition*(uOutputFrame.zw*uInputSize.zw); }
void main(void){ gl_Position=filterVertexPosition(); vTextureCoord=filterTextureCoord(); }
`;
const common = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform highp vec4 uInputClamp;
vec2 screenPos(){ return vTextureCoord*uInputSize.xy+uOutputFrame.xy; }
vec2 toUv(vec2 p){ return clamp((p-uOutputFrame.xy)*uInputSize.zw,uInputClamp.xy,uInputClamp.zw); }
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
`;

// Gravitational lensing of the far background only. Gameplay sprites are never
// distorted, so every hazard stays exactly where the simulation puts it.
const lensFragment = `${common}
uniform vec2 uCenter;
uniform float uEinstein;
uniform float uTide;
uniform float uTime;
uniform float uRing;
void main(){
  vec2 pos=screenPos();
  vec2 d=pos-uCenter;
  float dist=max(length(d),1.);
  vec2 dir=d/dist;
  float re=uEinstein;
  // Thin-lens equation: the observed point maps back to its unlensed source.
  float beta=dist-re*re/dist;
  beta+=uTide*sin(dist*.045-uTime*5.)*9.*exp(-pow(dist/(re*3.),2.));
  vec4 color=texture(uTexture,toUv(uCenter+dir*beta));
  float magnification=clamp(re*re/(dist*dist),0.,1.);
  color.rgb*=1.+magnification*.4;
  float ring=exp(-pow((dist-re*1.02)/(re*.03),2.));
  color.rgb+=vec3(1.,.84,.64)*ring*uRing;
  finalColor=vec4(color.rgb,1.);
}`;

// One combined pass keeps the post stack to a single full-screen draw:
// colour grade, vignette, heat edge glow, shockwaves, heat haze, aberration, grain.
const postFragment = `${common}
uniform vec2 uScreen;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uTime;
uniform float uChroma;
uniform float uGrain;
uniform float uVignette;
uniform float uHeat;
uniform float uHaze;
uniform vec3 uGain;
uniform vec3 uLift;
uniform float uSaturation;
uniform vec4 uWave0;
uniform vec4 uWave1;
vec2 wave(vec2 p,vec4 w){
  if(w.w<=0.)return vec2(0.);
  vec2 d=p-w.xy;float dist=max(length(d),1.);
  float x=(dist-w.z)/38.;
  return d/dist*sin(x*3.14159)*exp(-x*x*1.6)*16.*w.w;
}
void main(){
  vec2 pos=screenPos();
  vec2 offset=wave(pos,uWave0)+wave(pos,uWave1);
  float rn=length(pos-uCenter)/max(uRadius,1.);
  float band=smoothstep(.44,.5,rn)*(1.-smoothstep(.62,.72,rn));
  offset+=vec2(sin(pos.y*.09+uTime*7.),cos(pos.x*.07-uTime*5.3))*uHaze*band;
  vec2 p=pos+offset;
  vec2 fromCenter=(pos-uScreen*.5)/max(uScreen.x,uScreen.y);
  vec2 ca=fromCenter*uChroma*14.;
  vec3 color;
  if(uChroma>.002){
    color=vec3(texture(uTexture,toUv(p+ca)).r,texture(uTexture,toUv(p)).g,texture(uTexture,toUv(p-ca)).b);
  }else color=texture(uTexture,toUv(p)).rgb;
  float waveGlow=0.;
  if(uWave0.w>0.)waveGlow+=exp(-pow((length(pos-uWave0.xy)-uWave0.z)/22.,2.))*uWave0.w;
  if(uWave1.w>0.)waveGlow+=exp(-pow((length(pos-uWave1.xy)-uWave1.z)/22.,2.))*uWave1.w;
  color+=vec3(1.,.8,.6)*waveGlow*.12;
  color=color*uGain+uLift*(1.-color);
  float luma=dot(color,vec3(.2126,.7152,.0722));
  color=mix(vec3(luma),color,uSaturation);
  vec2 uv=pos/uScreen;
  float edge=length((uv-.5)*vec2(1.,uScreen.y/uScreen.x)*1.25);
  float vignette=smoothstep(.85,.25,edge);
  color*=mix(1.,.35+.65*vignette,uVignette);
  float rim=smoothstep(.45,.95,edge);
  color+=vec3(1.,.32,.12)*rim*uHeat*(.75+.25*sin(uTime*6.));
  color+=(hash(floor(pos)+fract(uTime*7.)*91.)-.5)*uGrain;
  finalColor=vec4(max(color,0.),1.);
}`;

function uniforms(spec) {
  return Object.fromEntries(Object.entries(spec).map(([name, [type, value]]) => [name, { type, value }]));
}

export function createLensFilter() {
  const filter = Filter.from({ gl: { vertex, fragment: lensFragment }, resources: { lens: uniforms({
    uCenter: ['vec2<f32>', new Float32Array(2)], uEinstein: ['f32', 100], uTide: ['f32', 0],
    uTime: ['f32', 0], uRing: ['f32', .35],
  }) } });
  const u = filter.resources.lens.uniforms;
  return { filter, update({ cx, cy, einstein, tide, time, ring }) {
    u.uCenter[0] = cx; u.uCenter[1] = cy; u.uEinstein = einstein; u.uTide = tide; u.uTime = time; u.uRing = ring;
  } };
}

// Per-phase grades. Gain multiplies, lift raises shadows, saturation mixes from grey.
export const GRADES = {
  orbit: { gain: [1, 1.01, 1.05], lift: [.004, .008, .02], saturation: 1.08 },
  asteroids: { gain: [1.1, .98, .86], lift: [.025, .012, 0], saturation: 1.12 },
  convoy: { gain: [1.02, .95, 1.1], lift: [.02, .006, .03], saturation: 1.05 },
  tide: { gain: [.92, 1.06, 1.06], lift: [0, .02, .02], saturation: 1.1 },
  pulsar: { gain: [.96, .96, 1.12], lift: [.01, .008, .035], saturation: .95 },
};

export function createPostFilter() {
  const filter = Filter.from({ gl: { vertex, fragment: postFragment }, resources: { post: uniforms({
    uScreen: ['vec2<f32>', new Float32Array([1, 1])], uCenter: ['vec2<f32>', new Float32Array(2)],
    uRadius: ['f32', 1], uTime: ['f32', 0], uChroma: ['f32', 0], uGrain: ['f32', .035], uVignette: ['f32', .9],
    uHeat: ['f32', 0], uHaze: ['f32', 0], uGain: ['vec3<f32>', new Float32Array([1, 1, 1])],
    uLift: ['vec3<f32>', new Float32Array(3)], uSaturation: ['f32', 1],
    uWave0: ['vec4<f32>', new Float32Array(4)], uWave1: ['vec4<f32>', new Float32Array(4)],
  }) } });
  const u = filter.resources.post.uniforms;
  const grade = { gain: [1, 1, 1], lift: [0, 0, 0], saturation: 1 };
  return { filter, grade, update(s) {
    u.uScreen[0] = s.width; u.uScreen[1] = s.height; u.uCenter[0] = s.cx; u.uCenter[1] = s.cy;
    u.uRadius = s.r; u.uTime = s.time; u.uChroma = s.chroma; u.uGrain = s.grain; u.uVignette = s.vignette;
    u.uHeat = s.heat; u.uHaze = s.haze; u.uSaturation = grade.saturation;
    for (let i = 0; i < 3; i++) { u.uGain[i] = grade.gain[i]; u.uLift[i] = grade.lift[i]; }
    for (const [slot, w] of [[u.uWave0, s.waves[0]], [u.uWave1, s.waves[1]]]) {
      if (w) { slot[0] = w.x; slot[1] = w.y; slot[2] = w.radius; slot[3] = w.strength; } else slot[3] = 0;
    }
  }, blendGrade(kinds, blend) {
    const targets = kinds.map(k => GRADES[k] ?? GRADES.orbit);
    const avg = key => [0, 1, 2].map(i => targets.reduce((sum, g) => sum + g[key][i], 0) / targets.length);
    const gain = avg('gain'), lift = avg('lift'), saturation = targets.reduce((sum, g) => sum + g.saturation, 0) / targets.length;
    for (let i = 0; i < 3; i++) { grade.gain[i] += (gain[i] - grade.gain[i]) * blend; grade.lift[i] += (lift[i] - grade.lift[i]) * blend; }
    grade.saturation += (saturation - grade.saturation) * blend;
  } };
}

// Bloom must run at full resolution: a lowered filter resolution would also
// blur every gameplay sprite it composites. Cost is controlled by quality instead.
export function createBloomFilter() {
  return new AdvancedBloomFilter({ threshold: .52, bloomScale: .85, brightness: 1, blur: 7, quality: 3 });
}

export { DOPPLER_ANGLE };
