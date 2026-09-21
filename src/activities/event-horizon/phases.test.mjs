import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,DT,specialState} from './sim.mjs';

function scene(kind,time=105,seed=42){
  const s=createRun(seed);s.time=time-DT;s.nextSpecial=time;s.nextKind=kind;
  s.nextWave=Infinity;s.nextCrosser=Infinity;return s;
}
function immortalTick(s){s.radius=1.02;s.velocity=0;s.heat=0;s.phase=1;step(s,{boost:true});}

test('phases begin at onset with no warning or recovery events',()=>{
  const s=createRun(42),starts=[];
  for(let i=0;i<60*241;i++){
    immortalTick(s);
    assert.ok(s.events.every(e=>!['phase-warning','phase-end'].includes(e.type)));
    starts.push(...s.events.filter(e=>e.type==='phase-start').map(e=>[e.kind,Math.round(s.time)]));
    if(s.time>=105&&s.time<240)assert.equal(s.specials.length,1);
    if(s.time>=240)assert.equal(s.specials.length,2);
  }
  assert.deepEqual(starts.slice(0,3),[['convoy',105],['tide',150],['pulsar',195]]);
  assert.deepEqual(starts.slice(3).map(p=>p[1]),[240,240]);
});
test('baseline waves continue through phase transitions',()=>{
  const s=createRun(42);let lastWave=0,lastCrosser=60,maxWave=0,maxCrosser=0;
  for(let i=0;i<60*600;i++){
    const oldWave=s.wave;immortalTick(s);
    if(s.wave!==oldWave){if(s.time>105)maxWave=Math.max(maxWave,s.time-lastWave);lastWave=s.time;}
    if(s.events.some(e=>e.type==='incoming')){maxCrosser=Math.max(maxCrosser,s.time-lastCrosser);lastCrosser=s.time;}
    assert.ok(s.objects.every(o=>o.retiring===undefined&&o.warning===undefined));
  }
  assert.ok(maxWave<1.6,'wave drought '+maxWave);
  assert.ok(maxCrosser<9,'asteroid drought '+maxCrosser);
  assert.ok(s.wave>380);
});
test('phase onset never clears an existing rock or crosser',()=>{
  const s=scene('convoy');
  const rock={type:'rock',radius:.9,angle:1,size:.04,spin:0,checked:false};
  const crosser={type:'crosser',x:1.2,y:-.8,vx:-.8,vy:0,size:.04,age:0,spin:0,warning:0,minDistance:10};
  s.objects.push(rock);s.crossers.push(crosser);step(s);
  assert.ok(s.objects.includes(rock));assert.ok(s.crossers.includes(crosser));
  assert.ok(rock.angle<1);assert.ok(crosser.x<1.2);
});
for(const seed of [1,42,987])test('staircase has staggered rocks, flares, shards and an open corridor '+seed,()=>{
  const s=scene('convoy',105,seed);s.nextWave=0;step(s);
  const shards=s.objects.filter(o=>o.type==='shard');
  assert.equal(shards.length,3);assert.equal(s.objects.length,9);
  assert.ok(s.objects.some(o=>o.type==='plasma'));
  assert.ok(s.objects.every(o=>['rock','plasma','shard'].includes(o.type)));
  for(let i=0;i<shards.length;i++){
    const gem=shards[i],walls=s.objects.filter(o=>o.type!=='shard'&&o.angle===gem.angle);
    assert.equal(walls.length,2);
    assert.ok(walls.every(o=>Math.abs(o.radius-gem.radius)-o.size-.028>.08));
    if(i){assert.ok(Math.abs(Math.abs(gem.radius-shards[i-1].radius)-.04)<1e-8);assert.ok(gem.angle>shards[i-1].angle);}
  }
});
test('tide starts pulling immediately and never exceeds 15 percent',()=>{
  const s=scene('tide',150);step(s);
  for(const [age,mult] of [[0,1.15],[3.9,1.15],[4,1],[7,1.15],[11,1],[14,1.15]]){
    s.time=s.specials[0].start+age;assert.equal(specialState(s).gravity,mult);
  }
});
for(const initial of [.48,.8,1.065])for(const seed of [1,42,987])test('staircase can be flown without Shift '+initial+' '+seed,()=>{
  const s=scene('convoy',105,seed);s.radius=initial;s.energy=0;s.nextWave=0;
  while(s.alive&&s.time<125){
    const next=s.objects.filter(o=>o.type==='shard'&&o.angle>-.1).sort((a,b)=>a.angle-b.angle)[0];
    const target=next?.radius??.8;
    step(s,{boost:s.radius+s.velocity*.5<target});
  }
  assert.ok(s.alive,s.cause);assert.equal(s.phase,0);
});
test('pulsar emerges inside the hole, repeats, and each sweep needs its own crossing',()=>{
  const s=scene('pulsar',195);step(s);
  assert.ok(specialState(s).beam<.465-.046);assert.ok(s.alive);
  s.time=198;s.radius=.64;s.velocity=0;step(s,{dash:true});
  assert.ok(s.alive);assert.equal(s.specials[0].beamChecked,0);
  s.time=206;s.radius=.64;s.velocity=0;s.phase=0;step(s);
  assert.equal(s.alive,false);assert.match(s.cause,/pulsar/i);
});
test('ten-minute director is deterministic and caps stacking at two distinct effects',()=>{
  const a=createRun(771),b=createRun(771);
  for(let tick=0;tick<60*600;tick++)for(const s of [a,b]){
    immortalTick(s);assert.ok(s.alive);
    assert.ok(s.objects.length<100);assert.ok(s.crossers.length<=2);
    assert.equal(new Set(s.specials.map(p=>p.kind)).size,s.specials.length);
    assert.ok(s.specials.length<=2);
    if(s.time>240)assert.equal(s.specials.length,2);
  }
  assert.deepEqual(a,b);
});

