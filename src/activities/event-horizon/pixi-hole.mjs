// Retained black-hole GPU geometry. Static artwork is uploaded only on resize.
import { Application, Container, CanvasSource, Color, Geometry, Graphics, Mesh, Shader, Sprite, Texture } from 'pixi.js';
import { drawBlackHole } from './black-hole.mjs';
import { tideStrength, tideDust, TIDE_DUST_COUNT } from './tide-fx.mjs';
import { holeGeometry } from './render-cache.mjs';

const vertex = `
attribute vec2 aPosition;
attribute vec4 aEllipse;
attribute vec4 aStroke;
attribute vec4 aColor;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec2 uCenter;
uniform float uTime;
uniform float uTide;
varying vec4 vColor;
void main(){
  float angle=aEllipse.z+uTime*aEllipse.w;
  vec2 p=vec2(cos(angle),sin(angle))*aEllipse.xy;
  vec2 normal=normalize(vec2(cos(angle)/aEllipse.x,sin(angle)/aEllipse.y));
  p*=1.-uTide*.008;
  p+=normal*aPosition.y*aStroke.x*(1.+uTide*.35);
  float c=cos(aStroke.y),s=sin(aStroke.y);
  p=mat2(c,s,-s,c)*p+uCenter;
  vec3 projected=uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix*vec3(p,1.);
  gl_Position=vec4(projected.xy,0.,1.);
  vColor=vec4(min(vec3(1.),aColor.rgb*(1.+uTide*.45))*aColor.a,aColor.a);
}`;
const fragment = `varying vec4 vColor; void main(){gl_FragColor=vColor;}`;

function arcMesh(arcs, camera, width, height, ratio) {
  const positions=[],ellipses=[],strokes=[],colors=[],indices=[];
  for(const arc of arcs){
    // <= 1.5 physical pixels along each segment; no reduced detail or line-width scaling.
    const segments=Math.ceil(arc.span*arc.rx*ratio/1.5);
    const first=positions.length/2,rgba=new Color(arc.color).toArray();
    for(let i=0;i<=segments;i++)for(const side of [-1,1]){
      positions.push(0,side);
      ellipses.push(arc.rx,arc.ry,arc.angle+arc.span*i/segments,arc.speed);
      strokes.push(arc.width/2,arc.rotation,0,0);
      colors.push(...rgba);
    }
    for(let i=0;i<segments;i++){
      const a=first+i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);
    }
  }
  const geometry=new Geometry({attributes:{
    aPosition:{buffer:new Float32Array(positions),format:'float32x2'},
    aEllipse:{buffer:new Float32Array(ellipses),format:'float32x4'},
    aStroke:{buffer:new Float32Array(strokes),format:'float32x4'},
    aColor:{buffer:new Float32Array(colors),format:'float32x4'},
  },indexBuffer:new Uint32Array(indices)});
  const shader=Shader.from({gl:{vertex,fragment},resources:{scene:{
    uCenter:{value:new Float32Array([camera.cx,camera.cy]),type:'vec2<f32>'},
    uTime:{value:0,type:'f32'},
    uTide:{value:0,type:'f32'},
  }}});
  return {mesh:new Mesh({geometry,shader}),shader,geometry};
}

