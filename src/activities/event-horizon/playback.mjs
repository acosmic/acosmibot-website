// Presentation only. Spectators interpolate pilot snapshots; they never run
// collision, scoring, spawning, or death simulation on guessed controls.
const mix=(a,b,t)=>a+(b-a)*t;
const rootFields=['time','radius','velocity','heat','score','multiplier'];
const objectFields=['radius','angle','spin','x','y','age','warning'];
function blendObjects(a,b,t){
  const next=new Map(b.filter(o=>o.id).map(o=>[o.id,o]));
  return a.map(o=>{
    const target=next.get(o.id);if(!target)return o;
    const result={...o};
    for(const key of objectFields)if(Number.isFinite(o[key])&&Number.isFinite(target[key]))result[key]=mix(o[key],target[key],t);
    return result;
  });
}
export class SnapshotPlayback {
  constructor({delay=150}={}){this.delay=delay;this.reset();}
  reset(){this.frames=[];this.offset=null;this.lastArrival=0;this.playhead=-Infinity;this.status=null;}
  push(state,status,input,now){
    const time=state.time*1000;
    if(status!==this.status||now-this.lastArrival>1000||time<(this.frames.at(-1)?.time??-Infinity))this.reset();
    this.status=status;this.lastArrival=now;
    this.offset=Math.min(this.offset??Infinity,now-time);
    if(status!=='playing')this.frames=[];
    this.frames.push({state,time,input});
    if(this.frames.length>12)this.frames.shift();
  }
  sample(now){
    if(!this.frames.length)return null;
    const last=this.frames.at(-1);
    if(this.status!=='playing')return last;
    // Never rewind as packets jitter, and freeze at the newest known state
    // during an outage instead of inventing a collision or a new hazard.
    const time=this.playhead=Math.max(this.playhead,Math.min(last.time,now-this.offset-this.delay));
    while(this.frames.length>2&&this.frames[1].time<=time)this.frames.shift();
    const a=this.frames[0],b=this.frames[1];
    if(!b||time<=a.time)return a;
    if(time>=b.time)return b;
    const t=(time-a.time)/(b.time-a.time),state={...a.state};
    for(const key of rootFields)state[key]=mix(a.state[key],b.state[key],t);
    if(a.state.phase>0&&b.state.phase>0)state.phase=mix(a.state.phase,b.state.phase,t);
    if(Math.abs(b.state.energy-a.state.energy)<10)state.energy=mix(a.state.energy,b.state.energy,t);
    state.objects=blendObjects(a.state.objects,b.state.objects,t);
    state.crossers=blendObjects(a.state.crossers,b.state.crossers,t);
    return {state,input:a.input,time};
  }
}
