// Presentation only. Spectators interpolate pilot snapshots; they never run
// collision, scoring, spawning, or death simulation on guessed controls.
const mix=(a,b,t)=>a+(b-a)*t;
const clamp=(n,low,high)=>Math.max(low,Math.min(high,n));
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
  reset(){this.frames=[];this.lastArrival=0;this.lastSample=null;this.playhead=null;this.status=null;this.jitter=0;this.interval=100;}
  push(state,status,input,now){
    const time=state.time*1000;
    const previous=this.frames.at(-1);
    if(status!==this.status||now-this.lastArrival>1000||time<(previous?.time??-Infinity))this.reset();
    if(this.frames.length){
      const progress=time-this.frames.at(-1).time;
      if(progress>0){
        this.interval=mix(this.interval,clamp(progress,25,250),.1);
        this.jitter=mix(this.jitter,Math.max(0,now-this.lastArrival-progress),.1);
      }
    }
    if(this.playhead===null){this.playhead=time-this.delay;this.lastSample=now;}
    this.status=status;this.lastArrival=now;
    if(status!=='playing')this.frames=[];
    this.frames.push({state,time,input});
    if(this.frames.length>12)this.frames.shift();
  }
  sample(now){
    if(!this.frames.length)return null;
    const last=this.frames.at(-1);
    if(this.status!=='playing')return last;
    // Follow buffered simulation progress, not a permanent wall-clock offset.
    // The pilot intentionally drops excess simulation time after short stalls.
    // Ease playback toward its buffer target so those stalls cannot permanently
    // drain interpolation and lock motion to the 10 Hz snapshot rate.
    const elapsed=Math.max(0,now-this.lastSample);this.lastSample=now;
    const targetDelay=this.delay+Math.min(150,this.jitter*2);
    const head=last.time+Math.min(Math.max(0,now-this.lastArrival),this.interval);
    const error=head-(this.playhead+elapsed)-targetDelay;
    let next=this.playhead+elapsed*clamp(1+error*.002,.85,1.1);
    if(next>=last.time){
      const available=Math.max(0,last.time-this.playhead);
      next=this.playhead+available*(1-Math.exp(-elapsed/50));
    }
    if(now-this.lastArrival>1000)next=last.time;
    const time=this.playhead=Math.max(this.playhead,Math.min(last.time,next));
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
