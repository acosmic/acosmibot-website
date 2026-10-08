import { seeded } from './vfx-art.mjs';
// Local artwork is shared by the retained GPU sprites and Canvas rollback renderer.
// Silhouettes stay within the collision radius `rr`; detail is seeded by shape.
const TAU = Math.PI * 2;
export function drawObjectArt(ctx,o,rr,reduced){
  if(o.type==='resonance'){
    ctx.save();ctx.strokeStyle='#8afff5';ctx.lineWidth=Math.max(1,rr*.12);ctx.shadowColor='#62fff0';ctx.shadowBlur=reduced?0:rr*.5;
    ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3;const x=Math.cos(a)*rr,y=Math.sin(a)*rr;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.closePath();ctx.fillStyle='#123b4b';ctx.fill();ctx.stroke();
    ctx.scale(.5,.5);drawShard(ctx,rr,reduced);ctx.restore();
  }else if(o.type==='shard') drawShard(ctx,rr,reduced);
  else if(o.type==='plasma') drawPlasma(ctx,rr,reduced,o.shape);
  else drawRock(ctx,rr,o.shape);
}
function drawShard(ctx,rr,reduced){
  ctx.save();
  ctx.shadowColor='#00d9ff';ctx.shadowBlur=reduced?0:rr*.6;
  const top=[0,-rr*1.5],right=[rr,0],bottom=[0,rr*1.5],left=[-rr,0],mid=[rr*.12,-rr*.15];
  const facets=[[top,right,mid,'#d9fdff'],[right,bottom,mid,'#3fc7ea'],[bottom,left,mid,'#1b8fc0'],[left,top,mid,'#9cf3ff']];
  for(const [a,b,c,color] of facets){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.lineTo(...c);ctx.closePath();ctx.fill();}
  ctx.shadowBlur=0;ctx.strokeStyle='#f2feff';ctx.lineWidth=Math.max(1,rr*.09);ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(...top);ctx.lineTo(...right);ctx.lineTo(...bottom);ctx.lineTo(...left);ctx.closePath();ctx.stroke();
  ctx.globalAlpha=.85;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.moveTo(-rr*.2,-rr*.85);ctx.lineTo(rr*.08,-rr*.95);ctx.lineTo(-rr*.05,-rr*.35);ctx.closePath();ctx.fill();
  ctx.restore();
}
function drawPlasma(ctx,rr,reduced,shape=0){
  const rand=seeded(Math.floor(Math.abs(shape)*1000)+17);
  ctx.save();
  const halo=ctx.createRadialGradient(0,0,0,0,0,rr*1.35);
  halo.addColorStop(0,'rgba(255,240,235,.9)');halo.addColorStop(.28,'rgba(255,120,150,.6)');
  halo.addColorStop(.62,'rgba(255,60,110,.14)');halo.addColorStop(1,'rgba(255,40,90,0)');
  ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,0,rr*1.35,0,TAU);ctx.fill();
  ctx.shadowColor='#ff6b8c';ctx.shadowBlur=reduced?0:rr*.35;
  ctx.strokeStyle='#ffc1c9';ctx.lineWidth=Math.max(1.5,rr*.16);ctx.beginPath();ctx.arc(0,0,rr*.92,0,TAU);ctx.stroke();
  ctx.shadowBlur=0;ctx.strokeStyle='#fff3f0';ctx.lineWidth=Math.max(1,rr*.06);
  for(let arc=0;arc<5;arc++){
    let a=rand()*TAU,r=rr*.25;ctx.beginPath();ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);
    for(let k=0;k<4;k++){a+=(rand()-.5)*.9;r+=rr*.17;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
    ctx.stroke();
  }
  ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(0,0,rr*.24,0,TAU);ctx.fill();
  ctx.restore();
}
function drawRock(ctx,rr,shape=0){
  const rand=seeded(Math.floor(Math.abs(shape)*1000)+3),points=14,outline=[];
  for(let i=0;i<points;i++){const a=i*TAU/points,r=rr*(.82+.12*Math.sin(shape+i*7)+rand()*.06);outline.push([Math.cos(a)*r,Math.sin(a)*r]);}
  ctx.save();
  ctx.beginPath();outline.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
  const body=ctx.createRadialGradient(-rr*.35,-rr*.4,rr*.1,0,0,rr*1.05);
  body.addColorStop(0,'#c7a9a5');body.addColorStop(.35,'#7c6676');body.addColorStop(.75,'#3a2e44');body.addColorStop(1,'#1a1626');
  ctx.fillStyle=body;ctx.fill();
  ctx.clip();
  for(let i=0;i<Math.round(rr*1.8);i++){
    const x=(rand()-.5)*rr*1.8,y=(rand()-.5)*rr*1.8,s=.5+rand()*Math.max(1,rr*.05);
    ctx.fillStyle=rand()<.5?'rgba(20,14,30,.35)':'rgba(240,210,200,.18)';ctx.fillRect(x,y,s,s);
  }
  for(let i=0;i<3;i++){
    const a=rand()*TAU,d=rand()*rr*.5,cr=rr*(.12+rand()*.16),x=Math.cos(a)*d,y=Math.sin(a)*d;
    ctx.fillStyle='rgba(18,12,28,.55)';ctx.beginPath();ctx.arc(x,y,cr,0,TAU);ctx.fill();
    ctx.strokeStyle='rgba(240,205,190,.35)';ctx.lineWidth=Math.max(.8,cr*.22);
    ctx.beginPath();ctx.arc(x,y,cr,Math.PI*.15,Math.PI*1.05);ctx.stroke();
  }
  const shade=ctx.createLinearGradient(-rr,-rr,rr,rr);
  shade.addColorStop(0,'rgba(0,0,0,0)');shade.addColorStop(.55,'rgba(0,0,0,.05)');shade.addColorStop(1,'rgba(6,4,16,.55)');
  ctx.fillStyle=shade;ctx.fillRect(-rr*1.2,-rr*1.2,rr*2.4,rr*2.4);
  ctx.restore();
  ctx.strokeStyle='rgba(225,195,195,.7)';ctx.lineWidth=Math.max(1,rr*.06);ctx.lineJoin='round';
  ctx.beginPath();outline.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.stroke();
}
