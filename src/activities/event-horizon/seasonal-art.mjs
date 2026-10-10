import { seeded } from './vfx-art.mjs';
// Seasonal hazard, debris-bit, and ambient artwork. Every hazard is drawn in a unit
// circle scaled to the collision radius, so a themed silhouette never misleads a dodge.
const TAU = Math.PI * 2;
export const BULBS = [[0xff4d4d,'#ff4d4d'],[0x4dff7a,'#4dff7a'],[0xffd24d,'#ffd24d'],[0x4db8ff,'#4db8ff']];
// The sim seeds `shape` as an integer in 0..9999, so a plain modulo spreads variants evenly.
export const artVariant = (o,count) => Math.floor(Math.abs(o.shape||0))%count;
const poly = (ctx,points) => {ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();};
const disc = (ctx,x,y,r) => {ctx.beginPath();ctx.arc(x,y,r,0,TAU);};
const oval = (ctx,x,y,rx,ry,rot=0) => {ctx.beginPath();ctx.ellipse(x,y,rx,ry,rot,0,TAU);};
const radial = (ctx,x,y,r,stops) => {const g=ctx.createRadialGradient(x,y,.02,0,0,r);stops.forEach(([at,color])=>g.addColorStop(at,color));return g;};

// ---- Halloween ----
const FACES = [
  // Classic grin, startled, and scowl. Each is [eyes, mouth] as polygons.
  {eyes:[[[-.57,-.08],[-.36,-.46],[-.15,-.08]],[[.15,-.08],[.36,-.46],[.57,-.08]]],mouth:[[-.6,.2],[-.3,.36],[-.14,.2],[0,.36],[.14,.2],[.3,.36],[.6,.2],[.36,.62],[-.36,.62]]},
  {eyes:[[[-.52,-.28],[-.2,-.28],[-.2,.02],[-.52,.02]],[[.2,-.28],[.52,-.28],[.52,.02],[.2,.02]]],mouth:[[-.28,.26],[.28,.26],[.34,.5],[.2,.66],[-.2,.66],[-.34,.5]]},
  {eyes:[[[-.6,-.36],[-.14,-.14],[-.5,-.02]],[[.6,-.36],[.14,-.14],[.5,-.02]]],mouth:[[-.58,.56],[-.34,.26],[-.16,.44],[0,.26],[.16,.44],[.34,.26],[.58,.56],[.2,.5],[-.2,.5]]},
];
function pumpkin(ctx,o,reduced){
  // A round lantern keeps the flare's hit radius legible; the lit face is what reads as hot.
  ctx.fillStyle=radial(ctx,-.3,-.4,1,[[0,'#ffb347'],[.55,'#f07a1a'],[1,'#8a3210']]);ctx.strokeStyle='#ffd078';ctx.lineWidth=.06;
  oval(ctx,0,.05,.94,.86);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#b74718';ctx.lineWidth=.05;
  for(const x of [-.16,.16]){ctx.beginPath();ctx.ellipse(x,.05,.45,.8,0,-Math.PI/2,Math.PI/2,x<0);ctx.stroke();}
  ctx.fillStyle='#6f9440';ctx.fillRect(-.11,-1,.22,.24);
  const face=FACES[artVariant(o,FACES.length)],parts=[...face.eyes,face.mouth];
  ctx.fillStyle='#5a1a05';ctx.lineJoin='round';ctx.strokeStyle='#5a1a05';ctx.lineWidth=.09;
  for(const part of parts){poly(ctx,part);ctx.fill();ctx.stroke();}
  ctx.fillStyle='#fff3b0';ctx.shadowColor='#ffd24a';ctx.shadowBlur=reduced?0:10;
  for(const part of parts){poly(ctx,part);ctx.fill();}
  ctx.shadowBlur=0;
}
function skull(ctx,o){
  const kind=artVariant(o,3),bone=ctx.createLinearGradient(-.6,-.8,.7,.9);
  bone.addColorStop(0,'#fff4d2');bone.addColorStop(.55,'#ded2b5');bone.addColorStop(1,'#9f8d81');
  ctx.fillStyle=bone;ctx.strokeStyle='#bca995';ctx.lineWidth=.06;ctx.lineJoin='round';
  if(kind===2)for(const s of [-1,1]){poly(ctx,[[s*.52,-.62],[s*.96,-.98],[s*.8,-.3]]);ctx.fill();ctx.stroke();}
  oval(ctx,0,-.15,.86,.8);ctx.fill();ctx.stroke();
  // The jawless variant is a bare cranium with a ragged lower edge.
  if(kind===1){poly(ctx,[[-.5,.3],[-.34,.66],[-.16,.44],[0,.7],[.18,.44],[.34,.66],[.5,.3]]);ctx.fill();ctx.stroke();}
  else{ctx.fillRect(-.5,.25,1,.6);ctx.strokeStyle='#6c6070';ctx.lineWidth=.07;for(const x of [-.25,0,.25]){ctx.beginPath();ctx.moveTo(x,.5);ctx.lineTo(x,.85);ctx.stroke();}}
  ctx.fillStyle='#241a30';
  for(const x of [-.36,.36]){oval(ctx,x,-.16,.27,.3,x*.4);ctx.fill();}
  poly(ctx,[[0,.1],[-.14,.38],[.14,.38]]);ctx.fill();
  ctx.fillStyle='#9dff7a';for(const x of [-.36,.36]){disc(ctx,x,-.12,.09);ctx.fill();}
  if(kind===1){ctx.strokeStyle='#6c6070';ctx.lineWidth=.06;ctx.beginPath();ctx.moveTo(.14,-.93);ctx.lineTo(-.04,-.62);ctx.lineTo(.16,-.48);ctx.stroke();}
}
function candy(ctx,o){
  ctx.lineJoin='round';ctx.lineWidth=.06;
  if(artVariant(o,2)===0){
    // Candy corn: yellow base, orange middle, white tip.
    const corn=[[0,-.96],[.86,.6],[.6,.86],[-.6,.86],[-.86,.6]];
    ctx.save();poly(ctx,corn);ctx.clip();
    ctx.fillStyle='#fff6dc';ctx.fillRect(-1,-1,2,2);ctx.fillStyle='#ff8a1f';ctx.fillRect(-1,-.4,2,2);ctx.fillStyle='#ffd23c';ctx.fillRect(-1,.3,2,2);
    ctx.restore();ctx.strokeStyle='#fff4d6';poly(ctx,corn);ctx.stroke();
    ctx.fillStyle='#ffffffaa';oval(ctx,-.14,-.5,.08,.2,.5);ctx.fill();return;
  }
  ctx.fillStyle='#8a4dff';ctx.strokeStyle='#ffe9c4';
  for(const s of [-1,1]){poly(ctx,[[s*.47,0],[s*.85,-.47],[s*.98,-.2],[s*.9,.08],[s*.85,.47]]);ctx.fill();ctx.stroke();}
  oval(ctx,0,0,.66,.72);ctx.fillStyle='#ff8a1f';ctx.fill();ctx.stroke();
  ctx.save();ctx.clip();ctx.strokeStyle='#1c1026';ctx.lineWidth=.22;
  for(const x of [-.7,0,.7]){ctx.beginPath();ctx.moveTo(x-.45,-.8);ctx.lineTo(x+.45,.8);ctx.stroke();}ctx.restore();
  ctx.fillStyle='#ffffff';oval(ctx,-.23,-.38,.2,.09,-.4);ctx.fill();
}

