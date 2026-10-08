import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,DT,thrustActive,resonanceReady} from './sim.mjs';
import {darkn1deView,SIGHTINGS} from './darkn1de-fx.mjs';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const verifier=new URL('../../../../acosmibot-api/api/game_engines/event_horizon_v9.mjs',import.meta.url);
test('browser and v9 verifier are byte-identical',{skip:!existsSync(verifier)&&'API sibling checkout not present'},async()=>assert.equal(await readFile(new URL('./sim.mjs',import.meta.url),'utf8'),await readFile(verifier,'utf8')));
function at(seconds){const s=createRun(42);s.time=seconds-DT;s.tick=Math.round(seconds*60)-1;s.nextWave=s.nextCrosser=1e6;s.stormStarted=true;return s;}
function safeTick(s,input={}){s.phase=1;s.heat=0;step(s,input);}
test('sightings are short, silent, cosmetic and never consume RNG',()=>{
  const s=createRun(8),copy=structuredClone(s);
  assert.deepEqual(SIGHTINGS,[30,82,127,172,217]);
  for(const [i,t] of SIGHTINGS.entries()){
    assert.equal(darkn1deView({...s,time:t+.2}).sight,i);
    assert.equal(darkn1deView({...s,time:t+1.2}).sight,-1);
  }
  assert.deepEqual(s,copy);
});
test('inversion starts at tick 14400 without a warning or velocity flip, and ends at 17100',()=>{
  const s=at(240);s.velocity=.1;step(s,{boost:true});
  assert.equal(s.darkStage,1);assert.ok(s.velocity>0&&s.velocity<.1);
  assert.deepEqual(s.events,[{type:'dark-arrival'}]);assert.equal(s.specials.length,0);
  assert.equal(thrustActive(s,true),false);assert.equal(thrustActive(s,false),true);
  s.time=285-DT;s.tick=17099;s.velocity=.1;step(s,{boost:true});
  assert.equal(s.darkStage,2);assert.ok(s.velocity>.1);
  assert.equal(s.events.filter(e=>e.type==='breach-start').length,1);
});
test('release thrust and held gravity preserve the same physics and Phase Shift',()=>{
  const a=at(240),b=at(240);step(a,{boost:false,dash:true});step(b,{boost:true,dash:true});
  assert.ok(a.velocity>b.velocity);assert.equal(a.phase,.75);assert.equal(b.phase,.75);
  assert.equal(a.energy,b.energy);
});
test('ten shards empower the next press, independent of ordinary energy, and clear only boss hazards',()=>{
  const s=at(285);step(s);s.energy=0;
  for(let i=0;i<10;i++){
    s.radius=.8;s.velocity=0;
    s.objects=[{type:'resonance',radius:.8,angle:0,size:.029,spin:0,shape:0,checked:false}];
    safeTick(s);assert.equal(s.resonance,i+1);
  }
  assert.ok(resonanceReady(s));assert.equal(s.shards,0);
  const rock={type:'rock',radius:.9,angle:1,size:.035,spin:0,shape:0,checked:false};
  s.objects=[rock];s.crossers=[];safeTick(s,{dash:true});
  assert.equal(s.darkStage,3);assert.equal(s.attacks.length,0);assert.ok(s.objects.includes(rock));
  assert.equal(s.phase,2.5);assert.equal(s.events.filter(e=>e.type==='resonance-pulse').length,1);
  for(let i=0;i<130;i++){s.radius=.85;s.velocity=0;safeTick(s);}
  assert.equal(s.specials.length,2);assert.equal(thrustActive(s,true),true);
});
test('ordinary Shift does not consume resonance, held Shift cannot auto-fire a pulse',()=>{
  const s=at(285);step(s);s.resonance=6;safeTick(s,{dash:true});assert.equal(s.resonance,6);
  s.resonance=10;s.energy=0;safeTick(s,{dash:true});assert.equal(s.darkStage,2);
  safeTick(s,{dash:false});safeTick(s,{dash:true});assert.equal(s.darkStage,3);
});
test('Breachstorm replaces missed shards for the entire replay limit and caps overlap',()=>{
  const a=at(285),b=at(285);let firstGap,lateGap;
  for(let i=0;i<60*315;i++)for(const s of [a,b]){
    s.radius=1.04;s.velocity=0;safeTick(s,{boost:true});
    assert.ok(s.alive,s.cause);assert.ok(s.attacks.length<=12);assert.ok(s.objects.filter(o=>o.type==='resonance').length<=4);
    assert.equal(s.specials.length,0);
    if(s===a&&s.attackNumber===1)firstGap=s.nextAttack-s.time;
    if(s===a&&s.time>590)lateGap=s.nextAttack-s.time;
  }
  assert.deepEqual(a,b);assert.ok(a.attackNumber>90);assert.ok(firstGap<=4.8);assert.ok(lateGap<=2.6+DT);
});
test('claws leave a broad shard corridor and spears commit their original target',()=>{
  const s=at(285);step(s);
  const shard=s.objects.find(o=>o.type==='resonance');
  assert.equal(s.attacks.length,3);
  assert.ok(s.attacks.every(o=>Math.abs(o.radius-shard.radius)>o.size+.028+.1));
  s.time=s.nextAttack;s.radius=.85;safeTick(s);
  const spear=s.attacks.find(o=>o.type==='spear'),target=spear.y;s.radius=.98;
  for(let i=0;i<30;i++)safeTick(s);
  assert.equal(spear.y,target);assert.ok(spear.warning>0);
});
test('boss collision is swept and Shift protects',()=>{
  for(const phase of [0,1]){
    const s=at(285);step(s);s.phase=phase;s.radius=.8;s.velocity=0;
    s.attacks=[{id:'spear',type:'spear',x:.005,y:-.8,vx:-1.15,vy:0,size:.033,age:2,warning:0,checked:false}];
    step(s);assert.equal(s.alive,phase>0);if(!phase)assert.match(s.cause,/spear/);
  }
});

test('all gameplay before four minutes retains the v8 checkpoint',()=>{
 const a=createRun(42);
 for(let i=0;i<14399;i++){
  a.radius=.82;a.velocity=0;a.heat=0;a.phase=1;step(a,{boost:i%2===0});
 }
 for(const key of ['darkStage','resonance','darkDefeatedAt','nextAttack','attackNumber','attacks'])delete a[key];
 // Frozen from the immutable v8 engine with this exact seed/input fixture.
 assert.equal(createHash('sha256').update(JSON.stringify(a)).digest('hex'),'ee8925fcdd592e48bb659de911619db5dedd23e6e39357ea850105f4d8a406d1');
});

for(const radius of [.55,.65,.85,1.04])test('boss corridors can collect ten shards with normal physics from '+radius,()=>{
 const s=at(285);s.radius=radius;
 // Isolate boss geometry from baseline debris; no invulnerability/position resets.
 while(s.alive&&s.time<400&&s.darkStage!==3){
  const next=s.objects.filter(o=>o.type==='resonance'&&o.angle>-.1).sort((a,b)=>a.angle-b.angle)[0];
  step(s,{boost:s.radius+s.velocity*.5<(next?.radius??.8),dash:s.resonance>=10});
 }
 assert.ok(s.alive,s.cause);assert.equal(s.darkStage,3);assert.equal(s.resonance,10);
});
