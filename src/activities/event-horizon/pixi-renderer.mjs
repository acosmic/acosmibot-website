import { debrisOpacity, tideStrength } from './tide-fx.mjs';
import {createHeatMesh} from './pixi-heat.mjs';
import { Application, CanvasSource, Container, Graphics, ImageSource, Rectangle, Sprite, Texture } from 'pixi.js';
import { createHoleScene } from './pixi-hole.mjs';
import { drawObjectArt } from './object-art.mjs';
import { drawPhaseReady, rocketTremble, visualHeat } from './heat-fx.mjs';
import { rocketSize, obstacleSize } from './camera.mjs';
import { phaseNames } from './phases-fx.mjs';
import { createBloomFilter, createLensFilter, createPostFilter } from './post-fx.mjs';
import { createFlameMesh } from './pixi-shaders.mjs';
import { drawChevron, drawCone, drawGalaxy, drawGlow, drawNebula, drawReticle, drawRim, drawRing, drawSpark, drawSpeedLines, drawStar, seeded } from './vfx-art.mjs';
import { createQuality, easeInCubic, easeOutCubic, popScale, sampleQuality, shakeOffset, TIERS } from './juice.mjs';
const palettes={orbit:[9,25,48],asteroids:[85,40,20],convoy:[49,40,74],tide:[12,65,65],pulsar:[30,24,61]};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const TAU=Math.PI*2;
export const FONT='"Chakra Petch", system-ui, sans-serif';
// Rocket-local nozzle and exhaust direction, matching the rocket artwork.
const NOZZLE_X=-.185,NOZZLE_Y=.32,FLAME_ANGLE=2.547;
// Soft gradients are baked near display density: an upscaled low-res bake magnifies
// the browser's gradient dithering into a visible grid on high-DPI screens.
const NEBULA_RES=1.5;
const TRAIL_SECONDS=.5,GHOST_SECONDS=.32,DIVE_SECONDS=1.1;

