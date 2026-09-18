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
test('one short pilot stall cannot permanently reduce motion to snapshot frequency',()=>{
 const p=new SnapshotPlayback(),packets=[];
 for(let wall=0;wall<=20000;wall+=100){
  if(wall>10000&&wall<10300)continue;
  packets.push({arrival:wall+50,state:state((wall-(wall>=10300?200:0))/1000)});
 }
 let next=0,last=-Infinity,flat=0,total=0,maxJump=0;
 for(let frame=0;frame<=1200;frame++){
  const now=frame*1000/60;
  while(next<packets.length&&packets[next].arrival<=now){const packet=packets[next++];p.push(packet.state,'playing',0,packet.arrival);}
  const view=p.sample(now);if(!view)continue;
  assert.ok(view.state.time>=last,'playback must not rewind');
  if(now>=11000){total++;if(Math.abs(view.state.time-last)<1e-9)flat++;maxJump=Math.max(maxJump,view.state.time-last);}
  last=view.state.time;
 }
 assert.ok(flat/total<.02,`${flat}/${total} frames stopped moving after recovery`);
 assert.ok(maxJump<.025,`jumped ${maxJump}s after recovery`);
});
test('variable pilot cadence and arrival jitter keep the playback clock bounded',()=>{
 const p=new SnapshotPlayback();let last=-Infinity,time=0;
 for(let i=0;i<240;i++){
  const arrival=i*100+(i%7===0?70:0);
  time+=i%11===0?.05:.1;
  p.push(state(time),'playing',0,arrival);
  for(let j=0;j<5;j++){
   const view=p.sample(arrival+j*6);
   assert.ok(view.state.time>=last);assert.ok(view.state.time<=time+1e-9);last=view.state.time;
  }
 }
 assert.ok(time-last<.5,'buffer latency remains bounded');
 const ended={...state(time+.1),alive:false};p.push(ended,'dead',0,25000);
 assert.equal(p.sample(25000).state,ended);
});

test('ordered packet bursts recover without rewinding or jumping to the newest snapshot',()=>{
 const packets=[];
 for(let i=0;i<200;i++){
  const wall=i*100,cycle=i%20;
  packets.push({arrival:wall+(cycle>=5&&cycle<=8?(9-cycle)*100:0),state:state(i/10)});
 }
 const p=new SnapshotPlayback();let next=0,last=0,maxJump=0;
 for(let frame=0;frame<1200;frame++){
  const now=frame*1000/60;
  while(next<packets.length&&packets[next].arrival<=now){const packet=packets[next++];p.push(packet.state,'playing',0,packet.arrival);}
  const view=p.sample(now);if(!view)continue;
  assert.ok(view.state.time>=last);assert.ok(view.state.time<=packets[next-1].state.time);
  maxJump=Math.max(maxJump,view.state.time-last);last=view.state.time;
 }
 assert.ok(maxJump<.025,`burst caused a ${maxJump}s presentation jump`);
 assert.ok(19.9-last<.5,'playback catches up to its normal buffer');
});
