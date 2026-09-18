import {createHeatMesh} from './pixi-heat.mjs';
import { Application, CanvasSource, Container, Graphics, ImageSource, Sprite, Texture } from 'pixi.js';
import { createHoleScene } from './pixi-hole.mjs';
import { drawObjectArt } from './object-art.mjs';
import { drawPhaseReady, rocketTremble, visualHeat } from './heat-fx.mjs';
import { rocketSize, obstacleSize } from './camera.mjs';
import { phaseNames } from './phases-fx.mjs';
const palettes={orbit:[9,25,48],asteroids:[85,40,20],convoy:[49,40,74],tide:[12,65,65],pulsar:[30,24,61]};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const TAU=Math.PI*2;

// Raster artwork is baked once and moved as retained GPU sprites. Animated
// arcs and nose heat use retained GPU geometry; no per-frame bitmap uploads.
export async function createFlightRenderer(canvas,{onLost=()=>{},onRestored=()=>{}}={}){
  const app=new Application();
  await app.init({canvas,preference:'webgl',autoStart:false,antialias:true,
    autoDensity:false,background:0x050812,resolution:1});
  app.stage.eventMode='none';app.stage.interactiveChildren=false;
  let config,scene,hole,background,starSprites=[],objectPool=[],particlePool=[];
  let phaseGraphics,phaseLabels,ship,shipTurn,rocketSprite,rocketFallback,heat,ready,shield,warning,you,flame,border,combo;
  let textures=[],objectTextures=new Map(),labels=new Map(),sourceImages=new WeakMap();
  let tint=[...palettes.orbit],frame=0,lost=false,destroyed=false;
  const makeTexture=(buffer,resolution=1)=>{
    const texture=new Texture({source:new CanvasSource({resource:buffer,resolution})});textures.push(texture);return texture;
  };
  function bake(w,h,draw){
    const ratio=config.ratio,buffer=document.createElement('canvas');
    buffer.width=Math.max(1,Math.ceil(w*ratio));buffer.height=Math.max(1,Math.ceil(h*ratio));
    const ctx=buffer.getContext('2d');ctx.scale(ratio,ratio);draw(ctx);
    return {buffer,ctx,texture:makeTexture(buffer,ratio)};
  }
  function sprite(texture,parent=scene){const s=new Sprite(texture);parent.addChild(s);return s;}
  function centered(w,h,draw,parent=scene){const image=bake(w,h,c=>{c.translate(w/2,h/2);draw(c);});const s=sprite(image.texture,parent);s.anchor.set(.5);return {s,...image};}
  function label(text,font,color,maxWidth){
    const key=JSON.stringify([text,font,color,maxWidth]);let entry=labels.get(key);if(entry){entry.used=frame;return entry.texture;}
    const c=document.createElement('canvas').getContext('2d');c.font=font;
    const size=Number(font.match(/([\d.]+)px/)[1]),w=Math.max(1,Math.min(c.measureText(text).width,maxWidth??Infinity));
    const image=bake(w+4,size*2,c=>{c.textAlign='center';c.textBaseline='middle';c.font=font;c.fillStyle=color;c.fillText(text,(w+4)/2,size,maxWidth);});
    labels.set(key,{texture:image.texture,used:frame});return image.texture;
  }
  function text(node,value,font,color,x,y,maxWidth){node.texture=label(value,font,color,maxWidth);node.anchor.set(.5);node.position.set(x,y);node.visible=!!value;}
  function clearScene(){
    heat?.destroy();heat=null;
    combo?.destroy({children:true});combo=null;
    if(scene){hole?.destroy();scene.destroy({children:true});scene=null;}
    for(const texture of textures)texture.destroy(true);
    textures=[];labels.clear();objectTextures.clear();sourceImages=new WeakMap();objectPool=[];particlePool=[];
  }
  function resize(next){
    if(destroyed)return;config=next;clearScene();
    const {width,height,ratio,camera,reduced,backdrop,stars}=config;
    app.renderer.resize(width,height,ratio);
    scene=new Container();app.stage.addChild(scene);
    background=sprite(makeTexture(backdrop));background.width=width;background.height=height;
    starSprites=stars.map(star=>{const s=sprite(Texture.WHITE);s.tint=star.layer===3?0xbca7ff:0xbfe6ff;s.width=s.height=star.size;return s;});
    // The phase wash's changing color is a tint uniform over a fixed white radial texture.
    const wash=bake(width,height,c=>{const g=c.createRadialGradient(width*.6,height*.5,0,width*.6,height*.5,Math.max(width,height)*.8);g.addColorStop(0,'#ffffff');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,width,height);});
    scene.wash=sprite(wash.texture);scene.wash.alpha=.22;
    hole=createHoleScene({width,height,ratio,camera,reduced});scene.addChild(hole.stage);
    scene.objects=new Container();scene.addChild(scene.objects);
    phaseGraphics=new Graphics();scene.addChild(phaseGraphics);
    phaseLabels=new Container();scene.addChild(phaseLabels);for(let i=0;i<3;i++)sprite(Texture.EMPTY,phaseLabels);
    ship=new Container();scene.addChild(ship);shipTurn=new Container();
    const size=rocketSize(camera.r),pad=Math.ceil(size*2+60);
    ready=centered(pad,pad,c=>drawPhaseReady(c,size,100,0,1/2.4,reduced),ship).s;
    warning=new Container();ship.addChild(warning);
    const warningArt=centered(pad,pad,c=>{c.strokeStyle='#ffbc86';c.lineWidth=2;c.beginPath();c.moveTo(-7,-size*.65);c.lineTo(0,-size*.78);c.lineTo(7,-size*.65);c.stroke();},warning).s;
    warningArt.visible=true;
    const warningText=sprite(Texture.EMPTY,warning);text(warningText,'BOOST TO COOL','700 10px system-ui','#ffcca7',0,size*.78+10-3);
    shield=centered(pad,pad,c=>{c.strokeStyle='#beacff';c.lineWidth=2;c.shadowColor='#a18aff';c.shadowBlur=reduced?0:22;c.beginPath();c.arc(0,0,size*.48,0,TAU);c.stroke();},ship).s;
    ship.addChild(shipTurn);flame=new Graphics();shipTurn.addChild(flame);
    rocketFallback=new Graphics().poly([size*.4,0,-size*.3,-size*.2,-size*.2,size*.2],true).fill(0x75efff);shipTurn.addChild(rocketFallback);
    rocketSprite=sprite(Texture.EMPTY,shipTurn);rocketSprite.anchor.set(.5);
    heat=createHeatMesh();shipTurn.addChild(heat.mesh);
    you=sprite(Texture.EMPTY,scene);text(you,'YOU','700 10px system-ui','#d6faff',0,0);
    scene.particles=new Container();scene.addChild(scene.particles);
    border=new Graphics().rect(3,3,width-6,height-6).stroke({color:0xff7556,width:6});scene.addChild(border);
    combo=new Container();app.stage.addChild(combo);for(let i=0;i<2;i++)sprite(Texture.EMPTY,combo);
  }
  function objectTexture(o){
    const rr=obstacleSize(config.camera.r,o.size),key=`${o.type}:${o.size}:${o.shape}`;
    let entry=objectTextures.get(key);
    if(!entry){const pad=Math.ceil(rr*3+60);const image=bake(pad,pad,c=>{c.translate(pad/2,pad/2);drawObjectArt(c,o,rr,config.reduced);});entry={texture:image.texture,used:frame};objectTextures.set(key,entry);}
    entry.used=frame;return entry.texture;
  }
  function objectNode(index){
    if(objectPool[index])return objectPool[index];
    const node=new Container(),trail=sprite(Texture.EMPTY,node),art=sprite(Texture.EMPTY,node),warningLine=new Graphics(),caption=sprite(Texture.EMPTY,node);
    art.anchor.set(.5);node.addChild(warningLine);scene.objects.addChild(node);
    return objectPool[index]={node,trail,art,warningLine,caption};
  }
  function drawObject(o,index){
    const item=objectNode(index),{node,trail,art,warningLine,caption}=item,{camera:g,width,height,reduced}=config;
    const crossing=o.type==='crosser',rr=obstacleSize(g.r,o.size);
    const x=crossing?g.cx+o.x*g.r:g.cx+Math.sin(o.angle)*o.radius*g.r;
    const y=crossing?g.cy+o.y*g.r:g.cy-Math.cos(o.angle)*o.radius*g.r;
    node.visible=true;node.position.set(x,y);art.visible=!(crossing&&o.warning>0);trail.visible=crossing&&o.warning<=0;warningLine.visible=caption.visible=crossing&&o.warning>0;
    if(warningLine.visible){
      const ex=clamp(x,18,width-18)-x,ey=clamp(y,110,height-105)-y,tx=g.cx-x,ty=g.cy+o.targetY*g.r-y;
      const dx=tx-ex,dy=ty-ey,length=Math.hypot(dx,dy);warningLine.clear();
      for(let d=0;d<length;d+=14){const end=Math.min(d+5,length);warningLine.moveTo(ex+dx*d/length,ey+dy*d/length).lineTo(ex+dx*end/length,ey+dy*end/length).stroke({color:0xffbf85,alpha:0x77/255,width:1.5});}
      warningLine.circle(ex,ey,7).fill(0xffbd80);
      caption.texture=label('INCOMING','700 10px system-ui','#ffe2bd');caption.anchor.set(o.vx>0?0:1,.5);caption.position.set(ex+(o.vx>0?12:-12),ey-15);
      return;
    }
    art.texture=objectTexture(o);art.rotation=o.spin;
    if(trail.visible){
      const length=reduced?rr*3:rr*7,key=`trail:${rr}:${length}`;let entry=objectTextures.get(key);
      if(!entry){const pad=rr*1.2+4,image=bake(length+pad,pad,c=>{const g=c.createLinearGradient(pad/2,0,length+pad/2,0);g.addColorStop(0,'#ff724400');g.addColorStop(1,'#ffc88dcc');c.strokeStyle=g;c.lineWidth=rr*1.2;c.lineCap='round';c.beginPath();c.moveTo(pad/2,pad/2);c.lineTo(length+pad/2,pad/2);c.stroke();});entry={texture:image.texture,used:frame,pad,length};objectTextures.set(key,entry);}
      entry.used=frame;trail.texture=entry.texture;trail.anchor.set((entry.length+entry.pad/2)/(entry.length+entry.pad),.5);trail.rotation=Math.atan2(o.vy,o.vx);
    }
  }
  function drawPhase(run,state,show){
    const {camera:g,reduced}=config;phaseGraphics.clear();phaseGraphics.position.set(g.cx,g.cy);phaseLabels.position.set(g.cx,g.cy);phaseLabels.visible=show&&!!run.specials.length;
    if(!run.specials.length)return;
    if(state.kinds.includes('tide')){const fraction=reduced?.5:(run.time*.35)%1;phaseGraphics.arc(0,0,g.r*(.95-fraction*.28),-Math.PI*.9,-Math.PI*.1).stroke({color:state.gravity>1?0x87bbb9:0x426f76,width:2});}
    if(state.beam!==null){phaseGraphics.beginPath().circle(0,0,state.beam*g.r).stroke({color:0xffe2a3,width:g.r*.036});phaseGraphics.beginPath().arc(0,0,g.r*.98,-Math.PI*.85,-Math.PI*.15).stroke({color:0xcab987,alpha:.4,width:1});}
    if(show){const stacked=state.kinds.length>1,parts=stacked?state.kinds.map(k=>phaseNames[k]):phaseNames[state.kind].split(' ');
      const font=`750 ${Math.max(12,Math.min(stacked?18:24,g.r*.064))}px system-ui`;
      text(phaseLabels.children[0],parts[0],font,'#eee7da',0,-18,g.r*.72);text(phaseLabels.children[1],parts.slice(1).join(' '),font,'#eee7da',0,2,g.r*.72);
      const cue=state.beam!==null?'CLIMB OUTWARD':state.gravity>1?'PULL +15%':stacked?'DOUBLE PRESSURE':state.kind==='convoy'?'RIDE THE STAIRCASE':'NORMAL PULL';
      text(phaseLabels.children[2],cue,`600 ${Math.max(9,Math.min(13,g.r*.042))}px system-ui`,'#b9cbd5',0,25,g.r*.62);
    }
  }
  function render({run,mode,watching,boost,flying,t,dt,phase,particles,shake,comboUntil,comboText,rocket}){
    if(lost||destroyed||!scene)return;frame++;
    const {camera:g,width,height,reduced,stars}=config;
    scene.position.set(shake>0&&!reduced?Math.sin(t*100)*shake:0,shake>0&&!reduced?Math.cos(t*87)*shake:0);
    for(let i=0;i<stars.length;i++){const star=stars[i],s=starSprites[i],drift=reduced?0:t*star.layer*1.6;s.position.set((star.x*width-drift%width+width)%width,star.y*height);s.alpha=.35+Math.sin(t*.7+star.phase)*.18+star.layer*.11;}
    const kinds=phase.kinds.length?phase.kinds:[phase.kind],target=kinds.map(k=>palettes[k]??palettes.orbit),blend=reduced?1:1-Math.exp(-dt*.9);
    for(let i=0;i<3;i++)tint[i]+=(target.reduce((s,c)=>s+c[i],0)/target.length-tint[i])*blend;
    scene.wash.tint=(Math.round(tint[0])<<16)|(Math.round(tint[1])<<8)|Math.round(tint[2]);hole.render(t);
    let index=0;if(mode!=='intro'){for(const o of run.objects)drawObject(o,index++);for(const o of run.crossers)drawObject(o,index++);}
    for(let i=index;i<objectPool.length;i++)objectPool[i].node.visible=false;
    drawPhase(run,phase,mode!=='intro'&&t>=comboUntil);phaseGraphics.visible=mode!=='intro';
    const x=g.cx,y=g.cy-run.radius*g.r,size=rocketSize(g.r);
    ship.visible=!(mode==='dead'||(watching&&!run.alive));ship.position.set(x,y);
    const pulse=reduced?0:(1+Math.sin(t*Math.PI*1.2))/2;
    ready.visible=run.energy>=100&&run.phase<=0;ready.scale.set(reduced?1:(.59+pulse*.025)/.615);ready.alpha=.8+pulse*.2;
    warning.visible=run.heat>=65;shield.visible=run.phase>0;
    text(warning.children[1],'BOOST TO COOL','700 10px system-ui','#ffcca7',0,size*.78+7);
    text(you,'YOU','700 10px system-ui','#d6faff',0,0);
    const tremble=rocketTremble(run.multiplier,run.time,reduced);shipTurn.position.set(tremble.x,tremble.y);shipTurn.rotation=Math.PI*.23-run.velocity*.6+tremble.angle;
    flame.clear();if(boost&&flying)flame.moveTo(-size*.24,size*.28).lineTo(-size*(.60+Math.sin(t*60)*.05),size*.60).lineTo(-size*.13,size*.36).closePath().fill(0xa0faff);
    rocketFallback.visible=!(rocket.complete&&rocket.naturalWidth);
    if(rocket.complete&&rocket.naturalWidth){let texture=sourceImages.get(rocket);if(!texture){texture=new Texture({source:new ImageSource({resource:rocket})});textures.push(texture);sourceImages.set(rocket,texture);}rocketSprite.texture=texture;rocketSprite.width=rocketSprite.height=size;}
    heat.update(size,visualHeat(run.heat,run.multiplier),run.time,reduced);
    you.visible=flying&&run.time<8&&ship.visible;you.position.set(x,y-size*.55-3);
    for(let i=0;i<particles.length;i++){const p=particles[i];let s=particlePool[i];if(!s){s=sprite(Texture.WHITE,scene.particles);particlePool.push(s);}s.visible=true;s.position.set(p.x,p.y);s.width=s.height=p.size;s.tint=p.color;s.alpha=Math.max(0,p.life/p.max);}
    for(let i=particles.length;i<particlePool.length;i++)particlePool[i].visible=false;
    border.visible=flying&&run.heat>65;border.alpha=(run.heat-65)/90;
    combo.visible=mode==='playing'&&t<comboUntil;
    if(combo.visible){const font=`700 ${clamp(g.r*.065,13,28)}px system-ui`;text(combo.children[0],'CLOSE CALL',font,'#9af3ff',g.cx,g.cy-13,g.r*.55);text(combo.children[1],comboText,font,'#f3f7fa',g.cx,g.cy+15,g.r*.55);}
    app.render();
    // Drop artwork after it leaves the scene; no unbounded per-run texture cache.
    for(const [key,entry] of objectTextures)if(entry.used!==frame){objectTextures.delete(key);retire(entry.texture);}
    for(const [key,entry] of labels)if(frame-entry.used>600){labels.delete(key);retire(entry.texture);}
  }
  function retire(texture){const index=textures.indexOf(texture);if(index>=0)textures.splice(index,1);texture.destroy(true);}
  const contextLost=e=>{e.preventDefault();lost=true;onLost();};
  const contextRestored=()=>{if(destroyed)return;lost=false;if(config)resize(config);onRestored();};
  canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);
  return {app,resize,render,stats(){return {textures:textures.length,objects:objectPool.length,particles:particlePool.length,stageChildren:app.stage.children.length,textureBytes:textures.reduce((sum,t)=>sum+t.source.pixelWidth*t.source.pixelHeight*4,0)+(hole?.textureBytes??0)};},get lost(){return lost;},destroy(){if(destroyed)return;destroyed=true;canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);clearScene();app.destroy({removeView:false,releaseGlobalResources:true});}};
}
