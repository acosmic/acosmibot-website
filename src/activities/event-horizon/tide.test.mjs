import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,DT} from './sim.mjs';
import {tideStrength,tideDust,debrisOpacity,TIDE_DUST_COUNT} from './tide-fx.mjs';
function scene(){const s=createRun(42);s.time=151;s.nextWave=s.nextCrosser=s.nextSpecial=Infinity;s.specials=[{kind:'tide',start:150,end:195}];return s;}
function tick(s){s.radius=1.02;s.velocity=0;s.phase=1;s.heat=0;step(s,{boost:true});}
function rock(angle=1.5){return {type:'rock',angle,radius:.83,size:.04,spin:0,checked:false};}
test('approaching debris drifts gently while shards and recovery lanes stay fixed',()=>{
 const s=scene(),r=rock(),gem={...rock(),type:'shard'};s.objects=[r,gem];
 for(let i=0;i<60;i++)tick(s);
 assert.ok(Math.abs(r.radius-(.83-.012))<1e-10);assert.equal(gem.radius,.83);
 s.time=154.1;r.angle=1.5;const radius=r.radius;tick(s);assert.equal(r.radius,radius);
});
test('captured debris spirals into the rim after passing without orbiting back',()=>{
 const s=scene(),r={...rock(-.21),radius:1.01};s.objects=[r];tick(s);
 let prev=r.radius;let ticks=0;
 while(s.objects.includes(r)&&ticks++<600){tick(s);assert.ok(r.radius<prev);prev=r.radius;}
 assert.ok(ticks<600);assert.ok(r.radius<=.35);assert.ok(r.angle>-5.8);
 assert.equal(debrisOpacity(r),0);assert.equal(debrisOpacity({...r,radius:.42}),1);
});
test('incoming asteroids curve toward center only after their warning',()=>{
 const s=scene(),o={type:'crosser',x:1.2,y:-.8,vx:-.8,vy:0,warning:DT*2,age:0,size:.04,spin:0,minDistance:10};s.crossers=[o];tick(s);
 assert.equal(o.vx,-.8);assert.equal(o.vy,0);tick(s);tick(s);
 assert.ok(o.vx<-.8);assert.ok(o.vy>0);assert.ok(o.y>-.8);
});
test('tide cue follows simulation pull windows and reduced effects omit animation',()=>{
 const s=scene();assert.equal(tideStrength(s),1);assert.equal(tideStrength(s,true),.65);
 for(const age of [4,5,6.99]){s.time=150+age;assert.equal(tideStrength(s),0);}
 s.time=157.5;assert.equal(tideStrength(s),1);s.specials=[];assert.equal(tideStrength(s),0);
});
test('dust stays outside dark center and spirals inward with bounded opacity',()=>{
 for(let i=0;i<TIDE_DUST_COUNT;i++)for(let t=0;t<7;t+=.1){
  const p=tideDust(i,t);assert.ok(Math.hypot(p.x,p.y)>=.35-1e-10);assert.ok(Math.hypot(p.x,p.y)<=.69);
  assert.ok(p.alpha>=0&&p.alpha<=.65);
 }
 const a=tideDust(0,1),b=tideDust(0,1.1);assert.ok(Math.hypot(b.x,b.y)<Math.hypot(a.x,a.y));
});
for(const seed of [1,42,987])test('tide orbital corridors remain flyable without Shift '+seed,()=>{
 const s=createRun(seed);s.time=150-DT;s.nextSpecial=150;s.nextKind='tide';s.nextCrosser=Infinity;
 // Isolate orbital lanes from independently aimed crossing asteroids.
 while(s.alive&&s.time<195){
  const next=s.objects.filter(o=>o.type==='shard'&&o.angle>-.1).sort((a,b)=>a.angle-b.angle)[0];
  step(s,{boost:s.radius+s.velocity*.5<(next?.radius??.8)});
 }
 assert.ok(s.alive,s.cause);assert.equal(s.phase,0);
});