export function createHoleScene({width,height,ratio=2,camera,reduced=false}){
  const stage=new Container();stage.eventMode='none';
  const textures=[],meshes=[],embers=[],dust=[];
  const mote={};
  let textureBytes=0;
  function staticLayer(name,extent){
    const {cx,cy,r}=camera;
    const left=Math.max(0,Math.floor((cx-r*extent)*ratio)/ratio);
    const top=Math.max(0,Math.floor((cy-r*extent)*ratio)/ratio);
    const right=Math.min(width,Math.ceil((cx+r*extent)*ratio)/ratio);
    const bottom=Math.min(height,Math.ceil((cy+r*extent)*ratio)/ratio);
    const buffer=document.createElement('canvas');
    buffer.width=Math.max(1,Math.round((right-left)*ratio));buffer.height=Math.max(1,Math.round((bottom-top)*ratio));
    const ctx=buffer.getContext('2d');ctx.scale(ratio,ratio);ctx.translate(-left,-top);
    const layers={bloom:false,streams:false,core:false,photons:false,embers:false,lane:false};layers[name]=true;
    drawBlackHole(ctx,0,camera,reduced,{},layers);
    const texture=new Texture({source:new CanvasSource({resource:buffer,resolution:ratio})});
    textures.push(texture);textureBytes+=buffer.width*buffer.height*4;
    const sprite=new Sprite(texture);sprite.position.set(left,top);stage.addChild(sprite);
  }
  function arcs(data){const item=arcMesh(data,camera,width,height,ratio);meshes.push(item);stage.addChild(item.mesh);}
  const geometry=holeGeometry(camera.r,reduced);
  staticLayer('bloom',.77);
  arcs(geometry.streams.map(({i,k,rr,ry,color,width})=>({rx:rr,ry,angle:i*2.39,span:1.8+i%3,speed:.08+k*.12,rotation:-.28,color,width})));
  staticLayer('core',.36);
  arcs(geometry.photons.flatMap(({i,rr,span,strokes})=>strokes.map(({j,color,width})=>({rx:rr,ry:rr,
    angle:i*2.399-span+j*span/12,span:span/12+.002,speed:reduced?0:.18+i*.027,rotation:0,color,width}))));
  if(!reduced)for(let i=0;i<60;i++){
    const sprite=new Sprite(Texture.WHITE);sprite.tint=i%3?0xffc689:0xfff1ca;sprite.alpha=i%3?.6:.8;
    sprite.width=sprite.height=.8+i%2;stage.addChild(sprite);embers.push(sprite);
  }
  if(!reduced)for(let i=0;i<TIDE_DUST_COUNT;i++){
    const sprite=new Sprite(Texture.WHITE);sprite.anchor.set(.5);sprite.tint=0xffd5a2;
    sprite.height=Math.max(1,camera.r*.0018);stage.addChild(sprite);dust.push(sprite);
  }
  const tideRim=new Graphics().circle(0,0,camera.r*.354)
    .stroke({color:0xffc285,width:10,alpha:.3})
    .circle(0,0,camera.r*.354).stroke({color:0xffdcaa,width:3,alpha:.95});
  tideRim.position.set(camera.cx,camera.cy);stage.addChild(tideRim);
  staticLayer('lane',1.07);
  const render=(time,run)=>{
    const strength=tideStrength(run,reduced);
    tideRim.alpha=strength;tideRim.visible=strength>0;
    for(const {shader} of meshes){
      shader.resources.scene.uniforms.uTime=time;
      shader.resources.scene.uniforms.uTide=strength;
    }
    for(let i=0;i<dust.length;i++){
      const sprite=dust[i];sprite.visible=strength>0;
      if(!sprite.visible)continue;
      tideDust(i,run.time,mote);
      sprite.position.set(camera.cx+mote.x*camera.r,camera.cy+mote.y*camera.r);
      sprite.width=mote.length*camera.r;sprite.rotation=mote.angle;sprite.alpha=mote.alpha*strength;
    }
    for(let i=0;i<embers.length;i++){
      const angle=i*2.399+time*(.06+i%4*.025),r=camera.r*(.37+i%13*.006);
      embers[i].position.set(camera.cx+Math.cos(angle)*r,camera.cy+Math.sin(angle)*r);
    }

  };
  render(0);
  return {stage,render,textureBytes,destroy(){
    stage.destroy({children:true});
    for(const {geometry,shader} of meshes){geometry.destroy();shader.destroy();}
    for(const texture of textures)texture.destroy(true);
  }};
}

export async function createPixiHole(options){
  const app=new Application();
  await app.init({...options,resolution:options.ratio??2,autoDensity:true,antialias:true,
    preference:'webgl',autoStart:false,backgroundAlpha:0});
  const scene=createHoleScene(options);app.stage.addChild(scene.stage);
  const render=t=>{scene.render(t);app.render();};render(0);
  return {app,render,textureBytes:scene.textureBytes,destroy(){
    scene.destroy();app.destroy({removeView:false,releaseGlobalResources:true});
  }};
}
