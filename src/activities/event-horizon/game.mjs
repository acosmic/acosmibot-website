import { createRun, step, DT, clamp } from './sim.mjs';
import { drawNoseHeat, visualHeat, rocketTremble } from './heat-fx.mjs';
import { DiscordSDK, patchUrlMappings } from '@discord/embedded-app-sdk';
import { api, refreshBoard, renderBoard, boardReady, setRankedAvailable, setSession } from './leaderboard.mjs';
import './style.css';

const $ = id => document.getElementById(id);
const canvas = $('space');
const ctx = canvas.getContext('2d');
const rocket = new Image(); rocket.src = '/activities/event-horizon/assets/rocket-grip.png';
let mode = 'intro', run = createRun(42), width = 0, height = 0, ratio = 1;
let last = performance.now(), accumulator = 0, visualTime = 0, dashQueued = false;
let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let muted = true, audio, best = 0, savedBest = 0, shake = 0, toastUntil = 0;
let heatWarning = 0;
let ticket=null, replay=[], runGeneration=0, pendingSubmission=null;
let particles = [], stars = [], backdrop;
const keys = new Set(), pointers = new Set();
const boostKeys = new Set(['Space', 'KeyW', 'ArrowUp']);
let rankedConnected = false;
let discordSdk = null;
const format = n => Math.floor(n).toLocaleString();
const boosting = () => keys.size > 0 || pointers.size > 0;
const holdPrompt = () => matchMedia('(max-width:600px), (pointer:coarse)').matches ? 'Hold anywhere in the flight area to begin your ranked flight.' : 'Hold Boost or Space to begin your ranked flight.';
function abandonTicket(){
  const old=ticket;ticket=null;
  if(old)void api(`/runs/${encodeURIComponent(old.runId)}/abandon`,{}).catch(()=>{});
}

