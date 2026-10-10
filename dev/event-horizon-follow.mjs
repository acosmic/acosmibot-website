// Local presentation rehearsal only. No Discord identity, network relay, or ranked writes.
import { createRun } from '../src/activities/event-horizon/sim.mjs';
const realFetch=window.fetch.bind(window);
window.fetch=async(input,options)=>{
  const url=String(input);
  if(url==='/api/event-horizon/config')return new Response(JSON.stringify({enabled:true,watchEnabled:false,clientId:'preview',version:'event-horizon-v10'}),{headers:{'Content-Type':'application/json'}});
  if(url.startsWith('/api/event-horizon/'))return new Response('{}',{status:503});
  return realFetch(input,options);
};
await import('../src/activities/event-horizon/game.mjs');
let transport, following=false, runId='preview-1', state=createRun(42);
function emit(message){transport?.emit('message',{data:JSON.stringify(message)});}
function list(){emit({type:'flights',flights:[{runId,name:'Preview pilot',status:'playing',score:state.score,time:state.time,viewers:following?1:0}]});}
function join(){emit({type:'watching',runId,pilotId:'12',name:'Preview pilot'});snapshot();}
function snapshot(){emit({type:'snapshot',state,status:state.alive?'playing':'dead',input:0});}
class PreviewSocket{
  readyState=1;bufferedAmount=0;handlers={};
  constructor(){transport=this;setTimeout(()=>this.emit('open'),0);}
  addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
  emit(type,event={}){for(const fn of this.handlers[type]||[])fn(event);}
  send(raw){const m=JSON.parse(raw);if(m.type==='authenticate'){emit({type:'authenticated',features:['follow-pilot'],expiresAt:9999999999});list();}if(m.type==='watch'){following=true;join();}if(m.type==='unwatch')following=false;}
  close(){this.readyState=3;this.emit('close',{code:1000});}
}
const controls=document.createElement('div');controls.style.cssText='position:fixed;top:8px;right:8px;z-index:100;display:flex;gap:8px';
function button(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=fn;controls.append(b);}
button('Connect preview',()=>window.__eventHorizonDev.connectLive({api:async()=>({ticket:'preview',protocol:1,path:'/event-horizon-live'}),socketFactory:()=>new PreviewSocket(),origin:location.origin}));
button('Pilot loses',()=>{state.alive=false;state.score=38484;state.time=86;state.tick=5160;if(following){snapshot();emit({type:'verified',result:{score:38484,rank:2}});}});
button('Remove ended flight',()=>{if(following)emit({type:'ended',reason:'Pilot left'});});
button('Pilot starts next flight',()=>{runId='preview-'+(Number(runId.split('-')[1])+1);state=createRun(43);if(following)join();list();});
button('Preview casual flight',()=>window.__eventHorizonDev.fly());
document.body.append(controls);
setInterval(()=>{if(following&&state.alive)snapshot();},150);
