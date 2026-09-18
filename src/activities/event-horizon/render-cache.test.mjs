import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {compactParticles,cachedLabel} from './render-cache.mjs';
import {drawBlackHole} from './black-hole.mjs';
function draw(r,reduced,time){
 const trace=[];let gradients=0;
 const ctx=new Proxy({}, {get(target,key){
 if(key==='measureText')return char=>({width:char.charCodeAt(0)/10});
 if(key==='createRadialGradient')return (...args)=>{const id=gradients++;trace.push([key,...args]);return {id,addColorStop:(...args)=>trace.push(['addColorStop',id,...args])};};
 return (...args)=>trace.push([key,...args]);
 },set(target,key,value){trace.push(['set',key,value?.id===undefined?value:{gradient:value.id}]);return true;}});
 const cache={};
 const render=t=>drawBlackHole(ctx,t,{cx:333,cy:500,r},reduced,cache);
 render(time);render(time+.016);return trace;
}

// Golden canvas command traces from the pre-cache renderer in 9083ac8.
// Includes cold and warm cache frames, full/reduced effects and multiple sizes.
test('black-hole canvas commands remain identical to the approved renderer',()=>{
 const golden=JSON.parse(fs.readFileSync(new URL('./fixtures/hole-draw-traces.json',import.meta.url),'utf8'));
 for(const {r,reduced,t,sha256} of golden){
  const trace=draw(r,reduced,t);
  assert.equal(createHash('sha256').update(JSON.stringify(trace)).digest('hex'),sha256,JSON.stringify({r,reduced,t}));
 }
});
test('particle compaction preserves references, retention and draw order at the cap',()=>{
 for(const n of [0,1,239,240,241,500])for(const deadEvery of [0,1,2,3]){
  const particles=Array.from({length:n},(_,i)=>({i,life:deadEvery&&i%deadEvery===0?0:1}));
  const expected=particles.filter(p=>p.life>0).slice(-240);
  compactParticles(particles);assert.equal(particles.length,expected.length);
  for(let i=0;i<expected.length;i++)assert.equal(particles[i],expected[i]);
 }
});
test('labels format only when their displayed numeric value changes, including resets',()=>{
 const label=cachedLabel();let calls=0;const format=n=>{calls++;return n.toLocaleString();};
 for(let i=0;i<100;i++)assert.equal(label('best',1234,format),(1234).toLocaleString());
 assert.equal(calls,1);label('score',1234,format);assert.equal(calls,2);
 assert.equal(label('best',0,format),'0');assert.equal(calls,3);
});