function setConnectionState(state, detail = '') {
  if (state === 'ready') { $('connection-tag').textContent='VERIFIED DISCORD FLIGHT'; $('connection-note').textContent='Ranked flights are replay-verified for this Discord server.'; $('launch').disabled=false; $('launch').textContent='Launch ranked run ↗'; $('connection-retry').hidden=true; return; }
  if (state === 'external') { $('connection-tag').textContent='DISCORD ACTIVITY REQUIRED'; $('connection-note').textContent='Launch Event Horizon from Discord to begin a replay-verified ranked flight.'; $('launch').disabled=true; $('launch').textContent='Launch from Discord'; $('connection-retry').hidden=true; return; }
  if (state === 'error') { $('connection-tag').textContent='DISCORD CONNECTION FAILED'; $('connection-note').textContent=detail || 'Could not verify your Discord session. Retry the connection to rank flights.'; $('launch').disabled=true; $('launch').textContent='Ranked flight unavailable'; $('connection-retry').hidden=false; return; }
  $('connection-tag').textContent='CONNECTING TO DISCORD'; $('connection-note').textContent='Verifying your Discord session and server standings…'; $('launch').disabled=true; $('launch').textContent='Connecting to Discord…';
}
async function fetchConfig() { const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),8000); try { const response=await fetch('/api/event-horizon/config',{signal:controller.signal}); if(!response.ok)throw new Error(`Configuration request failed (${response.status})`); return await response.json(); } finally { clearTimeout(timeout); } }
async function connectDiscord() {
  setConnectionState('loading'); setSession(null); setRankedAvailable(false); rankedConnected=false;
  try {
    const config=await fetchConfig(); if(!config?.enabled)throw new Error('Event Horizon is not available right now. Please try again later.');
    const clientId=config.clientId || import.meta.env.VITE_DISCORD_CLIENT_ID; if(!clientId)throw new Error('This Activity is missing its public Discord client ID.');
    discordSdk=new DiscordSDK(clientId);
    await Promise.race([discordSdk.ready(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Discord did not respond in time. Open Event Horizon from the Discord app and retry.')),12000))]);
    const {code}=await discordSdk.commands.authorize({client_id:clientId,response_type:'code',state:'',prompt:'none',scope:['identify']});
    const authController=new AbortController();
    const authTimeout=setTimeout(()=>authController.abort(),35_000);
    let response;
    try { response=await fetch('/api/event-horizon/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,instanceId:discordSdk.instanceId}),signal:authController.signal}); }
    catch(error) { if(error?.name==='AbortError')throw new Error('Discord verification took too long. Check your connection and retry.'); throw error; }
    finally { clearTimeout(authTimeout); }
    if(!response.ok)throw new Error(`Discord verification failed (${response.status}).`);
    const auth=await response.json(); if(!auth?.accessToken||!auth?.sessionToken)throw new Error('Discord verification returned an incomplete session.');
    await discordSdk.commands.authenticate({access_token:auth.accessToken}); setSession(auth.sessionToken); setRankedAvailable(true); rankedConnected=true; setConnectionState('ready'); await refreshBoard();
  } catch(error) { const external=window.self===window.top; setConnectionState(external?'external':'error',error instanceof Error?error.message:'Could not connect to Discord.'); }
}

function geo() {
  const r = Math.min(width * .43, height * .385);
  return { cx: width * .5, cy: height * .55, r };
}
function point(radius, angle = 0) {
  const g = geo(); return { x: g.cx + Math.sin(angle) * radius * g.r, y: g.cy - Math.cos(angle) * radius * g.r };
}
function resize() {
  width = canvas.clientWidth; height = canvas.clientHeight;
  ratio = Math.min(devicePixelRatio || 1, reduced ? 1.25 : 2);
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  stars = Array.from({ length: reduced ? 90 : 230 }, (_, i) => ({
    x: Math.sin(i * 93.13) * .5 + .5, y: Math.cos(i * 17.47) * .5 + .5,
    size: .4 + (i % 4) * .35, phase: i * .84, layer: 1 + i % 3,
  }));
  backdrop = document.createElement('canvas'); backdrop.width = Math.ceil(width); backdrop.height = Math.ceil(height);
  const b = backdrop.getContext('2d');
  b.fillStyle = '#050812'; b.fillRect(0, 0, width, height);
  for (const [x,y,r,color] of [[.85,.25,.6,'#261747'],[.16,.7,.7,'#092e4c'],[.65,.72,.35,'#331136']]) {
    const grad = b.createRadialGradient(width*x,height*y,0,width*x,height*y,width*r);
    grad.addColorStop(0,color); grad.addColorStop(1,'#05081200');
    b.fillStyle = grad; b.fillRect(0,0,width,height);
  }
}
new ResizeObserver(resize).observe(canvas);

function tone(freq = 440, duration = .12, kind = 'sine', gain = .04, end = freq) {
  if (muted) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') void audio.resume();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = kind; o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(20,end),audio.currentTime+duration);
    g.gain.setValueAtTime(gain,audio.currentTime); g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
    o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime+duration);
  } catch { /* Audio must never block flight. */ }
}
function message(text, seconds = 1.6) { $('toast').textContent = text; toastUntil = visualTime + seconds; }
function burst(x,y,color,count=16) {
  if (reduced) count = Math.min(count, 6);
  for(let i=0;i<count;i++) {
    const a=Math.random()*Math.PI*2, speed=30+Math.random()*150;
    particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:.4+Math.random()*.5,max:1,color,size:1+Math.random()*3});
  }
  particles = particles.slice(-240);
}
function clearInput() { keys.clear(); pointers.clear(); dashQueued=false; $('boost').classList.remove('active'); }
function syncHUD() {
  $('score').textContent=format(run.score); $('best').textContent=`BEST ${format(best)}`;
  $('run-time').textContent=`${Math.floor(run.time / 60)}:${String(Math.floor(run.time % 60)).padStart(2,'0')}`;
  $('multiplier').textContent=`${run.multiplier.toFixed(1)}×`;
  $('zone').textContent=run.radius<.66?'DANGER ORBIT':run.radius<.84?'SCORE ORBIT':'OUTER ORBIT';
  $('heat').value=run.heat; $('heat').textContent=`${Math.round(run.heat)}%`;
  $('heat').setAttribute('aria-label',`Heat ${Math.round(run.heat)} percent`);
  const dashReady=run.energy>=100;
  const mobileDash=matchMedia('(max-width:600px), (pointer:coarse)').matches;
  $('dash').disabled=!dashReady;
  $('dash').setAttribute('aria-label',dashReady?'Phase dash ready':'Phase dash charging');
  $('charge').textContent=mobileDash?(dashReady?'100%':`${Math.floor(run.energy)}%`):(dashReady?'READY · SHIFT':`${Math.floor(run.energy)}% · COLLECT SHARDS`);
  $('charge-fill').style.setProperty('--dash-charge',String(clamp(run.energy,0,100)));
  $('desktop-charge-fill').style.width=`${clamp(run.energy,0,100)}%`;
  $('boost').classList.toggle('active',boosting());
  $('boost').classList.toggle('heat-warning',run.heat>=65);
  if(run.heat<50)heatWarning=0;
  if(mode==='playing'&&run.heat>=80&&heatWarning<2){
    heatWarning=2;message('HEAT CRITICAL — BOOST OUT TO COOL',2.5);tone(240,.2,'triangle',.045,170);
  }else if(mode==='playing'&&run.heat>=65&&heatWarning<1){
    heatWarning=1;message('Getting hot — boost outward to cool down',2);tone(320,.15,'triangle',.03,240);
  }
}
async function start() {
  if(mode==='preparing')return;
  const generation=++runGeneration;clearInput();
  // Completed submissions keep their receipt; only abandon unfinished flights.
  if(mode==='paused'||mode==='ready'||mode==='playing')abandonTicket();
  mode='preparing';ticket=null;replay=[];pendingSubmission=null;
  $('launch').disabled=true;$('retry').disabled=true;
  $('launch').textContent='Preparing ranked flight…';
  if(!rankedConnected){mode='intro';setConnectionState('error','Reconnect to Discord before starting a ranked flight.');return;}
  try{await boardReady;ticket=await api('/runs',{});if(!ticket?.runId)throw new Error('Could not secure a verified flight.');}catch(error){mode='intro';$('load-error').hidden=false;$('load-error').textContent=error.message||'Could not start a ranked flight.';setConnectionState('error',$('load-error').textContent);return;}
  if(generation!==runGeneration)return;
  $('launch').disabled=false;$('retry').disabled=false;
  run=createRun(ticket.seed);
  mode='ready'; accumulator=0; last=performance.now(); particles=[]; savedBest=best; shake=0; heatWarning=0;
  $('run-label').textContent='VERIFIED RANKED';
  $('resubmit').hidden=true;
  $('overlay').hidden=true; $('hud').hidden=false; $('flight-controls').hidden=false;
  $('pause').disabled=false; syncHUD();
  message(holdPrompt(),3600);
  tone(160,.22,'sine',.045,500);
}
function armFlight(){
  if(mode!=='ready')return;
  mode='playing';accumulator=0;last=performance.now();
  message('Release to dive. Boost to climb.',4);
}
function showOverlay(title,description,action) {
  clearInput(); $('overlay').hidden=false; $('overlay').classList.add('compact');
  $('screen-title').textContent=title; $('screen-description').textContent=description;
  $('launch').textContent=action; $('flight-controls').hidden=true; $('hud').hidden=true;
  $('pause').disabled=true; $('toast').textContent='';
  $('launch').focus({preventScroll:true});
}
function pause() {
  if(mode!=='playing'&&mode!=='ready')return;
  mode='paused'; showOverlay('FLIGHT PAUSED','Take a breath. Your orbit is waiting.','Resume flight');
  $('results').hidden=true; $('instructions').hidden=false; $('retry').hidden=false;
  $('leaderboard').hidden=true;$('back-title').hidden=false;
}
function resume() {
  clearInput(); mode=run.time===0?'ready':'playing'; accumulator=0; last=performance.now();
  $('overlay').hidden=true; $('hud').hidden=false; $('flight-controls').hidden=false; $('pause').disabled=false;
  message(mode==='ready'?holdPrompt():'Flight resumed',mode==='ready'?3600:1);
}
function finish() {
  mode='dead'; const p=point(run.radius); burst(p.x,p.y,'#ffa677',55); shake=reduced?0:12;
  tone(180,.5,'sawtooth',.055,30);
  best=Math.max(best,Math.floor(run.score));
  showOverlay('ORBIT LOST',run.cause,'Fly again');
  $('results').hidden=false; $('instructions').hidden=true; $('retry').hidden=true;
  $('final-score').textContent=format(run.score);
  $('run-stats').textContent=`${run.time.toFixed(1)}s survived · ${run.nearMisses} near-misses · ${run.shards} shards`;
  $('record').textContent=Math.floor(run.score)>savedBest?'New personal best pending verification.':'Press R to fly again.';
  $('leaderboard').hidden=false;$('back-title').hidden=false;
  $('rank-result').textContent='Checking your flight replay…';
  pendingSubmission={ticket,inputs:replay.slice(),generation:runGeneration};void submitResult(pendingSubmission);
}
async function submitResult(submission){
  $('resubmit').hidden=true;
  try{
    const result=await api(`/runs/${encodeURIComponent(submission.ticket.runId)}/finish`,{inputs:submission.inputs,version:submission.ticket.version});
    // A completed request must never overwrite the next run's results.
    if(submission.generation!==runGeneration)return;
    renderBoard(result.leaderboard);pendingSubmission=null;
    const movement=result.previousRank==null?'First placement':result.rankChange>0?`Up ${result.rankChange} place${result.rankChange===1?'':'s'}`:result.rankChange<0?`Down ${-result.rankChange} place${result.rankChange===-1?'':'s'}`:'Rank unchanged';
    $('final-score').textContent=format(result.score);
    $('run-stats').textContent=`${result.survival.toFixed(1)}s survived · ${result.nearMisses} near-misses · ${result.shards} shards`;
    $('rank-result').textContent=`Replay verified · server #${result.rank} · ${movement}. ${result.personalBest?'New server personal best!':''}`;
  }catch(error){
    if(submission.generation!==runGeneration)return;
    $('rank-result').textContent=`Score not confirmed. ${error.message||'Retry the check or fly again.'}`;
    $('resubmit').hidden=false;
  }
}
$('resubmit').addEventListener('click',()=>{if(pendingSubmission)void submitResult(pendingSubmission);});
$('launch').addEventListener('click',()=>mode==='paused'?resume():void start());
$('retry').addEventListener('click',()=>void start());
$('back-title').addEventListener('click',()=>{
  if(mode==='preparing')return;
  ++runGeneration;clearInput();if(mode==='paused')abandonTicket();mode='intro';ticket=null;replay=[];pendingSubmission=null;
  $('overlay').hidden=false;$('overlay').classList.remove('compact');
  $('screen-title').replaceChildren(document.createTextNode('EVENT'),document.createElement('br'),Object.assign(document.createElement('span'),{textContent:'HORIZON'}));
  $('screen-description').textContent='Ride the edge. Get close. Get greedy. Get out.';
  $('launch').textContent='Launch ranked run ↗';$('hud').hidden=true;$('flight-controls').hidden=true;
  $('results').hidden=true;$('instructions').hidden=false;$('retry').hidden=true;
  $('back-title').hidden=true;$('leaderboard').hidden=false;
  $('toast').textContent='';$('launch').focus({preventScroll:true});void refreshBoard();
});
$('pause').addEventListener('click',pause);
$('sound').addEventListener('click',()=>{muted=!muted;$('sound').textContent=muted?'Sound off':'Sound on';$('sound').setAttribute('aria-pressed',String(!muted));tone(550,.1);});
function updateEffects(){ $('effects').textContent=`Reduced effects ${reduced?'on':'off'}`; $('effects').setAttribute('aria-pressed',String(reduced)); resize(); }
$('effects').addEventListener('click',()=>{reduced=!reduced;updateEffects();});
updateEffects();
function dash(){if(mode==='playing'&&run.energy>=100)dashQueued=true;}
$('dash').addEventListener('pointerdown',e=>{e.preventDefault();dash();});
$('dash').addEventListener('click',e=>{if(e.detail===0)dash();});
const game=$('game');
const isFlightControlTarget=target=>target===canvas||target.closest('#boost');
const blocksFlightHold=target=>target.closest('#overlay, #dash, #pause, a, input, select, textarea, [contenteditable="true"]');
game.addEventListener('pointerdown',e=>{
  if(!['ready','playing'].includes(mode)||(e.pointerType==='mouse'&&e.button!==0)||blocksFlightHold(e.target))return;
  // The root lets touch players hold any unoccupied flight area, while real controls
  // retain their own behavior. A disabled dash never leaks a boost press underneath.
  if(!isFlightControlTarget(e.target)&&e.target.closest('button'))return;
  e.preventDefault(); game.setPointerCapture(e.pointerId); pointers.add(e.pointerId); armFlight();
});
for(const event of ['pointerup','pointercancel','lostpointercapture']) game.addEventListener(event,e=>pointers.delete(e.pointerId));
canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('keydown',e=>{
  if(e.code==='Escape'||e.code==='KeyP') {e.preventDefault();if(!e.repeat){if(mode==='playing'||mode==='ready')pause();else if(mode==='paused')resume();}return;}
  if(e.code==='KeyR'&&mode==='dead'&&!e.repeat){e.preventDefault();start();return;}
  if(mode!=='playing'&&mode!=='ready')return;
  if(boostKeys.has(e.code)){e.preventDefault();keys.add(e.code);armFlight();}
  if(e.code==='ShiftLeft'||e.code==='ShiftRight'){e.preventDefault();if(!e.repeat)dash();}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',pause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('pagehide',()=>abandonTicket());
$('connection-retry').addEventListener('click',()=>void connectDiscord());

function background(t) {
  ctx.drawImage(backdrop,0,0,width,height);
  for(const star of stars) {
    const drift=reduced?0:t*star.layer*1.6;
    const x=(star.x*width-drift%width+width)%width, y=star.y*height;
    ctx.globalAlpha=.35+Math.sin(t*.7+star.phase)*.18+star.layer*.11;
    ctx.fillStyle=star.layer===3?'#bca7ff':'#bfe6ff';ctx.fillRect(x,y,star.size,star.size);
  }
  ctx.globalAlpha=1;
}
function blackHole(t) {
  const {cx,cy,r}=geo();
  ctx.save(); ctx.translate(cx,cy);
  const bloom=ctx.createRadialGradient(0,0,r*.30,0,0,r*.76);
  bloom.addColorStop(0,'#ffa06465');bloom.addColorStop(.35,'#b840352b');bloom.addColorStop(1,'#a9408200');
  ctx.fillStyle=bloom;ctx.beginPath();ctx.arc(0,0,r*.76,0,Math.PI*2);ctx.fill();
  // Accretion streamlines orbit continuously. Bright inner light contrasts with
  // the quiet, readable outer flight lane rather than covering it with particles.
  for(let i=0;i<(reduced?22:62);i++) {
    const k=i/(reduced?22:62), rr=r*(.36+k*.11);
    ctx.strokeStyle=`hsla(${20+k*26},100%,${60+k*28}%,${.16+(1-k)*.55})`;
    ctx.lineWidth=(i%4===0?2.4:1)*Math.max(.6,r/300);
    ctx.beginPath();const a=i*2.39+t*(.08+k*.12);
    ctx.ellipse(0,0,rr,rr*(.92+Math.sin(i)*.04),-.28,a,a+1.8+(i%3));ctx.stroke();
  }
  const hole=ctx.createRadialGradient(-r*.08,-r*.1,0,0,0,r*.35);
  hole.addColorStop(0,'#010208');hole.addColorStop(.9,'#020309');hole.addColorStop(1,'#271621');
  ctx.fillStyle=hole;ctx.beginPath();ctx.arc(0,0,r*.35,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#ffe4b6';ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(0,0,r*.354,0,Math.PI*2);ctx.stroke();
  // Tapered photon streams skim the rim; nothing crosses the dark center.
  for(let i=0;i<(reduced?3:7);i++){
    const rr=r*(.36+i*.004),span=.42+(i%3)*.18;
    const head=i*2.399+(reduced?0:t*(.18+i*.027));
    for(let j=0;j<12;j++){
      const strength=(j+1)/12;
      ctx.strokeStyle=`rgba(255,${185+i*8},${115+i*13},${strength*.75})`;
      ctx.lineWidth=Math.max(.6,r/300)*(.5+strength*1.3);
      ctx.beginPath();ctx.arc(0,0,rr,head-span+j*span/12,head-span+(j+1)*span/12+.002);ctx.stroke();
    }
  }
  if(!reduced)for(let i=0;i<60;i++){
    const a=i*2.399+t*(.06+i%4*.025),rr=r*(.37+(i%13)*.006);
    ctx.fillStyle=i%3?'#ffc68999':'#fff1cacc';
    ctx.fillRect(Math.cos(a)*rr,Math.sin(a)*rr,.8+i%2,.8+i%2);
  }
  // The risk region is visibly separated from both the hole and safe orbit.
  ctx.fillStyle='#ff613409';ctx.beginPath();ctx.arc(0,0,r*.66,0,Math.PI*2);ctx.arc(0,0,r*.47,0,Math.PI*2,true);ctx.fill();
  for(const [rad,color] of [[.47,'#ff92654d'],[.66,'#ffb27930'],[1.065,'#8bd9ff35']]){
    ctx.strokeStyle=color;ctx.lineWidth=1;ctx.setLineDash(rad===.66?[3,12]:[]);ctx.beginPath();ctx.arc(0,0,r*rad,0,Math.PI*2);ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle='#d6b8bb';ctx.textAlign='center';ctx.font=`600 ${Math.max(9,r*.028)}px system-ui`;
  // Measure each glyph so the stationary title follows the upper inner rim.
  ctx.save();ctx.textBaseline='middle';
  const title='EVENT HORIZON',titleRadius=r*.30,tracking=Math.max(.6,r*.002);
  const advances=Array.from(title,char=>ctx.measureText(char).width+tracking);
  let angle=-Math.PI/2-advances.reduce((sum,w)=>sum+w,0)/(2*titleRadius);
  Array.from(title).forEach((char,i)=>{
    const half=advances[i]/(2*titleRadius);angle+=half;
    ctx.save();ctx.translate(Math.cos(angle)*titleRadius,Math.sin(angle)*titleRadius);
    ctx.rotate(angle+Math.PI/2);ctx.fillText(char,0,0);ctx.restore();angle+=half;
  });
  ctx.restore();
  ctx.fillStyle='#ffcca9';ctx.font=`500 ${Math.max(9,r*.025)}px system-ui`;ctx.fillText('HOT ORBIT · HIGH SCORE',0,r*.60);
  ctx.restore();
}
function object(o) {
  const g=geo();
  const p=o.type==='crosser'?{x:g.cx+o.x*g.r,y:g.cy+o.y*g.r}:point(o.radius,o.angle);
  const rr=Math.max(o.type==='shard'?4:6,g.r*o.size);
  if(o.type==='crosser'){
    ctx.save();
    if(o.warning>0){
      const entry={x:clamp(p.x,18,width-18),y:clamp(p.y,110,height-105)};
      const target={x:g.cx,y:g.cy+o.targetY*g.r};
      ctx.strokeStyle='#ffbf8577';ctx.lineWidth=1.5;ctx.setLineDash([5,9]);
      ctx.beginPath();ctx.moveTo(entry.x,entry.y);ctx.lineTo(target.x,target.y);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#ffbd80';ctx.beginPath();ctx.arc(entry.x,entry.y,7,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#ffe2bd';ctx.font='700 10px system-ui';ctx.textAlign=o.vx>0?'left':'right';
      ctx.fillText('INCOMING',entry.x+(o.vx>0?12:-12),entry.y-12);
      ctx.restore();return;
    }
    const speed=Math.hypot(o.vx,o.vy),length=reduced?rr*3:rr*7;
    const tx=p.x-o.vx/speed*length,ty=p.y-o.vy/speed*length;
    const fire=ctx.createLinearGradient(tx,ty,p.x,p.y);fire.addColorStop(0,'#ff724400');fire.addColorStop(1,'#ffc88dcc');
    ctx.strokeStyle=fire;ctx.lineWidth=rr*1.2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(p.x,p.y);ctx.stroke();
    ctx.restore();
  }
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(o.spin);
  if(o.type==='shard') {
    ctx.shadowColor='#00d9ff';ctx.shadowBlur=reduced?0:13;
    ctx.fillStyle='#89f4ff';ctx.strokeStyle='#ddfeff';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(0,-rr*1.5);ctx.lineTo(rr,0);ctx.lineTo(0,rr*1.5);ctx.lineTo(-rr,0);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.shadowBlur=0;ctx.strokeStyle='#1696c4';ctx.beginPath();ctx.moveTo(0,-rr*1.5);ctx.lineTo(0,rr*1.5);ctx.stroke();
  } else if(o.type==='plasma') {
    ctx.shadowColor='#ff6b8c';ctx.shadowBlur=reduced?0:18;
    ctx.strokeStyle='#ffa2ac';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,rr,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#ff537b66';ctx.beginPath();ctx.arc(0,0,rr*.7,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#ffc8ad';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-rr*1.3,0);ctx.lineTo(rr*1.3,0);ctx.moveTo(0,-rr*1.3);ctx.lineTo(0,rr*1.3);ctx.stroke();
  } else {
    const grad=ctx.createLinearGradient(-rr,-rr,rr,rr);grad.addColorStop(0,'#b19496');grad.addColorStop(.35,'#665b70');grad.addColorStop(1,'#201b30');
    ctx.fillStyle=grad;ctx.strokeStyle='#d3b8bb';ctx.lineWidth=1.2;
    ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,r=rr*(.84+.16*Math.sin(o.shape+i*7));i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#211e3777';ctx.beginPath();ctx.arc(rr*.15,-rr*.12,rr*.32,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#f4c49988';ctx.beginPath();ctx.moveTo(-rr*.3,rr*.1);ctx.lineTo(-rr*.1,rr*.4);ctx.lineTo(rr*.3,rr*.5);ctx.stroke();
  }
  ctx.restore();
}
function ship(t) {
  const p=point(run.radius), size=clamp(geo().r*.22,48,84);
  if(mode==='playing') {
    if(boosting()&&Math.random()<.7){particles.push({x:p.x-size*.28,y:p.y+size*.12,vx:-80-Math.random()*90,vy:25+Math.random()*30,life:.3,max:.3,color:'#53eaff',size:1.2+Math.random()*2});}
  }
  if(mode==='dead')return;
  ctx.save();ctx.translate(p.x,p.y);
  if(run.heat>=65){
    ctx.strokeStyle='#ffbc86';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-7,-size*.65);ctx.lineTo(0,-size*.78);ctx.lineTo(7,-size*.65);ctx.stroke();
    ctx.font='700 10px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffcca7';ctx.fillText('BOOST TO COOL',0,size*.68);
  }
  if(run.phase>0){ctx.strokeStyle='#beacff';ctx.lineWidth=2;ctx.shadowColor='#a18aff';ctx.shadowBlur=reduced?0:22;ctx.beginPath();ctx.arc(0,0,size*.48,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;}
  const tremble=rocketTremble(run.multiplier,run.time,reduced);
  ctx.translate(tremble.x,tremble.y);
  ctx.rotate(Math.PI*.23-run.velocity*.6+tremble.angle);
  if(boosting()&&mode==='playing'){
    ctx.fillStyle='#a0faff';ctx.beginPath();ctx.moveTo(-size*.24,size*.28);ctx.lineTo(-size*(.60+Math.sin(t*60)*.05),size*.60);ctx.lineTo(-size*.13,size*.36);ctx.closePath();ctx.fill();
  }
  if(rocket.complete&&rocket.naturalWidth)ctx.drawImage(rocket,-size/2,-size/2,size,size);
  else{ctx.fillStyle='#75efff';ctx.beginPath();ctx.moveTo(size*.4,0);ctx.lineTo(-size*.3,-size*.2);ctx.lineTo(-size*.2,size*.2);ctx.closePath();ctx.fill();}
  drawNoseHeat(ctx,size,visualHeat(run.heat,run.multiplier),run.time,reduced);
  ctx.restore();
  if(mode==='playing'&&run.time<8){ctx.fillStyle='#d6faff';ctx.font='700 10px system-ui';ctx.textAlign='center';ctx.fillText('YOU',p.x,p.y-size*.55);}
}
function render(dt) {
  visualTime+=dt;ctx.save();ctx.setTransform(ratio,0,0,ratio,0,0);
  if(shake>0&&!reduced){ctx.translate(Math.sin(visualTime*100)*shake,Math.cos(visualTime*87)*shake);shake=Math.max(0,shake-dt*25);}
  background(visualTime);blackHole(visualTime);
  if(mode!=='intro')for(const o of run.objects)object(o);
  if(mode!=='intro')for(const o of run.crossers)object(o);
  if(mode==='intro'){run.radius=.83+Math.sin(visualTime*.7)*.025;}
  ship(visualTime);
  for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}
  particles=particles.filter(p=>p.life>0).slice(-240);ctx.globalAlpha=1;
  if(mode==='playing'&&run.heat>65){ctx.strokeStyle=`rgba(255,117,86,${(run.heat-65)/90})`;ctx.lineWidth=6;ctx.strokeRect(3,3,width-6,height-6);}
  ctx.restore();
  if(visualTime>toastUntil)$('toast').textContent='';
}
function frame(now) {
  const elapsed=Math.max(0,(now-last)/1000);last=now;
  // A long scheduling stall must not silently kill the player or advance time.
  if(elapsed>.6&&mode==='playing')pause();
  const dt=Math.min(elapsed,.1);
  if(mode==='playing') {
    accumulator+=dt;
    while(accumulator>=DT&&mode==='playing') {
      const input={boost:boosting(),dash:dashQueued};
      if(replay.length>=ticket.maxTicks){
        abandonTicket(); mode='intro'; clearInput();
        showOverlay('FLIGHT LIMIT REACHED','This verified flight reached its replay limit and was not submitted. Start a new ranked flight.','Launch ranked run ↗');
        $('results').hidden=true;$('instructions').hidden=false;$('retry').hidden=true;$('leaderboard').hidden=false;$('back-title').hidden=false;
        break;
      }
      replay.push((input.boost?1:0)|(input.dash?2:0));
      step(run,input);dashQueued=false;accumulator-=DT;
      for(const e of run.events){
        if(e.type==='storm-start'){message('90 SECONDS · INCOMING ASTEROID STORM',3.2);tone(260,.3,'triangle',.04,600);}
        if(e.type==='incoming'&&!run.events.some(event=>event.type==='storm-start')){message('Incoming asteroid — watch the crossing path',1.4);tone(390,.12,'triangle',.025,260);}
        if(e.type==='dash'){message('PHASE DASH · DEBRIS SHIELD',.8);tone(170,.25,'triangle',.06,1000);const p=point(run.radius);burst(p.x,p.y,'#b9a6ff',24);}
        if(e.type==='shard'){const p=point(e.radius,e.angle);burst(p.x,p.y,'#7df4ff',7);tone(650+run.shards%4*150,.07,'sine',.02);}
        if(e.type==='near'){message(`CLOSE CALL +${e.combo} COMBO`,1.3);tone(800,.1,'triangle',.03,1200);}
        if(e.type==='death')finish();
      }
    }
    syncHUD();
  }
  render(dt);requestAnimationFrame(frame);
}
rocket.addEventListener('error',()=>{$('load-error').hidden=false;$('load-error').textContent='Character artwork could not load. The flight prototype still works with a simple marker.';});
window.addEventListener('error',()=>{if(mode==='playing')pause();$('load-error').hidden=false;$('load-error').textContent='The activity encountered an error. Reload the page to try again.';});
if(import.meta.env.PROD)patchUrlMappings([{prefix:'/api',target:'api.acosmibot.com/api'},{prefix:'/discord-cdn',target:'cdn.discordapp.com'}]);
resize();requestAnimationFrame(frame);void connectDiscord();
