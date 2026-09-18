import {SnapshotPlayback} from '../../src/activities/event-horizon/playback.mjs';
import {createRun} from '../../src/activities/event-horizon/sim.mjs';
function scenario(stall=false){
 const playback=new SnapshotPlayback(),packets=[];
 for(let wall=0;wall<=20000;wall+=100){
  if(stall&&wall>10000&&wall<10300)continue;
  // A 300ms pilot scheduling stall advances only 100ms because game.mjs
  // caps dt at .1 seconds. No pause occurs below its .6-second pause gate.
  const time=(wall-(stall&&wall>=10300?200:0))/1000;
  packets.push({arrival:wall+50,state:{...createRun(42),time,tick:Math.round(time*60),radius:.8,objects:[{id:'moving',angle:time,spin:time}],crossers:[]}});
 }
 let next=0,last=null,flat=0,total=0,maxJump=0;
 for(let frame=0;frame<=1200;frame++){
  const now=frame*1000/60;
  while(next<packets.length&&packets[next].arrival<=now){const p=packets[next++];playback.push(p.state,'playing',0,p.arrival);}
  const sample=playback.sample(now);if(!sample)continue;
  const position=sample.state.objects[0].angle;
  if(now>=11000&&last!==null){total++;if(Math.abs(position-last)<1e-9)flat++;maxJump=Math.max(maxJump,position-last);}
  last=position;
 }
 return {scenario:stall?'one 300ms pilot scheduling stall':'steady pilot',postStallFrames:total,unchangedMotionFrames:flat,unchangedPercent:flat/total*100,maxSimulationTimeJumpSeconds:maxJump};
}
console.log(JSON.stringify([scenario(false),scenario(true)],null,2));
