import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,DT} from './sim.mjs';
import {tideStrength,tideDust,debrisOpacity,TIDE_DUST_COUNT} from './tide-fx.mjs';
function scene(){const s=createRun(42);s.time=151;s.nextWave=s.nextCrosser=s.nextSpecial=Infinity;s.specials=[{kind:'tide',start:150,end:195}];return s;}
function tick(s){s.radius=1.02;s.velocity=0;s.phase=1;s.heat=0;step(s,{boost:true});}
function rock(angle=1.5){return {type:'rock',angle,radius:.83,size:.04,spin:0,checked:false};}
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
  assert.ok(p.alpha>=0&&p.alpha<=.85);
 }
 const a=tideDust(0,1),b=tideDust(0,1.1);assert.ok(Math.hypot(b.x,b.y)<Math.hypot(a.x,a.y));
});
test('handoff opacity fades both ordinary and captured hazards',()=>{
 assert.equal(debrisOpacity({phaseFade:.5}),.5);
 assert.ok(Math.abs(debrisOpacity({tideCaptured:true,radius:.385,phaseFade:.5})-.25)<1e-10);
});


for(const type of ['rock','plasma','shard'])for(const time of [151,154.1,157.1])test('original orbital path for '+type+' at '+time,()=>{
 const s=scene();s.time=time;
 const objects=[-1,1,2.5].map(angle=>({...rock(angle),type}));s.objects=objects;
 for(let i=0;i<30;i++)tick(s);
 for(const o of objects){
  assert.equal(o.radius,.83);assert.equal(o.tideCaptured,undefined);
 }
 assert.ok(objects[1].angle<1);assert.ok(objects[1].angle>0);
});
test('orbital hazards keep the original lifetime rather than wrapping around',()=>{
 const s=scene(),o=rock(-2.69);s.objects=[o];tick(s);assert.ok(!s.objects.includes(o));
});
test('gems remain collectible during stronger pull',()=>{
 const s=scene();s.objects=[{...rock(.008),type:'shard',radius:.8}];step(s);
 assert.equal(s.shards,1);assert.ok(s.alive);
});