// ---- Thanksgiving ----
const FANS = [['#b3261e','#e8792a','#f2c744'],['#7a3b12','#d9a441','#b3261e']];
function turkey(ctx,o){
  // A fan-tailed turkey: the striped tail fills the circle, so it reads at hazard size.
  const colors=FANS[artVariant(o,FANS.length)],feathers=9;
  ctx.lineJoin='round';ctx.strokeStyle='#fff0c8';ctx.lineWidth=.045;
  for(let i=0;i<feathers;i++){
    const a=Math.PI*(1.08+i*.84/(feathers-1));
    ctx.fillStyle=colors[i%colors.length];
    ctx.beginPath();ctx.moveTo(0,.2);ctx.lineTo(Math.cos(a-.17)*.9,.2+Math.sin(a-.17)*.9);
    ctx.quadraticCurveTo(Math.cos(a)*1.16,.2+Math.sin(a)*1.16,Math.cos(a+.17)*.9,.2+Math.sin(a+.17)*.9);ctx.closePath();ctx.fill();ctx.stroke();
  }
  ctx.fillStyle=radial(ctx,-.15,.2,.7,[[0,'#a8642a'],[1,'#5a2c10']]);oval(ctx,0,.42,.52,.5);ctx.fill();ctx.stroke();
  ctx.fillStyle='#8a4a1c';disc(ctx,0,-.08,.26);ctx.fill();ctx.stroke();
  ctx.fillStyle='#ffffff';for(const x of [-.1,.1]){disc(ctx,x,-.13,.07);ctx.fill();}
  ctx.fillStyle='#1c1026';for(const x of [-.1,.1]){disc(ctx,x,-.12,.035);ctx.fill();}
  ctx.fillStyle='#f2c744';poly(ctx,[[-.08,-.02],[.08,-.02],[0,.14]]);ctx.fill();
  ctx.fillStyle='#d8262e';oval(ctx,.07,.16,.06,.12,-.2);ctx.fill();
}
// A closed curve through the midpoints of `points`, for liquid outlines.
function blob(ctx,points){
  const n=points.length,mid=i=>[(points[i%n][0]+points[(i+1)%n][0])/2,(points[i%n][1]+points[(i+1)%n][1])/2];
  ctx.beginPath();ctx.moveTo(...mid(0));
  for(let i=1;i<=n;i++){const [mx,my]=mid(i);ctx.quadraticCurveTo(points[i%n][0],points[i%n][1],mx,my);}
  ctx.closePath();
}
function gravy(ctx,o,reduced){
  // A molten splash with a white-hot core and loose droplets: still clearly the hot hazard.
  const rand=seeded(Math.floor(Math.abs(o.shape||0))+41),points=[];
  for(let i=0;i<15;i++){const a=i*TAU/15+rand()*.12,r=i%3===0?.86+rand()*.12:.48+rand()*.2;points.push([Math.cos(a)*r,Math.sin(a)*r]);}
  ctx.fillStyle=radial(ctx,0,0,.95,[[0,'#fffbe6'],[.3,'#ffd35c'],[.7,'#c8791c'],[1,'#7a4310']]);
  ctx.shadowColor='#ffb347';ctx.shadowBlur=reduced?0:12;blob(ctx,points);ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle='#ffe2a0';ctx.lineWidth=.06;blob(ctx,points);ctx.stroke();
  ctx.fillStyle='#ffd35c';for(let i=0;i<3;i++){const a=(i*5+1.5)*TAU/15+rand()*.2;disc(ctx,Math.cos(a)*.84,Math.sin(a)*.84,.08);ctx.fill();}
  ctx.fillStyle='#ffffffc0';oval(ctx,-.22,-.26,.2,.09,-.5);ctx.fill();
}
function pie(ctx,o){
  const pecan=artVariant(o,2)===1;
  ctx.fillStyle='#e8b56a';ctx.strokeStyle='#fff0c8';ctx.lineWidth=.05;
  ctx.beginPath();for(let i=0;i<=24;i++){const a=i*TAU/24,r=.9+(i%2?.07:0);ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle=radial(ctx,-.2,-.25,.75,pecan?[[0,'#a8642a'],[1,'#5a2c10']]:[[0,'#f08a2a'],[1,'#b5521a']]);disc(ctx,0,0,.7);ctx.fill();
  ctx.strokeStyle=pecan?'#3a1c0a':'#8f3d12';ctx.lineWidth=.04;
  for(let i=0;i<3;i++){const a=i*Math.PI/3;ctx.beginPath();ctx.moveTo(Math.cos(a)*.7,Math.sin(a)*.7);ctx.lineTo(-Math.cos(a)*.7,-Math.sin(a)*.7);ctx.stroke();}
  ctx.fillStyle='#fffaf0';for(const [x,y,r] of [[0,0,.2],[-.13,.09,.12],[.13,.08,.12],[0,-.13,.12]]){disc(ctx,x,y,r);ctx.fill();}
}

// ---- Christmas ----
function snowOrCoal(ctx,o){
  const rand=seeded(Math.floor(Math.abs(o.shape||0))+7);
  if(artVariant(o,3)===2){
    // Coal: an angular lump, edged in cold light so it never vanishes into the sky.
    const lump=[];for(let i=0;i<9;i++){const a=i*TAU/9,r=.74+rand()*.22;lump.push([Math.cos(a)*r,Math.sin(a)*r]);}
    ctx.fillStyle=radial(ctx,-.3,-.35,1,[[0,'#59627a'],[.45,'#272c3c'],[1,'#0c0e16']]);poly(ctx,lump);ctx.fill();
    ctx.save();ctx.clip();ctx.fillStyle='#aebfe055';
    for(let i=0;i<3;i++){const a=rand()*TAU,d=rand()*.4;poly(ctx,[[Math.cos(a)*d,Math.sin(a)*d],[Math.cos(a+.9)*.9,Math.sin(a+.9)*.9],[Math.cos(a+1.5)*.9,Math.sin(a+1.5)*.9]]);ctx.fill();}
    ctx.restore();ctx.strokeStyle='#9fb2d6';ctx.lineWidth=.06;ctx.lineJoin='round';poly(ctx,lump);ctx.stroke();return;
  }
  ctx.fillStyle=radial(ctx,-.32,-.36,1,[[0,'#ffffff'],[.5,'#dcefff'],[1,'#86abd4']]);ctx.strokeStyle='#f2faff';ctx.lineWidth=.06;
  ctx.beginPath();for(let i=0;i<=20;i++){const a=i*TAU/20,r=.88+rand()*.07;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#a9c8e8';for(let i=0;i<5;i++){disc(ctx,(rand()-.3)*1.1,(rand()-.2)*1.1,.05+rand()*.06);ctx.fill();}
  ctx.fillStyle='#ffffff';for(let i=0;i<4;i++){disc(ctx,(rand()-.6)*.9,(rand()-.7)*.9,.04);ctx.fill();}
}
function bulb(ctx,o,reduced){
  const color=BULBS[artVariant(o,BULBS.length)][1];
  ctx.fillStyle='#2f6b45';ctx.strokeStyle='#bfe8cc';ctx.lineWidth=.05;ctx.fillRect(-.22,-1,.44,.34);ctx.strokeRect(-.22,-1,.44,.34);
  ctx.fillStyle=radial(ctx,-.2,-.15,.95,[[0,'#ffffff'],[.3,color],[1,color]]);
  ctx.shadowColor=color;ctx.shadowBlur=reduced?0:14;disc(ctx,0,.14,.84);ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle='#ffffffcc';ctx.lineWidth=.06;disc(ctx,0,.14,.84);ctx.stroke();
  ctx.fillStyle='#ffffffd0';oval(ctx,-.3,-.18,.2,.1,-.6);ctx.fill();
}
function present(ctx,o){
  const red=artVariant(o,2)===0,box=red?'#d83a44':'#2f9d5c',ribbon=red?'#ffd766':'#f4f6ff',h=.66;
  ctx.lineJoin='round';ctx.lineWidth=.06;ctx.strokeStyle='#fff4d6';
  ctx.fillStyle=box;ctx.beginPath();ctx.roundRect?.(-h,-h+.08,h*2,h*2,.1);if(!ctx.roundRect)ctx.rect(-h,-h+.08,h*2,h*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#00000030';ctx.fillRect(-h,.3,h*2,h-.22+.08);
  ctx.fillStyle=ribbon;ctx.fillRect(-.13,-h+.08,.26,h*2);ctx.fillRect(-h,-.05,h*2,.26);
  for(const s of [-1,1]){oval(ctx,s*.26,-h+.02,.26,.16,s*-.5);ctx.fill();ctx.stroke();}
  disc(ctx,0,-h+.08,.1);ctx.fill();
}

const HAZARDS = {
  halloween:{plasma:pumpkin,rock:skull,crosser:candy},
  thanksgiving:{plasma:gravy,rock:turkey,crosser:pie},
  christmas:{plasma:bulb,rock:snowOrCoal,crosser:present},
};
// Only hazards are themed. Shards and Resonance Shards stay Classic in every season.
export function drawSeasonalObject(ctx,o,rr,theme,reduced=false){
  const draw=HAZARDS[theme]?.[o.type];
  if(!draw)return false;
  ctx.save();ctx.scale(rr,rr);draw(ctx,o,reduced);ctx.restore();return true;
}

// Small debris pieces thrown by near-misses and break-ups. Drawn centred in `size`.
const BITS = {
  halloween:[
    c=>{c.fillStyle='#f07a1a';c.strokeStyle='#ffd078';c.lineWidth=.08;poly(c,[[-.7,.5],[-.2,-.7],[.7,-.3],[.4,.6]]);c.fill();c.stroke();},
    c=>{c.strokeStyle='#f1e6c8';c.lineWidth=.26;c.lineCap='round';c.beginPath();c.moveTo(-.5,.5);c.lineTo(.5,-.5);c.stroke();c.fillStyle='#f1e6c8';for(const [x,y] of [[-.68,.4],[-.4,.68],[.68,-.4],[.4,-.68]]){disc(c,x,y,.17);c.fill();}},
    c=>{const corn=[[0,-.8],[.7,.7],[-.7,.7]];c.save();poly(c,corn);c.clip();c.fillStyle='#fff6dc';c.fillRect(-1,-1,2,2);c.fillStyle='#ff8a1f';c.fillRect(-1,-.3,2,2);c.fillStyle='#ffd23c';c.fillRect(-1,.25,2,2);c.restore();},
  ],
  thanksgiving:[
    c=>{c.fillStyle='#b5622a';c.strokeStyle='#f6d2a0';c.lineWidth=.07;oval(c,0,0,.3,.85,.5);c.fill();c.stroke();c.beginPath();c.moveTo(-.4,.72);c.lineTo(.4,-.72);c.stroke();},
    c=>{c.fillStyle='#a8621c';c.strokeStyle='#ffd58a';c.lineWidth=.08;c.beginPath();c.moveTo(0,-.8);c.bezierCurveTo(.8,.1,.5,.8,0,.8);c.bezierCurveTo(-.5,.8,-.8,.1,0,-.8);c.fill();c.stroke();},
    c=>{c.fillStyle='#b3122e';disc(c,0,0,.6);c.fill();c.fillStyle='#ffffff99';disc(c,-.2,-.22,.16);c.fill();},
    c=>leaf(c,'#e0622a'),
  ],
  christmas:[
    c=>ornament(c,'#e8474c'),
    c=>ornament(c,'#f2c744'),
    c=>flake(c,'#ffffff'),
    c=>{c.strokeStyle='#e8474c';c.lineWidth=.24;c.lineCap='round';c.beginPath();c.moveTo(-.75,.3);c.bezierCurveTo(-.3,-.9,.3,.9,.75,-.3);c.stroke();},
  ],
};
function ornament(c,color){
  c.fillStyle='#d8dde6';c.fillRect(-.16,-.92,.32,.28);
  c.fillStyle=radial(c,-.2,-.1,.75,[[0,'#ffffff'],[.35,color],[1,color]]);disc(c,0,.12,.7);c.fill();
  c.strokeStyle='#ffffffaa';c.lineWidth=.07;disc(c,0,.12,.7);c.stroke();
}
function flake(c,color){
  c.strokeStyle=color;c.lineWidth=.12;c.lineCap='round';
  for(let i=0;i<3;i++){const a=i*Math.PI/3,x=Math.cos(a)*.85,y=Math.sin(a)*.85;c.beginPath();c.moveTo(-x,-y);c.lineTo(x,y);c.stroke();
    for(const s of [-1,1]){const bx=x*.55*s,by=y*.55*s;for(const turn of [-.6,.6]){c.beginPath();c.moveTo(bx,by);c.lineTo(bx+Math.cos(a+turn)*.26*s,by+Math.sin(a+turn)*.26*s);c.stroke();}}}
}
function leaf(c,color){
  c.fillStyle=color;c.strokeStyle='#ffd9a0';c.lineWidth=.06;c.lineJoin='round';
  poly(c,[[0,-.9],[.28,-.45],[.8,-.5],[.52,-.05],[.85,.3],[.3,.3],[.1,.9],[0,.4],[-.1,.9],[-.3,.3],[-.85,.3],[-.52,-.05],[-.8,-.5],[-.28,-.45]]);c.fill();c.stroke();
}
export const seasonBitCount = theme => BITS[theme]?.length??0;
export function drawSeasonBit(ctx,theme,variant,size){
  const bits=BITS[theme];if(!bits)return;
  ctx.save();ctx.translate(size/2,size/2);ctx.scale(size*.46,size*.46);bits[variant%bits.length](ctx);ctx.restore();
}
// Background drifters. Bats and leaves face local +X/up; snow is a soft dot or a flake.
const LEAVES = ['#e0622a','#c8962a','#a8331f','#d98a2a'];
export const AMBIENT_VARIANTS = {bats:1,leaves:LEAVES.length,snow:2};
export function drawAmbient(ctx,kind,variant,size){
  ctx.save();ctx.translate(size/2,size/2);ctx.scale(size*.46,size*.46);
  if(kind==='bats'){
    ctx.fillStyle='#5a3a86';ctx.strokeStyle='#9a78d0';ctx.lineWidth=.05;ctx.lineJoin='round';
    poly(ctx,[[0,-.3],[.14,-.5],[.2,-.22],[.55,-.42],[1,-.1],[.78,.02],[.62,.3],[.42,.08],[.2,.4],[0,.16],[-.2,.4],[-.42,.08],[-.62,.3],[-.78,.02],[-1,-.1],[-.55,-.42],[-.2,-.22],[-.14,-.5]]);ctx.fill();ctx.stroke();
  }else if(kind==='leaves')leaf(ctx,LEAVES[variant%LEAVES.length]);
  else if(variant%2)flake(ctx,'#ffffff');
  else{const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.5,'rgba(235,245,255,.6)');g.addColorStop(1,'rgba(235,245,255,0)');ctx.fillStyle=g;disc(ctx,0,0,1);ctx.fill();}
  ctx.restore();
}