for(const seed of [1,42,987])test('Tide to Pulsar preserves existing debris without fading or restarting waves '+seed,()=>{
 const s=createRun(seed);let handoffs=0;
 for(let i=0;i<60*196;i++){
  const old=s.objects.filter(o=>!o.collected&&o.angle>0.1);
  const nextWave=s.nextWave;immortalTick(s);
  assert.ok([...s.objects,...s.crossers].every(o=>o.phaseFade===undefined));
  if(s.events.some(e=>e.type==='phase-start'&&e.kind==='pulsar')){
   assert.ok(old.length>0);
   assert.ok(old.every(o=>s.objects.includes(o)));
   if(nextWave>s.time)assert.equal(s.nextWave,nextWave);
   assert.deepEqual(specialState(s).kinds,['pulsar']);
   assert.equal(specialState(s).gravity,1);handoffs++;
  }
 }
 assert.equal(handoffs,1);
});
test('Pulsar onset keeps rocks, plasma, gems and crossing asteroid trajectories',()=>{
 const s=scene('pulsar',195);
 const objects=['rock','plasma','shard'].map(type=>({type,radius:.9,angle:1,size:.03,spin:0,checked:false}));
 const crosser={type:'crosser',x:1.2,y:-.8,vx:-.8,vy:.1,size:.04,age:0,spin:0,warning:0,minDistance:10,tideCaptured:true};
 s.objects=objects;s.crossers=[crosser];step(s);
 for(const o of objects){assert.ok(s.objects.includes(o));assert.equal(o.radius,.9);assert.ok(o.angle<1);assert.equal(o.checked,false);}
 assert.ok(s.crossers.includes(crosser));assert.equal(crosser.vx,-.8);assert.equal(crosser.vy,.1);
 assert.ok(crosser.x<1.2);assert.ok(crosser.y>-.8);
});

test('Weave obstacles survive the Tide handoff on their original orbits',()=>{
 const s=createRun(42);let verified=false;
 for(let i=0;i<60*151;i++){
  const old=s.objects.filter(o=>o.stair&&o.angle>0).map(o=>({o,radius:o.radius}));
  immortalTick(s);
  if(s.events.some(e=>e.type==='phase-start'&&e.kind==='tide')){
   assert.ok(old.length>0);
   for(const {o,radius} of old){
    assert.ok(s.objects.includes(o));assert.equal(o.phaseFade,undefined);
    assert.equal(o.tideCaptured,undefined);assert.equal(o.radius,radius);
   }
   verified=true;
  }
 }
 assert.ok(verified);
});
