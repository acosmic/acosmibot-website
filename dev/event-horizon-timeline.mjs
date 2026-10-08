import {createRun,step,DT,specialState,thrustActive} from '../src/activities/event-horizon/sim.mjs';
import {createFlightRenderer} from '../src/activities/event-horizon/pixi-renderer.mjs';
import {flightCamera} from '../src/activities/event-horizon/camera.mjs';
import {createJuice} from '../src/activities/event-horizon/juice.mjs';
import {SIGHTINGS} from '../src/activities/event-horizon/darkn1de-fx.mjs';
// This file is a local Vite development entry, deliberately absent from build inputs.
if(!import.meta.env.DEV)throw Error('Local visual rehearsal only');
const $=id=>document.getElementById(id),canvas=$('space'),timeline=$('timeline');
const load=async name=>{const image=new Image();image.src=`/activities/event-horizon/assets/${name}.png`;await image.decode();return image;};
const rocket=await load('rocket-grip'),darkImages={};
for(const name of ['arrival','inversion','apparition'])darkImages[name]=await load(`darkn1de-${name}`);
const gpu=await createFlightRenderer(canvas),frames=[],s=createRun(42);
let clock=0,playing=false,last=performance.now(),reduced=false,held=false,dirty=true;
// Rehearsal fixtures suppress damage and stage a ten-shard counterattack at 5:30.
// They never enter the actual game or verifier, and make no network/API requests.
for(let i=0;i<=360*60;i++){
  const next=s.objects.filter(o=>o.type==='resonance'&&o.angle>0).sort((a,b)=>a.angle-b.angle)[0];
  const target=s.darkStage===2?(next?.radius??.83):.83+Math.sin(s.time*.35)*.07;
  held=s.radius+s.velocity*.5<target;if(s.darkStage===1)held=!held;
  s.phase=1;s.heat=0;s.alive=true;
  if(s.darkStage===2)s.resonance=Math.min(10,Math.floor((s.time-285)/4.4));
  step(s,{boost:held,dash:s.time>=330&&s.darkStage===2});
  if(i%3===0){const copy=structuredClone(s);copy.phase=s.darkStage===3&&s.time-s.darkDefeatedAt<2.5?2.5-(s.time-s.darkDefeatedAt):0;copy.alive=true;copy.cause='';frames.push({run:copy,held});}
}
function resize(){dirty=true;const {width,height}=canvas.getBoundingClientRect(),camera=flightCamera(width,height),ratio=Math.min(devicePixelRatio,2),backdrop=document.createElement('canvas');backdrop.width=Math.ceil(width);backdrop.height=Math.ceil(height);const b=backdrop.getContext('2d');b.fillStyle='#050812';b.fillRect(0,0,width,height);
 for(const [x,y,r,color] of [[.85,.25,.6,'#261747'],[.16,.7,.7,'#092e4c'],[.65,.72,.35,'#331136']]){const grad=b.createRadialGradient(width*x,height*y,0,width*x,height*y,width*r);grad.addColorStop(0,color);grad.addColorStop(1,'#05081200');b.fillStyle=grad;b.fillRect(0,0,width,height);}
 const stars=Array.from({length:230},(_,i)=>({x:Math.sin(i*93.13)*.5+.5,y:Math.cos(i*17.47)*.5+.5,size:.4+i%4*.35,phase:i*.84,layer:1+i%3}));gpu.resize({width,height,ratio,camera,reduced,backdrop,stars});}
new ResizeObserver(resize).observe(canvas);resize();
const marks=[[0,'Launch'],[30.25,'0:30 · Eyes'],[82.3,'1:22 · Seam'],[127.4,'2:07 · Hood'],[172.4,'2:52 · Particles'],[217.5,'3:37 · Grip'],[240,'4:00 · Inversion'],[285.5,'4:45 · Breachstorm'],[291.5,'Gravity spear'],[329.5,'Pulse ready'],[330.8,'EMP defeat'],[337,'Mixed phases']];
for(const [time,title] of marks){const button=document.createElement('button');button.textContent=title;button.onclick=()=>{gpu.resetTransient(time);dirty=true;clock=time;timeline.value=clock;playing=false;$('play').textContent='Play';};document.querySelector('nav').append(button);}
timeline.oninput=()=>{clock=Number(timeline.value);gpu.resetTransient(clock);dirty=true;playing=false;$('play').textContent='Play';};
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play';};
$('reduced').onchange=()=>{reduced=$('reduced').checked;resize();};
function render(now){if(!playing&&!dirty){last=now;requestAnimationFrame(render);return;}dirty=false;const dt=Math.min(.05,(now-last)/1000);last=now;if(playing){clock=Math.min(360,clock+dt*Number($('speed').value));timeline.value=clock;if(clock>=360){playing=false;$('play').textContent='Play';}}
 const {run,held}=frames[Math.min(frames.length-1,Math.round(clock*20))];
 $('clock').textContent=`${Math.floor(clock/60)}:${(clock%60).toFixed(1).padStart(4,'0')}`;
 const sight=SIGHTINGS.findIndex(t=>clock>=t&&clock<t+1.2);
 $('scene').textContent=run.darkStage===1?'INVERSION · HOLD TO DESCEND / RELEASE TO CLIMB':run.darkStage===2?`BREACHSTORM · RESONANCE ${run.resonance}/10`:run.darkStage===3&&clock<333?'RESONANCE PULSE':sight>=0?'SUBTLE SIGHTING':specialState(run).kind.toUpperCase();
 gpu.render({run,mode:'playing',watching:false,boost:thrustActive(run,held),flying:true,t:clock,dt,frameMs:16.7,phase:specialState(run),particles:[],comboUntil:0,comboText:'',rocket,darkImages,juice:createJuice(),death:null});requestAnimationFrame(render);}
requestAnimationFrame(render);