// Raster artwork is baked once and moved as retained GPU sprites. Animated
// arcs, disk, flame, and nose heat use retained GPU geometry; no per-frame
// bitmap uploads. Post-processing is tiered and only ever changes pixels.
export async function createFlightRenderer(canvas,{onLost=()=>{},onRestored=()=>{}}={}){
  const app=new Application();
  await app.init({canvas,preference:'webgl',autoStart:false,antialias:true,
    autoDensity:false,background:0x050812,resolution:1});
  app.stage.eventMode='none';app.stage.interactiveChildren=false;
  const lens=createLensFilter(),post=createPostFilter(),bloom=createBloomFilter();
  let quality=createQuality('high'),tier='high';
  let config,scene,hole,holeGlow,bg,world,ui,overlay,background,nebulaFar,nebulaNear,comet,starSprites=[],objectPool=[],particlePool=[];
  let phaseGraphics,phaseLabels,godRays,beamGlow,storm,ship,shipTurn,rocketSprite,rocketFallback,heat,ready,shield,warning,you,flame,engineGlow,border,combo,trail,ghosts,speedLines,flash;
  let tex={},rocketTexture=null;
  let textures=[],objectTextures=new Map(),labels=new Map(),sourceImages=new WeakMap();
  let tint=[...palettes.orbit],frame=0,lost=false,destroyed=false;
  let trailPoints=[],ghostData=[],lastGhost=0,boostLevel=0,prevMode='intro',diveStart=-10,nextComet=12,cometStart=-10,cometPath=null;
  const makeTexture=(buffer,resolution=1)=>{
    const texture=new Texture({source:new CanvasSource({resource:buffer,resolution})});textures.push(texture);return texture;
  };
  function bake(w,h,draw,ratio=config.ratio){
    const buffer=document.createElement('canvas');
    buffer.width=Math.max(1,Math.ceil(w*ratio));buffer.height=Math.max(1,Math.ceil(h*ratio));
    const ctx=buffer.getContext('2d');ctx.scale(ratio,ratio);draw(ctx);
    return {buffer,ctx,texture:makeTexture(buffer,ratio)};
  }
  function sprite(texture,parent=world){const s=new Sprite(texture);parent.addChild(s);return s;}
  function centered(w,h,draw,parent=world){const image=bake(w,h,c=>{c.translate(w/2,h/2);draw(c);});const s=sprite(image.texture,parent);s.anchor.set(.5);return {s,...image};}
  function label(text,font,color,maxWidth){
    const key=JSON.stringify([text,font,color,maxWidth]);let entry=labels.get(key);if(entry){entry.used=frame;return entry.texture;}
    const c=document.createElement('canvas').getContext('2d');c.font=font;
    const size=Number(font.match(/([\d.]+)px/)[1]),w=Math.max(1,Math.min(c.measureText(text).width,maxWidth??Infinity));
    const image=bake(w+12,size*2,c=>{c.textAlign='center';c.textBaseline='middle';c.font=font;c.shadowColor='rgba(0,0,0,.65)';c.shadowBlur=6;c.fillStyle=color;c.fillText(text,(w+12)/2,size,maxWidth);});
    labels.set(key,{texture:image.texture,used:frame});return image.texture;
  }
  function text(node,value,font,color,x,y,maxWidth){node.texture=label(value,font,color,maxWidth);node.anchor.set(.5);node.position.set(x,y);node.visible=!!value;}
  function clearScene(){
    heat?.destroy();heat=null;flame?.destroy();flame=null;
    if(scene){hole?.destroy();scene.filters=null;bg.filters=null;holeGlow.filters=null;scene.destroy({children:true});scene=null;}
    for(const texture of textures)texture.destroy(true);
    textures=[];labels.clear();objectTextures.clear();sourceImages=new WeakMap();objectPool=[];particlePool=[];rocketTexture=null;
    trailPoints=[];ghostData=[];
  }
  // Quality tiers: high = bloom + post + lensing + disk; medium = no bloom; low = none.
  function applyTier(){
    if(!scene)return;
    const max=config.reduced?'medium':'high';
    const effective=TIERS[Math.min(TIERS.indexOf(tier),TIERS.indexOf(max))];
    scene.filters=effective==='low'?null:[post.filter];
    bg.filters=effective==='low'?null:[lens.filter];
    // Bloom is reserved for the black hole; gameplay sprites stay crisp.
    holeGlow.filters=effective==='high'?[bloom]:null;
    if(hole.disk)hole.disk.mesh.visible=effective!=='low';
    scene.tier=effective;
  }
  function resize(next){
    if(destroyed)return;config=next;clearScene();
    const {width,height,ratio,camera,reduced,backdrop,stars}=config;
    app.renderer.resize(width,height,ratio);
    const screenArea=new Rectangle(0,0,width,height);
    scene=new Container();app.stage.addChild(scene);scene.filterArea=screenArea;
    bg=new Container();scene.addChild(bg);bg.filterArea=screenArea;
    world=new Container();scene.addChild(world);
    ui=new Container();scene.addChild(ui);
    overlay=new Container();scene.addChild(overlay);
    tex.glow=bake(64,64,c=>drawGlow(c,64),1).texture;
    tex.spark=bake(64,12,c=>drawSpark(c,64,12),1).texture;
    tex.star=bake(32,32,c=>drawStar(c,32),1).texture;
    tex.ring=bake(256,256,c=>drawRing(c,256),1).texture;
    tex.cone=bake(256,64,c=>drawCone(c,256,64),1).texture;
    tex.chevron=bake(40,40,c=>drawChevron(c,40)).texture;
    tex.reticle=bake(48,48,c=>drawReticle(c,48)).texture;
    // Background (lensed): base gradient, two drifting painted nebulae, galaxies, stars, comet.
    background=sprite(makeTexture(backdrop),bg);background.width=width;background.height=height;
    const nw=width*1.25,nh=height*1.25;
    nebulaFar=sprite(bake(nw,nh,c=>{drawNebula(c,nw,nh,11,0,1);const rand=seeded(5);for(let i=0;i<3;i++){c.save();c.translate(rand()*nw,rand()*nh);drawGalaxy(c,40+rand()*50,i+3);c.restore();}},NEBULA_RES).texture,bg);
    nebulaNear=sprite(bake(nw,nh,c=>drawNebula(c,nw,nh,29,1,.6),NEBULA_RES).texture,bg);nebulaNear.blendMode='add';nebulaNear.alpha=.5;
    for(const n of [nebulaFar,nebulaNear])n.anchor.set(.5);
    starSprites=stars.map((star,i)=>{const s=sprite(tex.star,bg);s.anchor.set(.5);s.blendMode='add';
      const bright=!reduced&&i%17===0;s.tint=star.layer===3?0xc9b6ff:i%5===0?0xffe6c8:0xcfeeff;s.width=s.height=star.size*(bright?9:4.2);s.bright=bright;return s;});
    comet=sprite(tex.spark,bg);comet.anchor.set(1,.5);comet.blendMode='add';comet.visible=false;comet.tint=0xd8f4ff;
    const wash=bake(width,height,c=>{const g=c.createRadialGradient(width*.6,height*.5,0,width*.6,height*.5,Math.max(width,height)*.8);g.addColorStop(0,'#ffffff');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,width,height);},NEBULA_RES);
    scene.wash=sprite(wash.texture,bg);scene.wash.width=width;scene.wash.height=height;scene.wash.alpha=.22;
    // World: god rays, bloomed hole, objects, trail, ship, particles.
    godRays=new Container();world.addChild(godRays);
    for(let i=0;i<3;i++){const s=sprite(tex.cone,godRays);s.anchor.set(0,.5);s.blendMode='add';s.tint=0xfff0c8;}
    godRays.position.set(camera.cx,camera.cy);godRays.visible=false;
    holeGlow=new Container();world.addChild(holeGlow);
    hole=createHoleScene({width,height,ratio,camera,reduced});holeGlow.addChild(hole.stage);
    beamGlow=sprite(tex.ring,world);beamGlow.anchor.set(.5);beamGlow.blendMode='add';beamGlow.tint=0xffd98f;beamGlow.position.set(camera.cx,camera.cy);beamGlow.visible=false;
    scene.objects=new Container();world.addChild(scene.objects);
    phaseGraphics=new Graphics();world.addChild(phaseGraphics);
    trail=new Graphics();trail.blendMode='add';world.addChild(trail);
    ghosts=new Container();world.addChild(ghosts);
    for(let i=0;i<10;i++){const s=sprite(Texture.EMPTY,ghosts);s.anchor.set(.5);s.blendMode='add';s.tint=0xa98bff;s.visible=false;}
    ship=new Container();world.addChild(ship);shipTurn=new Container();
    const size=rocketSize(camera.r),pad=Math.ceil(size*2+60);
    ready=centered(pad,pad,c=>drawPhaseReady(c,size,100,0,1/2.4,reduced),ship).s;
    warning=new Container();ship.addChild(warning);
    const warningArt=centered(pad,pad,c=>{c.strokeStyle='#ffbc86';c.lineWidth=2;c.beginPath();c.moveTo(-7,-size*.65);c.lineTo(0,-size*.78);c.lineTo(7,-size*.65);c.stroke();},warning).s;
    warningArt.visible=true;
    const warningText=sprite(Texture.EMPTY,warning);text(warningText,'BOOST TO COOL',`700 10px ${FONT}`,'#ffcca7',0,size*.78+10-3);
    shield=centered(pad,pad,c=>{c.strokeStyle='#beacff';c.lineWidth=2;c.shadowColor='#a18aff';c.shadowBlur=reduced?0:22;c.beginPath();c.arc(0,0,size*.48,0,TAU);c.stroke();},ship).s;
    ship.addChild(shipTurn);
    engineGlow=sprite(tex.glow,shipTurn);engineGlow.anchor.set(.5);engineGlow.blendMode='add';engineGlow.tint=0x59e8ff;engineGlow.position.set(NOZZLE_X*size,NOZZLE_Y*size);
    flame=createFlameMesh();shipTurn.addChild(flame.mesh);flame.mesh.position.set(NOZZLE_X*size,NOZZLE_Y*size);flame.mesh.rotation=FLAME_ANGLE;
    rocketFallback=new Graphics().poly([size*.4,0,-size*.3,-size*.2,-size*.2,size*.2],true).fill(0x75efff);shipTurn.addChild(rocketFallback);
    rocketSprite=sprite(Texture.EMPTY,shipTurn);rocketSprite.anchor.set(.5);
    heat=createHeatMesh();shipTurn.addChild(heat.mesh);
    scene.particles=new Container();world.addChild(scene.particles);
    storm=new Container();world.addChild(storm);storm.visible=false;
    for(let i=0;i<24;i++){const s=sprite(tex.spark,storm);s.anchor.set(.5);s.blendMode='add';s.tint=0xffb27a;}
    // UI (unbloomed, follows world shake): persistent phase label, combo, YOU marker.
    phaseLabels=new Container();ui.addChild(phaseLabels);for(let i=0;i<3;i++)sprite(Texture.EMPTY,phaseLabels);
    you=sprite(Texture.EMPTY,ui);text(you,'YOU',`700 11px ${FONT}`,'#d6faff',0,0);
    combo=new Container();ui.addChild(combo);for(let i=0;i<2;i++){const s=sprite(Texture.EMPTY,combo);s.anchor.set(.5);}
    // Overlay (screen space): speed lines, flash, low-tier heat border.
    speedLines=sprite(bake(width,height,c=>drawSpeedLines(c,width,height),.5).texture,overlay);speedLines.anchor.set(.5);speedLines.position.set(width/2,height/2);speedLines.blendMode='add';speedLines.visible=false;
    flash=sprite(Texture.WHITE,overlay);flash.width=width;flash.height=height;flash.blendMode='add';flash.visible=false;
    border=new Graphics().rect(3,3,width-6,height-6).stroke({color:0xff7556,width:6});overlay.addChild(border);
    applyTier();
  }
  function objectTexture(key,size,draw){
    let entry=objectTextures.get(key);
    if(!entry){const image=bake(size,size,c=>{c.translate(size/2,size/2);draw(c);});entry={texture:image.texture,used:frame};objectTextures.set(key,entry);}
    entry.used=frame;return entry.texture;
  }
  function objectNode(index){
    if(objectPool[index])return objectPool[index];
    const node=new Container(),trailSprite=sprite(Texture.EMPTY,node),aura=sprite(Texture.EMPTY,node),art=sprite(Texture.EMPTY,node),rim=sprite(Texture.EMPTY,node);
    const warningLine=new Graphics(),chevron=new Sprite(tex.chevron),reticle=new Sprite(tex.reticle),caption=new Sprite(Texture.EMPTY);
    for(const s of [art,aura,rim,chevron,reticle])s.anchor.set(.5);
    aura.blendMode=rim.blendMode='add';
    node.addChild(warningLine,chevron,reticle,caption);scene.objects.addChild(node);
    return objectPool[index]={node,trail:trailSprite,aura,art,rim,warningLine,chevron,reticle,caption};
  }
  function drawObject(o,index,t){
    const item=objectNode(index),{node,trail:streak,aura,art,rim,warningLine,chevron,reticle,caption}=item,{camera:g,width,height,reduced}=config;
    const crossing=o.type==='crosser',rr=obstacleSize(g.r,o.size);
    const x=crossing?g.cx+o.x*g.r:g.cx+Math.sin(o.angle)*o.radius*g.r;
    const y=crossing?g.cy+o.y*g.r:g.cy-Math.cos(o.angle)*o.radius*g.r;
    const warn=crossing&&o.warning>0;
    node.visible=true;node.alpha=debrisOpacity(o);node.position.set(x,y);
    art.visible=!warn;streak.visible=crossing&&!warn;warningLine.visible=chevron.visible=reticle.visible=caption.visible=warn;
    if(warn){
      const ex=clamp(x,22,width-22)-x,ey=clamp(y,110,height-105)-y,tx=g.cx-x,ty=g.cy+o.targetY*g.r-y;
      const dx=tx-ex,dy=ty-ey,length=Math.hypot(dx,dy),pulse=reduced?1:.65+.35*Math.sin(t*14);warningLine.clear();
      for(let d=0;d<length;d+=14){const end=Math.min(d+5,length);warningLine.moveTo(ex+dx*d/length,ey+dy*d/length).lineTo(ex+dx*end/length,ey+dy*end/length).stroke({color:0xffbf85,alpha:.42,width:1.5});}
      chevron.position.set(ex,ey);chevron.rotation=Math.atan2(o.vy,o.vx);chevron.alpha=pulse;chevron.scale.set(reduced?1:1+.12*Math.sin(t*14));
      reticle.position.set(tx,ty);reticle.rotation=reduced?0:t*2.2;reticle.scale.set(1+Math.min(o.warning,1.2)*.55);reticle.alpha=.55+.45*pulse;
      caption.texture=label('INCOMING',`700 11px ${FONT}`,'#ffe2bd');caption.anchor.set(o.vx>0?0:1,.5);caption.position.set(ex+(o.vx>0?16:-16),ey-17);
      aura.visible=rim.visible=false;return;
    }
    const pad=Math.ceil(rr*3+60);
    art.texture=objectTexture(`${o.type}:${o.size}:${o.shape}`,pad,c=>drawObjectArt(c,o,rr,config.reduced));art.rotation=o.spin;
    const rock=o.type!=='shard'&&o.type!=='plasma';
    rim.visible=rock;aura.visible=!rock;
    if(rock){rim.texture=objectTexture(`rim:${rr}`,Math.ceil(rr*2.6+8),c=>drawRim(c,rr));rim.rotation=Math.atan2(g.cy-y,g.cx-x);rim.alpha=.55;}
    else if(o.type==='shard'){aura.texture=tex.star;aura.tint=0xa6f7ff;const s=rr*3.2*(reduced?1:.85+.25*Math.sin(t*6+o.shape*10));aura.width=aura.height=s;aura.rotation=reduced?0:t*.8;aura.alpha=.35;}
    else{aura.texture=tex.glow;aura.tint=0xff4f7d;const s=rr*2.6*(reduced?1:1+.1*Math.sin(t*5+o.shape));aura.width=aura.height=s;aura.alpha=.28;}
    if(streak.visible){
      const length=reduced?rr*3:rr*7,key=`trail:${rr}:${length}`;let entry=objectTextures.get(key);
      if(!entry){const pad=rr*1.2+4,image=bake(length+pad,pad,c=>{const gr=c.createLinearGradient(pad/2,0,length+pad/2,0);gr.addColorStop(0,'#ff724400');gr.addColorStop(.7,'#ff9a5a99');gr.addColorStop(1,'#ffe0b8ee');c.strokeStyle=gr;c.lineWidth=rr*1.2;c.lineCap='round';c.beginPath();c.moveTo(pad/2,pad/2);c.lineTo(length+pad/2,pad/2);c.stroke();});entry={texture:image.texture,used:frame,pad,length};objectTextures.set(key,entry);}
      entry.used=frame;streak.texture=entry.texture;streak.anchor.set((entry.length+entry.pad/2)/(entry.length+entry.pad),.5);streak.rotation=Math.atan2(o.vy,o.vx);streak.blendMode='add';
    }
  }
  function drawPhase(run,state,show,t){
    const {camera:g,reduced}=config;phaseGraphics.clear();phaseGraphics.position.set(g.cx,g.cy);phaseLabels.position.set(g.cx,g.cy);phaseLabels.visible=show&&!!run.specials.length;
    const pulsar=show&&!reduced&&state.kinds?.includes('pulsar');
    godRays.visible=pulsar;
    if(pulsar)godRays.children.forEach((s,i)=>{s.rotation=t*.18+i*TAU/3;s.width=g.r*1.7;s.height=g.r*.5;s.alpha=.10+.04*Math.sin(t*2+i);});
    beamGlow.visible=show&&state.beam!==null;
    if(!run.specials.length)return;
    if(state.beam!==null){
      const d=state.beam*g.r*2*1.13;beamGlow.width=beamGlow.height=d;beamGlow.alpha=reduced?.3:.32+.08*Math.sin(t*9);
      phaseGraphics.beginPath().circle(0,0,state.beam*g.r).stroke({color:0xffe2a3,width:g.r*.036});phaseGraphics.beginPath().arc(0,0,g.r*.98,-Math.PI*.85,-Math.PI*.15).stroke({color:0xcab987,alpha:.4,width:1});
    }
    if(show){const stacked=state.kinds.length>1,parts=stacked?state.kinds.map(k=>phaseNames[k]):phaseNames[state.kind].split(' ');
      const font=`700 ${Math.max(12,Math.min(stacked?18:24,g.r*.064))}px ${FONT}`;
      text(phaseLabels.children[0],parts[0],font,'#eee7da',0,-18,g.r*.72);text(phaseLabels.children[1],parts.slice(1).join(' '),font,'#eee7da',0,2,g.r*.72);
      const cue=state.beam!==null?'CLIMB OUTWARD':state.gravity>1?'STRONG PULL +15%':stacked?'DOUBLE PRESSURE':state.kind==='convoy'?'RIDE THE STAIRCASE':'NORMAL PULL';
      text(phaseLabels.children[2],cue,`${state.gravity>1?700:600} ${Math.max(11,Math.min(18,g.r*.052))}px ${FONT}`,state.gravity>1?'#ffd099':'#b9cbd5',0,30,g.r*.72);
    }
  }
  function drawBackground(t,dt,offset,reduced,kinds){
    const {width,height,stars}=config;
    bg.position.set(offset.x*.25,offset.y*.25);
    const drift=reduced?0:t;
    nebulaFar.position.set(width/2+Math.sin(drift*.011)*width*.08,height/2+Math.cos(drift*.008)*height*.06);
    nebulaNear.position.set(width/2+Math.sin(drift*.019+1)*width*.11,height/2+Math.cos(drift*.015+2)*height*.08);
    for(let i=0;i<stars.length;i++){const star=stars[i],s=starSprites[i],d=reduced?0:t*star.layer*1.6;s.position.set((star.x*width-d%width+width)%width,star.y*height);
      s.alpha=Math.min(1,.35+Math.sin(t*.7+star.phase)*.18+star.layer*.11+(s.bright?.2:0));if(s.bright&&!reduced)s.rotation=Math.sin(t*.3+i)*.3;}
    if(!reduced&&t>nextComet&&!cometPath){const rand=Math.random;cometStart=t;cometPath={x0:width*(.4+rand()*.7),y0:-40,x1:-width*.2,y1:height*(.3+rand()*.5)};nextComet=t+18+rand()*20;}
    if(cometPath){const p=(t-cometStart)/2.6;if(p>=1){cometPath=null;comet.visible=false;}else{
      const e=easeOutCubic(p)*.3+p*.7,x=cometPath.x0+(cometPath.x1-cometPath.x0)*e,y=cometPath.y0+(cometPath.y1-cometPath.y0)*e;
      comet.visible=true;comet.position.set(x,y);comet.rotation=Math.atan2(cometPath.y1-cometPath.y0,cometPath.x1-cometPath.x0);comet.width=Math.min(width*.22,180);comet.height=3;comet.alpha=Math.sin(p*Math.PI)*.85;}}
    const target=kinds.map(k=>palettes[k]??palettes.orbit),blend=reduced?1:1-Math.exp(-dt*.9);
    for(let i=0;i<3;i++)tint[i]+=(target.reduce((s,c)=>s+c[i],0)/target.length-tint[i])*blend;
    scene.wash.tint=(Math.round(tint[0])<<16)|(Math.round(tint[1])<<8)|Math.round(tint[2]);
    post.blendGrade(kinds,blend);
  }
  function drawTrail(t,flying,boost,run,x,y,size,rotation){
    const {camera:g,reduced}=config;
    const nx=x+(Math.cos(rotation)*NOZZLE_X-Math.sin(rotation)*NOZZLE_Y)*size,ny=y+(Math.sin(rotation)*NOZZLE_X+Math.cos(rotation)*NOZZLE_Y)*size;
    if(flying&&!reduced)trailPoints.push({y:ny,t,boost:boost?1:0,phase:run.phase>0});
    while(trailPoints.length&&t-trailPoints[0].t>TRAIL_SECONDS)trailPoints.shift();
    if(!flying)trailPoints.length=0;
    trail.clear();if(trailPoints.length<2)return;
    const speed=g.r*.9;
    for(let i=trailPoints.length-1;i>0;i--){
      const a=trailPoints[i],b=trailPoints[i-1],ageA=(t-a.t)/TRAIL_SECONDS,ageB=(t-b.t)/TRAIL_SECONDS;
      const ax=nx-(t-a.t)*speed,bx=nx-(t-b.t)*speed,wa=size*.11*(1-ageA),wb=size*.11*(1-ageB);
      const alpha=(1-ageA)*(.18+.4*a.boost);if(alpha<=.01)continue;
      trail.poly([ax,a.y-wa,bx,b.y-wb,bx,b.y+wb,ax,a.y+wa]).fill({color:a.phase?0xa98bff:0x4fe4ff,alpha});
    }
  }
  function drawGhosts(t,run,flying,x,y,rotation,size){
    const {camera:g,reduced}=config;
    if(flying&&!reduced&&run.phase>0&&rocketTexture&&t-lastGhost>.045){lastGhost=t;ghostData.push({x,y,rotation,t0:t});if(ghostData.length>ghosts.children.length)ghostData.shift();}
    ghostData=ghostData.filter(gh=>t-gh.t0<GHOST_SECONDS);
    ghosts.children.forEach((s,i)=>{const gh=ghostData[i];s.visible=!!gh;if(!gh)return;const age=(t-gh.t0)/GHOST_SECONDS;
      s.texture=rocketTexture;s.width=s.height=size;s.position.set(gh.x-(t-gh.t0)*g.r*.9,gh.y);s.rotation=gh.rotation;s.alpha=.5*(1-age);});
  }
  function drawParticles(particles){
    for(let i=0;i<particles.length;i++){
      const p=particles[i];let s=particlePool[i];if(!s){s=sprite(tex.glow,scene.particles);s.anchor.set(.5);particlePool.push(s);}
      const life=Math.max(0,p.life/p.max),kind=p.kind||'glow';s.visible=true;s.position.set(p.x,p.y);s.tint=p.color;
      if(kind==='spark'){s.texture=tex.spark;s.blendMode='add';s.rotation=Math.atan2(p.vy,p.vx);const speed=Math.hypot(p.vx,p.vy);s.width=Math.max(p.size*2.5,speed*.07);s.height=p.size*1.3;s.alpha=life;}
      else if(kind==='ring'){s.texture=tex.ring;s.blendMode='add';s.rotation=0;const d=p.size*easeOutCubic(1-life);s.width=s.height=d;s.alpha=life*.9;}
      else if(kind==='smoke'){s.texture=tex.glow;s.blendMode='normal';s.rotation=0;s.width=s.height=p.size*(1+(1-life)*1.5);s.alpha=life*.35;}
      else{s.texture=tex.glow;s.blendMode='add';s.rotation=0;s.width=s.height=p.size*2.2;s.alpha=life*.8;}
    }
    for(let i=particles.length;i<particlePool.length;i++)particlePool[i].visible=false;
  }
  function render({run,mode,watching,boost,flying,t,dt,frameMs=16.7,phase,particles,comboUntil,comboText,rocket,juice,death}){
    if(lost||destroyed||!scene)return;frame++;
    const {camera:g,width,height,reduced}=config;
    const nextTier=sampleQuality(quality,frameMs);if(nextTier!==tier){tier=nextTier;applyTier();}
    if(mode==='ready'&&(prevMode==='intro'||prevMode==='dead'))diveStart=t;
    prevMode=mode;
    const offset=juice?shakeOffset(juice,t,reduced):{x:0,y:0,rotation:0};
    const kinds=phase.kinds.length?phase.kinds:[phase.kind];
    drawBackground(t,dt,offset,reduced,kinds);
    const x=g.cx,size=rocketSize(g.r);let y=g.cy-run.radius*g.r;
    // Camera: lobby wide shot, dive into orbit on launch, punch toward the ship.
    const dive=reduced?0:1-easeOutCubic((t-diveStart)/DIVE_SECONDS);
    const intro=mode==='intro'&&!reduced?.92+.012*Math.sin(t*.25):1;
    const scale=(mode==='intro'?intro:1-.08*dive)+(juice&&!reduced?juice.zoom:0);
    const pivotX=dive>.01||mode==='intro'?g.cx:x,pivotY=dive>.01||mode==='intro'?g.cy:y;
    for(const layer of [world,ui]){layer.pivot.set(pivotX,pivotY);layer.position.set(pivotX+offset.x,pivotY+offset.y);layer.scale.set(scale);layer.rotation=offset.rotation;}
    hole.render(t,run);
    let index=0;if(mode!=='intro'){for(const o of run.objects)drawObject(o,index++,t);for(const o of run.crossers)drawObject(o,index++,t);}
    for(let i=index;i<objectPool.length;i++)objectPool[i].node.visible=false;
    drawPhase(run,phase,mode!=='intro',t);phaseGraphics.visible=mode!=='intro';
    storm.visible=mode!=='intro'&&!reduced&&kinds.includes('asteroids');
    if(storm.visible)storm.children.forEach((s,i)=>{const r=seeded(i*7+1),speed=width*(.9+r()*.8),span=width+300,px=width+150-((r()*span+t*speed)%span),py=((r()*height+t*speed*.35)%(height+100))-50;
      s.position.set(px,py);s.rotation=Math.atan2(.35,-1);s.width=30+r()*60;s.height=1.6;s.alpha=.22;});
    // Ship, including the death sequence: spaghettification into the hole, or a hard break-up.
    let deathProgress=0;
    if(mode==='dead'&&death)deathProgress=clamp((t-death.t0)/.95,0,1);
    const spaghetti=mode==='dead'&&death?.fell&&deathProgress<1&&!reduced;
    ship.visible=spaghetti||!(mode==='dead'||(watching&&!run.alive));
    if(spaghetti){const e=easeInCubic(deathProgress);y=death.y+(g.cy-death.y)*e*.82;}
    ship.position.set(x,y);
    ship.rotation=0;ship.scale.set(1);ship.alpha=1;
    const pulse=reduced?0:(1+Math.sin(t*Math.PI*1.2))/2;
    ready.visible=!spaghetti&&run.energy>=100&&run.phase<=0;ready.scale.set(reduced?1:(.59+pulse*.025)/.615);ready.alpha=.8+pulse*.2;
    warning.visible=!spaghetti&&run.heat>=65;shield.visible=!spaghetti&&run.phase>0;
    text(warning.children[1],'BOOST TO COOL',`700 10px ${FONT}`,'#ffcca7',0,size*.78+7);
    text(you,'YOU',`700 11px ${FONT}`,'#d6faff',0,0);
    const tremble=rocketTremble(run.multiplier,run.time,reduced);shipTurn.position.set(tremble.x,tremble.y);shipTurn.rotation=Math.PI*.23-run.velocity*.6+tremble.angle;
    if(spaghetti){const e=easeInCubic(deathProgress);ship.rotation=Math.PI/2;shipTurn.rotation+=e*6;ship.scale.set(1+e*2.6,1-e*.8);ship.alpha=1-e;}
    boostLevel+=((boost&&flying?1:0)-boostLevel)*(1-Math.exp(-dt*14));
    const flicker=reduced?1:.92+.08*Math.sin(t*61)+.05*Math.sin(t*37);
    const flameOn=flying||mode==='ready';
    flame.mesh.visible=flameOn&&!spaghetti;
    flame.mesh.scale.set(size*(.2+.48*boostLevel)*flicker,size*(.2+.12*boostLevel));
    flame.update(reduced?0:t,.55+.45*boostLevel,run.phase>0?[.7,.55,1]:[.35,.95,1]);
    engineGlow.visible=flame.mesh.visible;engineGlow.width=engineGlow.height=size*(.45+.55*boostLevel)*flicker;engineGlow.alpha=.1+.28*boostLevel;
    rocketFallback.visible=!(rocket.complete&&rocket.naturalWidth);
    if(rocket.complete&&rocket.naturalWidth){let texture=sourceImages.get(rocket);if(!texture){texture=new Texture({source:new ImageSource({resource:rocket})});textures.push(texture);sourceImages.set(rocket,texture);}rocketTexture=texture;rocketSprite.texture=texture;rocketSprite.width=rocketSprite.height=size;}
    heat.update(size,visualHeat(run.heat,run.multiplier),run.time,reduced);
    drawTrail(t,flying,boost,run,x,y,size,shipTurn.rotation);
    drawGhosts(t,run,flying,x,y,shipTurn.rotation,size);
    you.visible=flying&&run.time<8&&ship.visible;you.position.set(x,y-size*.55-5);
    drawParticles(particles);
    // Screen-space overlays and post-processing.
    const effective=scene.tier;
    border.visible=effective==='low'&&flying&&run.heat>65;border.alpha=(run.heat-65)/90;
    speedLines.visible=!reduced&&!!juice&&juice.speedLines>.02;
    if(speedLines.visible){speedLines.alpha=juice.speedLines*.6;speedLines.scale.set(1+(1-juice.speedLines)*.08);}
    flash.visible=!!juice&&juice.flash>.01;
    if(flash.visible){flash.alpha=juice.flash*.5;flash.tint=((juice.flashColor[0]*255)<<16)|((juice.flashColor[1]*255)<<8)|(juice.flashColor[2]*255);}
    combo.visible=mode==='playing'&&t<comboUntil;
    if(combo.visible){const fontSize=Math.min(28,g.r*.045),cy=g.cy-g.r*.20,font=`700 ${fontSize}px ${FONT}`,age=t-(comboUntil-1.3);
      text(combo.children[0],'CLOSE CALL',font,'#9af3ff',g.cx,cy-fontSize*.55,g.r*.48);text(combo.children[1],comboText,font,'#f3f7fa',g.cx,cy+fontSize*.55,g.r*.48);
      const s=reduced?1:popScale(age);for(const child of combo.children)child.scale.set(s);combo.alpha=Math.min(1,(comboUntil-t)/.25);}
    if(effective!=='low'){
      lens.update({cx:g.cx+offset.x*.25,cy:g.cy+offset.y*.25,einstein:g.r*.4,tide:reduced?0:tideStrength(run,reduced),time:t,ring:.3});
      const waves=(juice?.waves??[]).map(w=>{const age=t-w.t0;return {x:w.x,y:w.y,radius:age*720,strength:reduced?0:w.strength*(1-age/1.4)};});
      post.update({width,height,cx:g.cx+offset.x,cy:g.cy+offset.y,r:g.r*scale,time:t,chroma:reduced||!juice?0:juice.chroma,grain:reduced?0:.032,vignette:.9,
        heat:flying&&run.heat>65?clamp((run.heat-65)/35,0,1)*.55:0,haze:0,waves});
    }
    app.render();
    // Drop artwork after it leaves the scene; no unbounded per-run texture cache.
    for(const [key,entry] of objectTextures)if(entry.used!==frame){objectTextures.delete(key);retire(entry.texture);}
    for(const [key,entry] of labels)if(frame-entry.used>600){labels.delete(key);retire(entry.texture);}
  }
  function retire(texture){const index=textures.indexOf(texture);if(index>=0)textures.splice(index,1);texture.destroy(true);}
  const contextLost=e=>{e.preventDefault();lost=true;onLost();};
  const contextRestored=()=>{if(destroyed)return;lost=false;if(config)resize(config);onRestored();};
  canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);
  return {app,resize,render,get tier(){return scene?.tier??tier;},stats(){return {tier:scene?.tier??tier,textures:textures.length,objects:objectPool.length,particles:particlePool.length,stageChildren:app.stage.children.length,textureBytes:textures.reduce((sum,t)=>sum+t.source.pixelWidth*t.source.pixelHeight*4,0)+(hole?.textureBytes??0)};},get lost(){return lost;},destroy(){if(destroyed)return;destroyed=true;canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);clearScene();for(const f of [lens.filter,post.filter,bloom])f.destroy();app.destroy({removeView:false,releaseGlobalResources:true});}};
}
