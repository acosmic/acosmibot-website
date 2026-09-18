import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveClient, snapshotForView } from './live.mjs';
import { createRun } from './sim.mjs';
import { activityFor } from './presence.mjs';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
class Socket {
  constructor(url){this.url=url;this.readyState=0;this.bufferedAmount=0;this.handlers={};this.sent=[];}
  addEventListener(type,handler){(this.handlers[type]??=[]).push(handler);}
  emit(type,event={}){for(const fn of this.handlers[type]||[])fn(event);}
  open(){this.readyState=1;this.emit('open');}
  send(raw){this.sent.push(JSON.parse(raw));}
  message(message){this.emit('message',{data:JSON.stringify(message)});}
  close(code=1000){this.readyState=3;this.emit('close',{code});}
}
function fixture(api=async()=>({ticket:'ticket',path:'/event-horizon-live',protocol:1})){
  const sockets=[],messages=[],statuses=[];
  const live=new LiveClient({api,onMessage:m=>messages.push(m),onStatus:s=>statuses.push(s),origin:'https://example.discordsays.com',socketFactory:url=>{const s=new Socket(url);sockets.push(s);return s;}});
  return {live,sockets,messages,statuses};
}
test('authenticate in a frame, never URL credentials; viewer creates no run',async()=>{
  const requests=[],f=fixture(async(path,body)=>{requests.push([path,body]);return {ticket:'secret',path:'/event-horizon-live',protocol:1};});
  try{
    f.live.start();await settle();const s=f.sockets[0];s.open();
    assert.equal(s.url,'wss://example.discordsays.com/event-horizon-live');assert.deepEqual(s.sent[0],{type:'authenticate',ticket:'secret'});
    s.message({type:'authenticated'});f.live.watch('flight');
    assert.deepEqual(requests,[['/live-ticket',{runId:null}]]);assert.equal(s.sent.at(-1).type,'watch');
  }finally{f.live.stop();}
});
test('failed watch clears reconnect target; renewal does not rejoin',async()=>{
  const f=fixture();try{
    f.live.start();await settle();const s=f.sockets[0];s.open();s.message({type:'authenticated'});
    f.live.watch('flight');s.message({type:'authenticated'});assert.equal(s.sent.filter(m=>m.type==='watch').length,1);
    s.message({type:'error',code:'unavailable'});assert.equal(f.live.target,null);
    f.live.watch('full');s.message({type:'error',code:'full'});assert.equal(f.live.target,null);
  }finally{f.live.stop();}
});
test('session replacement stops retrying; frames do not mutate pilot state',async()=>{
  const f=fixture();try{
    f.live.start();await settle();const s=f.sockets[0];s.open();s.message({type:'authenticated'});
    const run=createRun(42);run.events=[{type:'dash'}];f.live.snapshot(run,'playing',1);
    assert.deepEqual(s.sent.at(-1).state.events,[]);assert.equal(run.events.length,1);
    s.close(4001);assert.equal(f.live.enabled,false);assert.equal(f.statuses.at(-1),'replaced');
  }finally{f.live.stop();}
});
test('stale ticket response cannot replace a newer run connection',async()=>{
  let resolve;const f=fixture(()=>new Promise(r=>resolve=r));
  try{
    f.live.start();const first=resolve;f.live.setRun('new');first({ticket:'old',path:'/event-horizon-live',protocol:1});
    await settle();assert.equal(f.sockets.length,0);
    resolve({ticket:'new',path:'/event-horizon-live',protocol:1});await settle();assert.equal(f.sockets.length,1);
  }finally{f.live.stop();}
});
test('viewer state is isolated and malformed input ignored',()=>{
  const state=createRun(42),copy=snapshotForView({type:'snapshot',state});copy.score=50;
  assert.equal(state.score,0);assert.equal(snapshotForView({type:'snapshot',state:{tick:NaN}}),null);
});
test('presence names Event Horizon and separates pilot/watch/lobby modes',()=>{
  assert.equal(activityFor('playing',123).details,'Event Horizon');assert.equal(activityFor('playing',123).timestamps.start,123);
  assert.equal(activityFor('watching',123).state,'Watching a flight');assert.equal(activityFor('paused',123).timestamps,undefined);
});
test('presentation IDs track moving hazards without modifying ranked state',async()=>{
  const f=fixture();try{
    f.live.start();await settle();const s=f.sockets[0];s.open();s.message({type:'authenticated'});
    const run=createRun(42);const first={type:'rock',angle:1},second={type:'crosser',x:1};run.objects=[first];run.crossers=[second];
    const original=structuredClone(run);f.live.snapshot(run,'playing',0);const a=s.sent.at(-1).state;
    assert.deepEqual(run,original);assert.notEqual(a.objects[0].id,a.crossers[0].id);
    first.angle=.9;run.objects.unshift({type:'rock',angle:2});f.live.snapshot(run,'playing',0);const b=s.sent.at(-1).state;
    assert.equal(b.objects[1].id,a.objects[0].id);assert.equal(b.crossers[0].id,a.crossers[0].id);
  }finally{f.live.stop();}
});
