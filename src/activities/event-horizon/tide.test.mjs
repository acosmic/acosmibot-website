import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,DT} from './sim.mjs';
import {tideStrength,tideDust,debrisOpacity,TIDE_DUST_COUNT} from './tide-fx.mjs';
function scene(){const s=createRun(42);s.time=151;s.nextWave=s.nextCrosser=s.nextSpecial=Infinity;s.specials=[{kind:'tide',start:150,end:195}];return s;}
function tick(s){s.radius=1.02;s.velocity=0;s.phase=1;s.heat=0;step(s,{boost:true});}
function rock(angle=1.5){return {type:'rock',angle,radius:.83,size:.04,spin:0,checked:false};}
test('debris bends before the pilot with gems through recovery',()=>{
 const s=scene(),r=rock(),gem={...rock(),type:'shard'};s.objects=[r,gem];
 for(let i=0;i<60;i++)tick(s);
 assert.ok(r.angle>0);assert.ok(r.radius<.83-.025);assert.equal(gem.radius,r.radius);
 s.time=154.1;r.angle=1.5;const radius=r.radius;tick(s);assert.ok(r.radius<radius);
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
test('equal-angle debris and gems preserve corridor width as they bend inward',()=>{
 const s=scene(),inner={...rock(1.3),radius:.65},gem={...rock(1.3),type:'shard',radius:.8},outer={...rock(1.3),radius:.95};
 s.objects=[inner,gem,outer];
 while(gem.angle>0){
  tick(s);
  assert.ok(Math.abs(gem.radius-inner.radius-.15)<1e-10);
  assert.ok(Math.abs(outer.radius-gem.radius-.15)<1e-10);
 }
 assert.ok(gem.radius>.465);assert.ok(gem.radius<.75);
});
test('gems remain collectible on their curved trajectory',()=>{
 const s=scene(),gem={...rock(.008),type:'shard',tideCaptured:true,radius:.8};s.objects=[gem];
 step(s);assert.equal(s.shards,1);assert.equal(s.alive,true);assert.ok(!s.objects.includes(gem));
});
test('captured approach keeps curving before the pilot during the normal-pull interval',()=>{
 const s=scene(),r={...rock(.8),tideCaptured:true};s.time=154.1;s.objects=[r];
 const radius=r.radius;tick(s);assert.ok(r.angle>0);assert.ok(r.radius<radius);
});

for(const time of [151,154.1])test('new debris and gems curve on their first spawn tick '+time,()=>{
 const s=scene();s.time=time;s.nextWave=0;tick(s);
 const gem=s.objects.find(o=>o.type==='shard');
 assert.ok(gem);assert.ok(s.objects.every(o=>o.tideCaptured));
 const before=s.objects.map(o=>o.radius);tick(s);
 s.objects.forEach((o,i)=>assert.ok(o.radius<before[i]));
});
