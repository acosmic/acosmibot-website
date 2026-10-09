// Local Vite development entry for trying spectator reactions and the placement
// finish screen. It uses the Activity's real markup, stylesheet, renderer and
// reaction controls, with a loopback in place of Discord, the API and the relay.
import '../src/activities/event-horizon/style.css';
import {createRun,step,specialState,thrustActive} from '../src/activities/event-horizon/sim.mjs';
import {createFlightRenderer} from '../src/activities/event-horizon/pixi-renderer.mjs';
import {flightCamera} from '../src/activities/event-horizon/camera.mjs';
import {createJuice} from '../src/activities/event-horizon/juice.mjs';
import {createAudio} from '../src/activities/event-horizon/audio.mjs';
import {createReactionUI} from '../src/activities/event-horizon/reaction-ui.mjs';
import {placementCopy} from '../src/activities/event-horizon/placement.mjs';
import {POSE_NAMES} from '../src/activities/event-horizon/darkn1de-fx.mjs';
import catalog from './event-horizon-reactions.catalog.json';
if(!import.meta.env.DEV)throw Error('Local preview only');
const page=new DOMParser().parseFromString(await (await fetch('/activities/event-horizon/index.html')).text(),'text/html');
document.getElementById('game').innerHTML=page.getElementById('game').innerHTML;
const $=id=>document.getElementById(id),canvas=$('space'),sound=createAudio();
const load=async file=>{const image=new Image();image.src=`/activities/event-horizon/assets/${file}`;await image.decode();return image;};
const rocket=await load('rocket-grip.png'),darkImages={};
for(const name of POSE_NAMES)darkImages[name]=await load(`darkn1de-${name}.webp`);
const gpu=await createFlightRenderer(canvas),juice=createJuice();
let run=createRun(42),held=false,last=performance.now(),clock=0,spectator=true,crowd=false,finished=false;
function resize(){const {width,height}=canvas.getBoundingClientRect(),camera=flightCamera(width,height),ratio=Math.min(devicePixelRatio,2),backdrop=document.createElement('canvas');backdrop.width=Math.ceil(width);backdrop.height=Math.ceil(height);const b=backdrop.getContext('2d');b.fillStyle='#050812';b.fillRect(0,0,width,height);
 const stars=Array.from({length:230},(_,i)=>({x:Math.sin(i*93.13)*.5+.5,y:Math.cos(i*17.47)*.5+.5,size:.4+i%4*.35,phase:i*.84,layer:1+i%3}));gpu.resize({width,height,ratio,camera,reduced:false,backdrop,stars});}
new ResizeObserver(resize).observe(canvas);resize();

// The relay echoes a reaction to the pilot and every viewer; here it loops straight back.
const reactions=createReactionUI({$,storage:localStorage,fetchCatalog:async()=>catalog,send:emoji=>{
  setTimeout(()=>reactions.show({type:'reaction',emoji:typeof emoji==='string'?{char:emoji}:emoji}),60);return true;}});
function view(){
  $('overlay').hidden=!finished;$('hud').hidden=finished;$('best').hidden=true;$('pause').hidden=true;
  $('watch-controls').hidden=finished||!spectator;reactions.setAvailable(!finished&&spectator);
  $('viewer-count').hidden=finished||spectator;$('viewer-count').textContent='3 watching';
  $('watch-name').textContent='Watching Pilot';$('watch-status').textContent='Live · score awaiting verification';
  $('p-spectator').setAttribute('aria-pressed',String(spectator));$('p-pilot').setAttribute('aria-pressed',String(!spectator));$('p-crowd').setAttribute('aria-pressed',String(crowd));
}
void reactions.refresh();view();
$('p-spectator').onclick=()=>{spectator=true;view();};$('p-pilot').onclick=()=>{spectator=false;view();};
$('p-crowd').onclick=()=>{crowd=!crowd;view();};
const pool=[...catalog.servers.flatMap(s=>s.emojis.slice(0,30)),{char:'🔥'},{char:'👏'},{char:'😂'},{char:'🚀'}];
setInterval(()=>{if(crowd&&!finished)for(let i=0;i<1+Math.floor(Math.random()*3);i++)reactions.show({type:'reaction',emoji:pool[Math.floor(Math.random()*pool.length)]});},220);

// Finish screen: the same headline classes and copy game.mjs applies.
function finish(rank){
  finished=true;view();const overlay=$('overlay');overlay.classList.add('compact');overlay.classList.remove('placed','champion');
  $('results').hidden=false;$('instructions').hidden=true;$('leaderboard').hidden=true;$('live-lobby').hidden=true;
  $('final-score').textContent=Math.floor(run.score).toLocaleString();$('run-stats').textContent=`${run.time.toFixed(1)}s survived · ${run.nearMisses} near-misses · ${run.shards} shards`;
  $('best-badge').hidden=rank==null;$('results').classList.toggle('new-best',rank!=null);$('record').textContent='';
  const cause='Hit by orbital debris. Watch the incoming arc and change your altitude.';
  $('rank-result').textContent=rank==null?'Replay verified · server #14 · Rank unchanged.':`Replay verified · server #${rank} · Up ${12-rank} places. New server personal best!`;
  $('launch').textContent='Fly again';$('connection-note').textContent='';
  overlay.classList.toggle('placed',rank!=null);overlay.classList.toggle('champion',rank===1);
  if(rank==null){$('screen-title').textContent='ORBIT LOST';$('screen-description').textContent=cause;sound.play('death');return;}
  const copy=placementCopy(rank);$('screen-title').textContent=copy.title;$('screen-description').textContent=`${copy.lead} ${cause}`;
  $('screen-title').classList.remove('placed-in');void $('screen-title').offsetWidth;$('screen-title').classList.add('placed-in');
  sound.unlock();sound.play(rank===1?'champion':'best');
}
$('p-first').onclick=()=>finish(1);$('p-podium').onclick=()=>finish(3);$('p-top').onclick=()=>finish(7);$('p-lost').onclick=()=>finish(null);
$('p-fly').onclick=()=>{finished=false;view();};

function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;clock+=dt;
  if(!finished){
    // Invulnerable autopilot: a staged flight, never a ranked run.
    for(let n=Math.max(1,Math.round(dt*60));n>0;n--){held=run.radius+run.velocity*.5<.83+Math.sin(run.time*.35)*.07;run.phase=Math.max(run.phase,.2);run.heat=0;step(run,{boost:held});}
    if(run.time>230){run=createRun(42);gpu.resetTransient?.(0);}
    $('score').textContent=Math.floor(run.score).toLocaleString();$('multiplier').textContent=`${run.multiplier.toFixed(1)}×`;
    $('run-time').textContent=`${Math.floor(run.time/60)}:${String(Math.floor(run.time%60)).padStart(2,'0')}`;
    $('watch-charge').textContent=`Phase Shift ${Math.floor(run.energy)}%`;
  }
  const shown={...run,phase:0};
  gpu.render({run:shown,mode:finished?'dead':'playing',watching:spectator,boost:thrustActive(run,held),flying:!finished,t:clock,dt,frameMs:dt*1000,phase:specialState(run),particles:[],comboUntil:0,comboText:'',rocket,darkImages,juice,death:null});
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
