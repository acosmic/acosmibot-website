import {Geometry,Mesh,Shader} from 'pixi.js';
import {ROCKET_NOSE_X,ROCKET_NOSE_Y,HEAT_ANGLE} from './rocket-art.mjs';
// Four retained Bezier strips reproduce drawNoseHeat's swept fills. Geometry is
// evaluated on the GPU; heat animation never uploads a bitmap per frame.
export function createHeatMesh(){
  const positions=[],shapes=[],indices=[];
  for(let shape=0;shape<4;shape++){
    const base=positions.length/2;
    for(let i=0;i<=64;i++)for(let side=0;side<2;side++){positions.push(i/64,side);shapes.push(shape);}
    for(let i=0;i<64;i++){const a=base+i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const geometry=new Geometry({attributes:{aPosition:{buffer:new Float32Array(positions),format:'float32x2'},aShape:{buffer:new Float32Array(shapes),format:'float32'}},indexBuffer:new Uint16Array(indices)});
  const vertex=`
precision highp float;
attribute vec2 aPosition;attribute float aShape;
uniform mat3 uProjectionMatrix;uniform mat3 uWorldTransformMatrix;uniform mat3 uTransformMatrix;
uniform float uSize;uniform float uHeat;uniform float uTime;uniform float uReduced;
varying float vX;varying float vShape;varying float vLength;varying float vIntensity;varying float vLevel;
void main(){
 float level=clamp(uHeat/100.,0.,1.);
 float pulse=uReduced>.5?1.:1.+sin(uTime*6.28318530718*.8)*.12*level;
 float length=uSize*(.28+.48*level)*pulse;
 float width=uSize*(.075+.11*level),tip=uSize*.035;
 float signY=aPosition.y>.5?1.:-1.;
 vec2 p0=vec2(tip,0.),p1=vec2(0.,-width),p2=vec2(-length*.3,-width),p3=vec2(-length,0.);
 if(aShape<.5){p1.y=signY*width;p2.y=signY*width;}
 else if(aShape<1.5){p1=vec2(0.,signY*width*.7);p2=vec2(-uSize*.14,signY*width*.55);p3=vec2(-uSize*.24,0.);}
 else{float side=aShape<2.5?-1.:1.;p1=vec2(-length*.1,side*width*(aPosition.y>.5?.55:1.));p2=vec2(-length*.4,side*width*(aPosition.y>.5?.8:1.15));p3=vec2(-length,side*width*.7);}
 float t=aPosition.x,s=1.-t;vec2 p=s*s*s*p0+3.*s*s*t*p1+3.*s*t*t*p2+t*t*t*p3;
 vX=p.x;vShape=aShape;vLength=length;vLevel=level;vIntensity=min(1.,pow(level,.4)*pulse);
 float c=cos(${HEAT_ANGLE}),sn=sin(${HEAT_ANGLE});
 p=mat2(c,sn,-sn,c)*(p-vec2(tip,0.))+uSize*vec2(${ROCKET_NOSE_X},${ROCKET_NOSE_Y});
 vec3 projected=uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix*vec3(p,1.);
 gl_Position=vec4(projected.xy,0.,1.);
}`;
  const fragment=`
precision highp float;
uniform float uSize;varying float vX;varying float vShape;varying float vLength;varying float vIntensity;varying float vLevel;
void main(){
 float start=vShape>.5&&vShape<1.5?-uSize*.24:-vLength;
 float x=clamp((vX-start)/(uSize*.035-start),0.,1.);vec4 color;
 if(vShape<.5){
  vec4 a=vec4(1.,0.,0.,0.),b=vec4(1.,15./255.,8./255.,.24*vIntensity),c=vec4(1.,35./255.,15./255.,.75*vIntensity),d=vec4(1.,125./255.,55./255.,vIntensity);
  color=x<.45?mix(a,b,x/.45):x<.85?mix(b,c,(x-.45)/.4):mix(c,d,(x-.85)/.15);
 }else if(vShape<1.5){
  vec4 a=vec4(1.,25./255.,0.,0.),b=vec4(1.,55./255.,12./255.,.8*vIntensity),c=vec4(1.,165./255.,65./255.,vIntensity),d=vec4(1.,240./255.,190./255.,vIntensity);
  color=x<.55?mix(a,b,x/.55):x<.86?mix(b,c,(x-.55)/.31):mix(c,d,(x-.86)/.14);
 }else{vec4 a=vec4(1.,15./255.,0.,0.),b=vec4(1.,40./255.,15./255.,.35*vIntensity),c=vec4(1.,floor(90.+70.*vLevel+.5)/255.,80./255.,.85*vIntensity);color=x<.65?mix(a,b,x/.65):mix(b,c,(x-.65)/.35);}
 gl_FragColor=vec4(color.rgb*color.a,color.a);
}`;
  const shader=Shader.from({gl:{vertex,fragment},resources:{heatUniforms:{uSize:{value:84,type:'f32'},uHeat:{value:0,type:'f32'},uTime:{value:0,type:'f32'},uReduced:{value:0,type:'f32'}}}});
  const mesh=new Mesh({geometry,shader});mesh.blendMode='screen';
  return {mesh,update(size,heat,time,reduced){const u=shader.resources.heatUniforms.uniforms;u.uSize=size;u.uHeat=heat;u.uTime=time;u.uReduced=reduced?1:0;mesh.visible=heat>0;},destroy(){mesh.destroy();geometry.destroy();shader.destroy();}};
}
