import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,DT,specialState} from './sim.mjs';

function at(time,kind,start,seed=42){
  const s=createRun(seed);s.time=time;s.nextSpecial=start;s.nextKind=kind;s.nextWave=Infinity;s.nextCrosser=Infinity;
  return s;
}
test('five-second warnings and first phase schedule are deterministic',()=>{
  const s=createRun(42), seen=[];
  for(let i=0;i<60*240+2;i++){
    s.radius=1.02;s.velocity=0;s.heat=0;s.phase=1;step(s,{boost:true});
    for(const e of s.events)if(e.type==='phase-warning'||e.type==='phase-start')seen.push([e.type,e.kind,Math.round(s.time)]);
  }
  assert.deepEqual(seen.slice(0,6),[
    ['phase-warning','convoy',100],['phase-start','convoy',105],
    ['phase-warning','tide',145],['phase-start','tide',150],
    ['phase-warning','pulsar',190],['phase-start','pulsar',195],
  ]);
  assert.equal(seen[6][2],235);assert.equal(seen[7][2],240);
});
test('warning retires existing damage and blocks random spawns through recovery',()=>{
  const s=at(99.99,'convoy',105);s.nextWave=0;s.nextCrosser=0;
  s.objects=[{type:'rock',radius:.8,angle:0,size:.04}];
  s.crossers=[{type:'crosser',x:0,y:-.8,size:.04,age:0}];
  step(s);assert.ok(s.alive);assert.ok(s.objects[0].retiring>0);assert.ok(s.crossers[0].retiring>0);
  for(let i=0;i<60;i++){s.radius=.9;s.velocity=0;step(s);}
  assert.equal(s.crossers.length,0);assert.equal(s.objects.length,0);
  assert.equal(s.wave,0);
  s.time=122.99;s.special.waves=3;step(s);
  assert.equal(s.special,null);assert.ok(s.recoveryUntil>=133);
  assert.equal(s.nextSpecial,150);
});
for(const [kind,start,end] of [['convoy',105,123],['tide',150,170],['pulsar',195,202]]){
  for(const initial of [.48,.8,1.065])for(const seed of [1,42,987]){
    test(`${kind} is survivable without Phase Shift from radius ${initial}, seed ${seed}`,()=>{
      const s=at(start-5,kind,start,seed);s.radius=initial;s.energy=0;
      while(s.time<end&&s.alive){
        const target=kind==='convoy'?(s.special?.gap??.9):.99;
        step(s,{boost:s.radius+s.velocity*.7<target});
      }
      assert.ok(s.alive,s.cause);assert.ok(s.time>=end);
    });
  }
}
test('tide has three 4-second pulses separated by 3-second gaps',()=>{
  const s=at(145,'tide',150);step(s);
  for(const [age,mult] of [[0,1],[2,1.15],[5.9,1.15],[6,1],[9,1.15],[13,1],[16,1.15],[20,1]]){
    s.time=150+age;assert.equal(specialState(s).gravity,mult);
  }
});
test('pulsar warning is safe, active beam damages, Phase Shift crosses safely',()=>{
  const s=at(194.99,'pulsar',195);s.radius=.7;step(s);
  assert.equal(specialState(s).beam,null);assert.ok(s.alive);
  s.time=199;s.radius=.50+(2+DT)*.08;s.velocity=0;step(s);assert.equal(s.alive,false);
  const shielded=at(194.99,'pulsar',195);step(shielded);shielded.time=199;shielded.radius=.50+(2+DT)*.08;
  step(shielded,{dash:true});assert.ok(shielded.alive);assert.equal(shielded.special.beamChecked,true);
});
test('post-four-minute director has recovery, no repeated adjacent kind, bounded objects and deterministic output',()=>{
  const a=createRun(771),b=createRun(771), starts=[], ends=[];
  for(let tick=0;tick<60*600;tick++)for(const s of [a,b]){
    s.radius=1.02;s.velocity=0;s.heat=0;s.phase=1;step(s,{boost:true});
    assert.ok(s.alive);assert.ok(s.objects.length<100);assert.ok(s.crossers.length<=2);
    if(s===a)for(const e of s.events){if(e.type==='phase-start')starts.push({kind:e.kind,time:s.time});if(e.type==='phase-end')ends.push(s.time);}
  }
  assert.deepEqual(a,b);
  for(let i=1;i<starts.length;i++){
    assert.notEqual(starts[i].kind,starts[i-1].kind);
    assert.ok(starts[i].time-ends[i-1]>=14.9);
  }
});
