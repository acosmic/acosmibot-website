import test from 'node:test';
import assert from 'node:assert/strict';
import {SnapshotPlayback} from './playback.mjs';
import {createRun} from './sim.mjs';
const state=(time)=>({...createRun(42),time,tick:Math.round(time*60),radius:.8+time*.01,objects:[{id:'rock',angle:1-time,spin:time}],crossers:[{id:'crossing',x:time,y:-time,warning:0}]});
test('interpolates the pilot and hazards without guessing scores, spawns or death',()=>{
  const p=new SnapshotPlayback();const a=state(1),b=state(1.1);b.energy=0;b.phase=1;b.objects.push({id:'new',angle:3});
  p.push(a,'playing',0,1000);p.push(b,'playing',1,1100);
  const view=p.sample(1200).state;
  assert.ok(Math.abs(view.radius-.8105)<1e-9);assert.ok(Math.abs(view.objects[0].angle+.05)<1e-9);
  assert.ok(Math.abs(view.crossers[0].x-1.05)<1e-9);assert.equal(view.objects.length,1);assert.equal(view.phase,0);
  assert.deepEqual(a,state(1));assert.equal(p.sample(5000).state,b);
});
test('jittered arrivals stay monotonic and continue between packets',()=>{
  const p=new SnapshotPlayback();let next=0,last=-Infinity,moving=0;
  const arrivals=[0,130,205,345,405,530,602,710,845,902];
  for(let now=0;now<=1050;now+=10){
    while(next<arrivals.length&&arrivals[next]<=now){p.push(state(next/10),'playing',0,arrivals[next]);next++;}
    const view=p.sample(now);if(!view)continue;
    assert.ok(view.state.time>=last);if(view.state.time>last)moving++;last=view.state.time;
  }
  assert.ok(moving>70,`only ${moving} moving samples`);
});
test('pause, resume, replacement and reconnect reset the playback clock',()=>{
  const p=new SnapshotPlayback();p.push(state(5),'playing',0,1000);p.push(state(5.1),'playing',0,1100);
  const paused=state(5.2);p.push(paused,'paused',0,1200);assert.equal(p.sample(9999).state,paused);
  p.push(state(5.2),'playing',0,10000);p.push(state(5.3),'playing',0,10100);
  assert.ok(p.sample(10200).state.time<5.3);
  p.push(state(0),'playing',0,11000);assert.equal(p.sample(11000).state.time,0);
  p.reset();assert.equal(p.sample(11000),null);
});
test('buffer remains bounded under a hidden-tab pause',()=>{
  const p=new SnapshotPlayback();for(let i=0;i<100;i++)p.push(state(i/10),'playing',0,i*100);
  assert.equal(p.frames.length,12);assert.ok(p.sample(11000).state.time<=9.9);
});
