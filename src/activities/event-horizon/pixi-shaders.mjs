// Procedural GPU meshes: the turbulent accretion disk and the thruster flame.
// Both are retained geometry with uniforms only; nothing uploads per frame.
import { Geometry, Mesh, Shader } from 'pixi.js';
import { DOPPLER_ANGLE } from './juice.mjs';

const noise = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
`;
const vertex = `
precision highp float;
attribute vec2 aPosition;attribute vec2 aUV;
uniform mat3 uProjectionMatrix;uniform mat3 uWorldTransformMatrix;uniform mat3 uTransformMatrix;
varying vec2 vUV;
void main(){vUV=aUV;vec3 p=uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix*vec3(aPosition,1.);gl_Position=vec4(p.xy,0.,1.);}
`;
function quad(x0, y0, x1, y1, u0, v0, u1, v1) {
  return new Geometry({ attributes: {
    aPosition: { buffer: new Float32Array([x0, y0, x1, y0, x1, y1, x0, y1]), format: 'float32x2' },
    aUV: { buffer: new Float32Array([u0, v0, u1, v0, u1, v1, u0, v1]), format: 'float32x2' },
  }, indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]) });
}

// Keplerian shear: inner gas laps the outer gas, so streaks wind into spirals.
// The disk fades out before the scoring lane so it never hides a hazard.
const diskFragment = `
precision highp float;
varying vec2 vUV;
uniform float uTime;uniform float uTide;uniform float uIntensity;uniform vec3 uHot;uniform vec3 uMid;uniform vec3 uCool;
${noise}
void main(){
  float rr=length(vUV);
  if(rr<.34||rr>.6){gl_FragColor=vec4(0.);return;}
  float a=atan(vUV.y,vUV.x);
  float omega=.9/pow(rr/.36,1.5);
  float swirl=a+uTime*omega*.35;
  vec2 ang=vec2(cos(swirl),sin(swirl));
  float n=vnoise(ang*2.4+vec2(rr*38.,rr*11.))*.6+vnoise(ang*5.1+vec2(rr*85.,3.7))*.3+vnoise(ang*11.+vec2(rr*170.,9.1))*.1;
  float inner=smoothstep(.345,.366,rr);
  float outer=1.-smoothstep(.39,.53,rr);
  float profile=inner*outer*(.3+.7*pow(1.-smoothstep(.355,.48,rr),1.4));
  float dop=1.+.55*cos(a-${DOPPLER_ANGLE.toFixed(6)});
  float lum=clamp(profile*(.2+n*1.15)*dop*uIntensity*(1.+uTide*.5),0.,1.4);
  float tcol=smoothstep(.355,.5,rr);
  vec3 color=mix(uHot,uMid,smoothstep(0.,.55,tcol));
  color=mix(color,uCool,smoothstep(.55,1.,tcol));
  color=mix(color,vec3(.82,.9,1.),clamp(dop-1.,0.,.55)*.55);
  color*=mix(1.,.7,clamp(1.-dop,0.,1.));
  gl_FragColor=vec4(color*lum,lum);
}`;

// `colors` runs hot inner gas, mid disk, cool outer edge.
export function createDiskMesh(camera, colors = [[1, .94, .82], [1, .58, .24], [.82, .2, .12]]) {
  const { cx, cy, r } = camera, e = .62;
  const geometry = quad(cx - r * e, cy - r * e, cx + r * e, cy + r * e, -e, -e, e, e);
  const shader = Shader.from({ gl: { vertex, fragment: diskFragment }, resources: { disk: {
    uTime: { value: 0, type: 'f32' }, uTide: { value: 0, type: 'f32' }, uIntensity: { value: .85, type: 'f32' },
    uHot: { value: new Float32Array(colors[0]), type: 'vec3<f32>' }, uMid: { value: new Float32Array(colors[1]), type: 'vec3<f32>' },
    uCool: { value: new Float32Array(colors[2]), type: 'vec3<f32>' },
  } } });
  const mesh = new Mesh({ geometry, shader }); mesh.blendMode = 'add';
  const u = shader.resources.disk.uniforms;
  return { mesh, update(time, tide, intensity = .85) { u.uTime = time; u.uTide = tide; u.uIntensity = intensity; },
    destroy() { mesh.destroy(); geometry.destroy(); shader.destroy(); } };
}

// A flickering plasma plume: white-hot core, cyan body, blue tips.
const flameFragment = `
precision highp float;
varying vec2 vUV;
uniform float uTime;uniform float uAlpha;uniform vec3 uTint;
${noise}
void main(){
  float x=vUV.x,y=vUV.y;
  float n=vnoise(vec2(x*7.-uTime*22.,y*2.5+uTime*3.))*.6+vnoise(vec2(x*15.-uTime*35.,y*5.))*.4;
  float w=mix(.95,.1,pow(x,.75))*(.82+.36*n);
  float body=1.-smoothstep(w*.5,w,abs(y));
  float fade=pow(1.-x,1.3)*smoothstep(-.02,.08,x);
  float core=(1.-smoothstep(0.,w*.38,abs(y)))*pow(1.-x,3.2);
  vec3 color=mix(uTint*vec3(.4,.6,1.),uTint,body)*body*fade+vec3(1.)*core;
  float alpha=clamp(body*fade*(.5+.5*n)+core,0.,1.)*uAlpha;
  gl_FragColor=vec4(color*alpha,alpha);
}`;

export function createFlameMesh() {
  const geometry = quad(0, -.5, 1, .5, 0, -1, 1, 1);
  const shader = Shader.from({ gl: { vertex, fragment: flameFragment }, resources: { flame: {
    uTime: { value: 0, type: 'f32' }, uAlpha: { value: 1, type: 'f32' },
    uTint: { value: new Float32Array([.35, .95, 1]), type: 'vec3<f32>' },
  } } });
  const mesh = new Mesh({ geometry, shader }); mesh.blendMode = 'add';
  const u = shader.resources.flame.uniforms;
  return { mesh, update(time, alpha, tint) {
    u.uTime = time; u.uAlpha = alpha; if (tint) { u.uTint[0] = tint[0]; u.uTint[1] = tint[1]; u.uTint[2] = tint[2]; }
  }, destroy() { mesh.destroy(); geometry.destroy(); shader.destroy(); } };
}
