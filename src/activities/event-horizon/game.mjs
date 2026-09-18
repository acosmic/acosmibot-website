import { createRun, step, DT, clamp, specialState } from './sim.mjs';
import { createPhaseBackdrop, drawSpecial, phaseNames } from './phases-fx.mjs';
import { flightCamera, rocketSize, obstacleSize } from './camera.mjs';
import { drawNoseHeat, drawPhaseReady, visualHeat, rocketTremble } from './heat-fx.mjs';
import { flightError, needsReconnect } from './errors.mjs';
import { DiscordSDK, patchUrlMappings } from '@discord/embedded-app-sdk';
import { api, refreshBoard, renderBoard, boardReady, setRankedAvailable, setSession } from './leaderboard.mjs';
import './style.css';
import { LiveClient, snapshotForView } from './live.mjs';
import { compactParticles, cachedLabel } from './render-cache.mjs';
import { drawObjectArt } from './object-art.mjs';
import { drawBlackHole } from './black-hole.mjs';
import { SnapshotPlayback } from './playback.mjs';
import { renderViewers } from './viewers.mjs';
import { Presence } from './presence.mjs';
import { DISCORD_INVITE_URL } from '../../seo/publicRoutes';

const elements = new Map();
const $ = id => { if(!elements.has(id))elements.set(id,document.getElementById(id));return elements.get(id); };
const mobileControls=matchMedia('(max-width:600px), (pointer:coarse)');
const setText=(id,value)=>{const node=$(id);if(node.textContent!==value)node.textContent=value;};
const setProp=(id,key,value)=>{const node=$(id);if(node[key]!==value)node[key]=value;};
const setAttr=(id,key,value)=>{const node=$(id);if(node.getAttribute(key)!==value)node.setAttribute(key,value);};
const canvas = $('space');
// Build-time rollback keeps Canvas available without a player-facing switch.
const usePixi=import.meta.env.VITE_EVENT_HORIZON_RENDERER!=='canvas';
const ctx = (usePixi?document.createElement('canvas'):canvas).getContext('2d');
let gpu=null,animationFrame=0,disposed=false;
const phaseBackdrop = createPhaseBackdrop();
const rocket = new Image(); rocket.src = '/activities/event-horizon/assets/rocket-grip.png';
let mode = 'intro', run = createRun(42), width = 0, height = 0, ratio = 1;
let last = performance.now(), accumulator = 0, visualTime = 0, dashQueued = false;
let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let muted = false, audio, best = 0, savedBest = 0, shake = 0, toastUntil = 0;
let heatWarning = 0;
let comboUntil = 0, comboText = '';
let ticket=null, replay=[], runGeneration=0, pendingSubmission=null;
let particles = [], stars = [], backdrop;
const keys = new Set(), pointers = new Set();
const boostKeys = new Set(['Space', 'KeyW', 'ArrowUp']);
let rankedConnected = false;
let casualAvailable = false;
const launchLabel=()=>casualAvailable?'Launch flight ↗':'Launch ranked run ↗';
let discordSdk = null;
let discordClientId=null,profileBusy=false;
let connecting = false;
let live=null, presence=null, presenceMode='', flightStartedAt=null;
let watching=false, watchedStatus='connecting', watchedInput=0, lastWatchFrame=0, lastBroadcast=0;
let liveFlights=[], liveStatus='connecting';
const playback=new SnapshotPlayback();
let camera, holeCache=null;
const label=cachedLabel();
const localNumber=n=>n.toLocaleString();
const clockLabel=n=>`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;

function renderPilots(){
  const focused=document.activeElement?.dataset?.watchRun;
  $('live-pilots').replaceChildren(...liveFlights.map(f=>{
    const row=document.createElement('li'),info=document.createElement('span'),name=document.createElement('strong'),detail=document.createElement('small'),button=document.createElement('button');
    name.textContent=f.name;detail.textContent=`${Math.floor(f.time)}s · ${Math.floor(f.score).toLocaleString()} points · ${f.status==='playing'?'Flying':f.status==='paused'?'Paused':'Connecting'}`;
    info.append(name,detail);button.textContent='Watch';button.disabled=['playing','ready','paused','preparing'].includes(mode);
    button.dataset.watchRun=f.runId;button.setAttribute('aria-label',`Watch ${f.name}`);button.addEventListener('click',()=>beginWatching(f.runId));row.append(info,button);return row;
  }));
  if(focused)for(const button of $('live-pilots').querySelectorAll('button'))if(button.dataset.watchRun===focused)button.focus({preventScroll:true});
  $('live-status').textContent=liveStatus==='connected'?(liveFlights.length?'Live scores are provisional until the flight is verified.':'No one is flying yet. Launch a flight for others to watch.'):
    liveStatus==='replaced'?'This Activity was opened elsewhere. Reconnect to Discord to watch here.':liveStatus==='unavailable'?'Live watching is unavailable. Ranked flights are still available.':'Connecting to live flights…';
}
function beginWatching(runId){
  if(profileBusy)return;
  if(['playing','ready','paused','preparing'].includes(mode))return;
  clearInput();live?.watch(runId);$('live-status').textContent='Joining the flight…';
}
function stopWatching(){
  live?.unwatch();playback.reset();watching=false;mode='intro';watchedStatus='connecting';run=createRun(42);
  $('watch-controls').hidden=true;$('viewer-count').hidden=true;
  $('best').hidden=false;canvas.setAttribute('aria-label','Flight area. Hold Space, W, Arrow Up, or hold the flight area to boost outward. Release to dive inward. Shift activates Phase Shift.');
}
function liveMessage(message){
  if(message.type==='flights'){liveFlights=message.flights;renderPilots();return;}
  if(message.type==='viewers'){renderViewers($('viewer-count'),message);$('viewer-count').hidden=!ticket||watching;return;}
  if(message.type==='watching'){
    playback.reset();watching=true;mode='watching';watchedStatus='connecting';lastWatchFrame=performance.now();accumulator=0;
    $('watch-name').textContent=`Watching ${message.name}`;$('watch-status').textContent='Joining flight…';
    $('overlay').hidden=true;$('hud').hidden=false;$('pause').hidden=true;$('flight-controls').hidden=true;$('watch-controls').hidden=false;
    $('best').hidden=true;canvas.setAttribute('aria-label',`Live view of ${message.name}'s flight. Use Switch pilot or Leave view to return to the lobby.`);
    $('watch-leave').focus({preventScroll:true});
    $('viewer-count').hidden=true;return;
  }
  if(message.type==='snapshot'&&watching){
    const state=snapshotForView(message);if(!state)return;
    watchedStatus=message.status;watchedInput=message.input;lastWatchFrame=performance.now();
    playback.push(state,watchedStatus,watchedInput,lastWatchFrame);
    run=playback.sample(lastWatchFrame).state;
    $('watch-status').textContent=watchedStatus==='paused'?'Pilot paused':watchedStatus==='ready'?'Pilot preparing':watchedStatus==='dead'?'Flight ended · checking score…':'Live · score awaiting verification';
    $('watch-charge').textContent=`Phase Shift ${Math.floor(run.energy)}%`;syncHUD();return;
  }
  if(message.type==='status'&&watching){watchedStatus=message.status;$('watch-status').textContent='Pilot reconnecting…';return;}
  if(message.type==='verified'&&watching){
    watchedStatus='verified';$('watch-status').textContent=`Verified · ${Math.floor(message.result.score).toLocaleString()} points${message.result.rank?` · server #${message.result.rank}`:''}`;
    return;
  }
  if(message.type==='ended'&&watching){watchedStatus='ended';live.target=null;$('watch-status').textContent=message.reason||'Flight ended';return;}
  if(message.type==='error'){
    const text=message.message||'This flight is unavailable. Choose another pilot.';
    if(['unavailable','full'].includes(message.code)&&watching)$('back-title').click();
    if(watching)$('watch-status').textContent=text;else $('live-status').textContent=text;
  }
}
function setLiveStatus(status){
  liveStatus=status;renderPilots();
  if(watching&&status!=='connected'){watchedStatus='reconnecting';$('watch-status').textContent='Live view reconnecting…';}
}
$('watch-leave').addEventListener('click',()=>{$('back-title').click();});
$('watch-switch').addEventListener('click',()=>{$('back-title').click();$('live-title').scrollIntoView({block:'center'});});
const format = n => Math.floor(n).toLocaleString();
const boosting = () => keys.size > 0 || pointers.size > 0;
const holdPrompt = () => mobileControls.matches ? 'Hold anywhere in the flight area to begin your flight.' : 'Hold Boost or Space to begin your flight.';
function abandonTicket(){
  const old=ticket;ticket=null;
  if(old?.runId)void api(`/runs/${encodeURIComponent(old.runId)}/abandon`,{}).catch(()=>{});
}

function setConnectionState(state, detail = '') {
  $('install-bot').hidden=!['install','casual'].includes(state);
  $('connection-retry').textContent=['install','casual'].includes(state)?'Check again':'Retry Discord connection';
  if(state==='casual'){
    $('connection-note').textContent='Play for fun here. For server leaderboards, record posts, and live spectating, ask an admin to add Acosmibot. After installation, choose Check again.';
    $('launch').disabled=false;$('launch').textContent=launchLabel();$('connection-retry').hidden=false;$('leaderboard').hidden=true;return;
  }
  if(state==='install'){
    $('connection-note').textContent=detail;$('launch').disabled=true;$('launch').textContent='Add Acosmibot to play';
    $('connection-retry').hidden=false;$('leaderboard').hidden=true;return;
  }
  if (state === 'ready') { $('leaderboard').hidden=false;$('connection-note').textContent=''; $('launch').disabled=false; $('launch').textContent='Launch ranked run ↗'; $('connection-retry').hidden=true; return; }
  if (state === 'external') { $('connection-note').textContent='Launch Event Horizon from Discord to start a flight.'; $('launch').disabled=true; $('launch').textContent='Launch from Discord'; $('connection-retry').hidden=true; return; }
  if (state === 'error') { $('connection-note').textContent=detail || 'Could not verify your Discord session. Retry the connection to rank flights.'; $('launch').disabled=true; $('launch').textContent='Ranked flight unavailable'; $('connection-retry').hidden=false; return; }
  $('connection-note').textContent='Verifying your Discord session and server standings…'; $('launch').disabled=true; $('launch').textContent='Connecting to Discord…';
}
async function fetchConfig() { const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),8000); try { const response=await fetch('/api/event-horizon/config',{signal:controller.signal}); if(!response.ok)throw new Error(`Configuration request failed (${response.status})`); return await response.json(); } finally { clearTimeout(timeout); } }
async function connectDiscord(approvedAuthorization=null) {
  if(connecting)return;
  connecting=true;
  presence=null;presenceMode='';
  live?.stop();live=null;
  $('live-lobby').hidden=true;
  $('connection-retry').disabled=true;
  setConnectionState('loading'); setSession(null); setRankedAvailable(false); rankedConnected=false;casualAvailable=false;
  try {
    const config=await fetchConfig(); if(!config?.enabled)throw new Error('Event Horizon is not available right now. Please try again later.');
    const clientId=config.clientId || import.meta.env.VITE_DISCORD_CLIENT_ID; if(!clientId)throw new Error('This Activity is missing its public Discord client ID.');
    discordClientId=clientId;
    if(!approvedAuthorization){
      discordSdk=new DiscordSDK(clientId);
      await Promise.race([discordSdk.ready(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Discord did not respond in time. Open Event Horizon from the Discord app and retry.')),12000))]);
    }
    // Keep launch on the original identity grant. Optional Rich Presence must
    // not escalate permissions and interrupt every Activity launch with consent.
    const authorization=approvedAuthorization || await discordSdk.commands.authorize({client_id:clientId,response_type:'code',state:'',prompt:'none',scope:['identify']});
    const {code}=authorization;
    const authController=new AbortController();
    const authTimeout=setTimeout(()=>authController.abort(),35_000);
    let response;
    try { response=await fetch('/api/event-horizon/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,instanceId:discordSdk.instanceId}),signal:authController.signal}); }
    catch(error) { if(error?.name==='AbortError')throw new Error('Discord verification took too long. Check your connection and retry.'); throw error; }
    finally { clearTimeout(authTimeout); }
    if(!response.ok)throw await flightError(response);
    const auth=await response.json(); if(!auth?.accessToken||(!auth?.sessionToken&&auth.playMode!=='casual'))throw new Error('Discord verification returned an incomplete session.');
    const discordAuth=await discordSdk.commands.authenticate({access_token:auth.accessToken});
    casualAvailable=auth.playMode==='casual';setSession(auth.sessionToken);setRankedAvailable(!casualAvailable);rankedConnected=!casualAvailable;
    setConnectionState(casualAvailable?'casual':'ready');$('load-error').hidden=true;if(!casualAvailable)await refreshBoard();
    if(discordAuth?.scopes?.includes('rpc.activities.write'))presence=new Presence(discordSdk);
    $('live-lobby').hidden=!config.watchEnabled||casualAvailable;
    if(config.watchEnabled&&!casualAvailable){live=new LiveClient({api,onMessage:liveMessage,onStatus:setLiveStatus});live.start();}
  } catch(error) { const external=window.self===window.top; setConnectionState(error.code==='bot_not_installed'?'install':external?'external':'error',error instanceof Error?error.message:'Could not connect to Discord.'); }
  finally { connecting=false;$('connection-retry').disabled=false; }
}

function geo() {
  return camera;
}
function point(radius, angle = 0) {
  const g = geo(); return { x: g.cx + Math.sin(angle) * radius * g.r, y: g.cy - Math.cos(angle) * radius * g.r };
}
function resize() {
  width = canvas.clientWidth; height = canvas.clientHeight;
  camera=flightCamera(width,height);holeCache=null;
  ratio = Math.min(devicePixelRatio || 1, reduced ? 1.25 : 2);
  if(!usePixi){canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);}
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
  gpu?.resize({width,height,ratio,camera,reduced,backdrop,stars});
}
const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);

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
  setText('score',label('score',Math.floor(run.score),localNumber)); setText('best',`BEST ${label('best',Math.floor(best),localNumber)}`);
  setText('run-time',label('time',Math.floor(run.time),clockLabel));
  setText('multiplier',`${run.multiplier.toFixed(1)}×`);
  setProp('heat','value',run.heat);setText('heat',`${Math.round(run.heat)}%`);
  setAttr('heat','aria-label',`Heat ${Math.round(run.heat)} percent`);
  const dashReady=run.energy>=100;
  const mobileDash=mobileControls.matches;
  setProp('dash','disabled',!dashReady);
  setAttr('dash','aria-label',dashReady?'Phase Shift ready':'Phase Shift charging');
  setText('charge',mobileDash?(dashReady?'100%':`${Math.floor(run.energy)}%`):(dashReady?'READY · SHIFT':`${Math.floor(run.energy)}% · COLLECT SHARDS`));
  const charge=String(clamp(run.energy,0,100));
  if($('charge-fill').style.getPropertyValue('--dash-charge')!==charge)$('charge-fill').style.setProperty('--dash-charge',charge);
  if($('desktop-charge-fill').style.width!==`${charge}%`)$('desktop-charge-fill').style.width=`${charge}%`;
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
  if(usePixi&&(!gpu||gpu.lost))return;
  if(profileBusy)return;
  if(mode==='preparing')return;
  if(watching)stopWatching();
  $('pause').hidden=false;$('watch-controls').hidden=true;
  const generation=++runGeneration;clearInput();
  // Completed submissions keep their receipt; only abandon unfinished flights.
  if(mode==='paused'||mode==='ready'||mode==='playing')abandonTicket();
  mode='preparing';ticket=null;replay=[];pendingSubmission=null;
  $('launch').disabled=true;$('retry').disabled=true;
  $('launch').textContent='Preparing flight…';
  if(!rankedConnected&&!casualAvailable){mode='intro';setConnectionState('error','Reconnect to Discord before starting a flight.');return;}
  try{
    if(casualAvailable)ticket={casual:true,seed:crypto.getRandomValues(new Uint32Array(1))[0]||1,version:'event-horizon-v5',maxTicks:36000};
    else{await boardReady;ticket=await api('/runs',{version:'event-horizon-v5'});if(!ticket?.runId||ticket.version!=='event-horizon-v5')throw new Error('The game has updated. Close and reopen the Activity before flying.');}
  }catch(error){
    abandonTicket();mode='intro';$('load-error').hidden=false;$('load-error').textContent=error.message||'Could not start a ranked flight.';
    if(needsReconnect(error)){rankedConnected=false;setConnectionState('error',$('load-error').textContent);}
    else{setConnectionState('ready');$('retry').disabled=false;$('connection-retry').hidden=error.code!=='active_run_limit';}
    return;
  }
  if(generation!==runGeneration)return;
  $('launch').disabled=false;$('retry').disabled=false;
  run=createRun(ticket.seed);
  $('phase-status').textContent='';
  mode='ready'; accumulator=0; last=performance.now(); particles=[]; savedBest=best; shake=0; heatWarning=0;
  $('viewer-count').hidden=true;live?.setRun(ticket.runId);renderPilots();flightStartedAt=null;
  $('resubmit').hidden=true;
  $('overlay').hidden=true; $('hud').hidden=false; $('flight-controls').hidden=false;
  $('pause').disabled=false; syncHUD();
  message(holdPrompt(),3600);
  tone(160,.22,'sine',.045,500);
}
function armFlight(){
  if(mode!=='ready'||gpu?.lost)return;
  if(!muted && audio?.state==='suspended')void audio.resume().catch(()=>{});
  mode='playing';accumulator=0;last=performance.now();
  flightStartedAt=Math.floor(Date.now()/1000);
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
  if(gpu?.lost)return;
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
  if(ticket?.casual){
    $('leaderboard').hidden=true;$('rank-result').textContent='Played for fun · score saved for this screen only.';
    $('record').textContent=Math.floor(run.score)>savedBest?'New best this visit.':'';
    pendingSubmission=null;return;
  }
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
  if(watching)stopWatching();
  live?.setRun(null);$('pause').hidden=false;$('viewer-count').hidden=true;
  ++runGeneration;clearInput();if(mode==='paused')abandonTicket();mode='intro';ticket=null;replay=[];pendingSubmission=null;
  $('overlay').hidden=false;$('overlay').classList.remove('compact');
  $('screen-title').replaceChildren(document.createTextNode('EVENT'),document.createElement('br'),Object.assign(document.createElement('span'),{textContent:'HORIZON'}));
  $('screen-description').textContent='Ride the edge. Get close. Get greedy. Get out.';
  $('launch').textContent=launchLabel();$('hud').hidden=true;$('flight-controls').hidden=true;
  $('results').hidden=true;$('instructions').hidden=false;$('retry').hidden=true;
  $('back-title').hidden=true;$('leaderboard').hidden=casualAvailable;
  $('toast').textContent='';$('launch').focus({preventScroll:true});void refreshBoard();
  renderPilots();
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
const blocksFlightHold=target=>target.closest('#overlay, #dash, #pause, #viewer-count, a, input, select, textarea, [contenteditable="true"]');
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
$('connection-retry').addEventListener('click',()=>{if(!profileBusy)void connectDiscord();});
$('profile-share').addEventListener('click',async()=>{
  if(profileBusy||connecting||mode!=='intro'||presence||(!rankedConnected&&!casualAvailable))return;
  profileBusy=true;$('launch').disabled=true;$('connection-retry').disabled=true;
  $('profile-status').textContent='Waiting for Discord permission…';
  let reconnectStarted=false;
  try{
    // Only this deliberate click requests permission to change profile activity.
    // Ask before replacing the game session so Cancel leaves it playable.
    const authorization=await discordSdk.commands.authorize({client_id:discordClientId,response_type:'code',state:'',prompt:'none',scope:['identify','rpc.activities.write']});
    reconnectStarted=true;await connectDiscord(authorization);
    $('profile-status').textContent=presence?'Profile sharing enabled for this session.':
      'Profile sharing was not enabled. You can retry from the lobby.';
  }catch{
    $('profile-status').textContent='Profile sharing was not enabled. You can keep playing.';
  }finally{
    profileBusy=false;
    if(!reconnectStarted){$('launch').disabled=false;$('connection-retry').disabled=false;}
  }
});
$('install-bot').href=DISCORD_INVITE_URL;
$('install-bot').addEventListener('click',async event=>{
  if(!discordSdk)return; // Normal browsers follow the real install link directly.
  event.preventDefault();
  try{await discordSdk.commands.openExternalLink({url:DISCORD_INVITE_URL});}
  catch{window.open(DISCORD_INVITE_URL,'_blank','noopener,noreferrer');}
});

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
  drawBlackHole(ctx,t,geo(),reduced,holeCache??={});
}
function object(o) {
  const g=geo();
  const p=o.type==='crosser'?{x:g.cx+o.x*g.r,y:g.cy+o.y*g.r}:point(o.radius,o.angle);
  const rr=obstacleSize(g.r,o.size);
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
  drawObjectArt(ctx,o,rr,reduced);
  ctx.restore();
}
function ship(t) {
  const p=point(run.radius), size=rocketSize(geo().r);
  if(mode==='playing') {
    if(boosting()&&Math.random()<.7){particles.push({x:p.x-size*.28,y:p.y+size*.12,vx:-80-Math.random()*90,vy:25+Math.random()*30,life:.3,max:.3,color:'#53eaff',size:1.2+Math.random()*2});}
  }
  if(mode==='dead'||(watching&&!run.alive))return;
  ctx.save();ctx.translate(p.x,p.y);
  drawPhaseReady(ctx,size,run.energy,run.phase,t,reduced);
  if(run.heat>=65){
    ctx.strokeStyle='#ffbc86';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-7,-size*.65);ctx.lineTo(0,-size*.78);ctx.lineTo(7,-size*.65);ctx.stroke();
    ctx.font='700 10px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffcca7';ctx.fillText('BOOST TO COOL',0,size*.78+10);
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
function renderPixi(dt){
  visualTime+=dt;
  const renderShake=shake;
  if(shake>0&&!reduced)shake=Math.max(0,shake-dt*25);
  if(mode==='intro')run.radius=.83+Math.sin(visualTime*.7)*.025;
  const flying=mode==='playing'||(watching&&watchedStatus==='playing');
  const boost=watching?!!(watchedInput&1):boosting();
  if(flying&&boost&&Math.random()<.7){const p=point(run.radius),size=rocketSize(geo().r);particles.push({x:p.x-size*.28,y:p.y+size*.12,vx:-80-Math.random()*90,vy:25+Math.random()*30,life:.3,max:.3,color:'#53eaff',size:1.2+Math.random()*2});}
  for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}
  gpu.render({run,mode,watching,boost,flying,t:visualTime,dt,phase:specialState(run),particles,shake:renderShake,comboUntil,comboText,rocket});
  compactParticles(particles);
  if(mode!=='playing')comboUntil=0;
  if(visualTime>toastUntil)setText('toast','');
}
function render(dt) {
  visualTime+=dt;ctx.save();ctx.setTransform(ratio,0,0,ratio,0,0);
  if(shake>0&&!reduced){ctx.translate(Math.sin(visualTime*100)*shake,Math.cos(visualTime*87)*shake);shake=Math.max(0,shake-dt*25);}
  const phaseView=specialState(run);
  background(visualTime);phaseBackdrop(ctx,width,height,phaseView.kinds.length?phaseView.kinds:phaseView.kind,dt,reduced);blackHole(visualTime);
  if(mode!=='intro'){for(const o of run.objects)object(o);for(const o of run.crossers)object(o);}
  if(mode!=='intro')drawSpecial(ctx,geo(),run,phaseView,reduced,visualTime>=comboUntil);
  if(mode==='intro'){run.radius=.83+Math.sin(visualTime*.7)*.025;}
  ship(visualTime);
  for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}
  compactParticles(particles);ctx.globalAlpha=1;
  if(mode==='playing'&&run.heat>65){ctx.strokeStyle=`rgba(255,117,86,${(run.heat-65)/90})`;ctx.lineWidth=6;ctx.strokeRect(3,3,width-6,height-6);}
  ctx.restore();
  if (mode === 'playing' && visualTime < comboUntil) {
    const {cx, cy, r} = geo();
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#9af3ff';
    ctx.font = `700 ${clamp(r * .065, 13, 28)}px system-ui`;
    ctx.fillText('CLOSE CALL', cx, cy - 13, r * .55);
    ctx.fillStyle = '#f3f7fa';
    ctx.fillText(comboText, cx, cy + 15, r * .55);
    ctx.restore();
  } else if (mode !== 'playing') { comboUntil = 0; }
  if(visualTime>toastUntil)setText('toast','');
}
function frame(now) {
  setProp('profile-setting','hidden',mode!=='intro'||(!rankedConnected&&!casualAvailable));
  setProp('profile-share','disabled',profileBusy||connecting||!!presence);
  setText('profile-share',profileBusy?'Connecting profile…':presence?'Profile sharing enabled':'Show on Discord profile');
  const elapsed=Math.max(0,(now-last)/1000);last=now;
  // A long scheduling stall must not silently kill the player or advance time.
  if(elapsed>.6&&mode==='playing')pause();
  const dt=Math.min(elapsed,.1);
  const presenceState=casualAvailable&&['playing','ready','dead'].includes(mode)?`casual-${mode}`:mode;
  if(presence&&presenceMode!==presenceState){presenceMode=presenceState;presence.update(presenceState,flightStartedAt);}
  if(watching){
    const view=playback.sample(now);
    if(view){run=view.state;watchedInput=view.input;syncHUD();setText('watch-charge',`Phase Shift ${Math.floor(run.energy)}%`);}
    if(now-lastWatchFrame>3000&&['playing','ready','paused'].includes(watchedStatus)){$('watch-status').textContent='Live view delayed · reconnecting…';watchedStatus='reconnecting';}
  }
  if(mode==='playing') {
    accumulator+=dt;
    while(accumulator>=DT&&mode==='playing') {
      const input={boost:boosting(),dash:dashQueued};
      if(replay.length>=ticket.maxTicks){
        if(ticket.casual){finish();showOverlay('FLIGHT COMPLETE','Ten-minute flight complete.','Fly again');break;}
        abandonTicket(); mode='intro'; clearInput();
        showOverlay('FLIGHT LIMIT REACHED','This verified flight reached its replay limit and was not submitted. Start a new ranked flight.','Launch ranked run ↗');
        $('results').hidden=true;$('instructions').hidden=false;$('retry').hidden=true;$('leaderboard').hidden=false;$('back-title').hidden=false;
        break;
      }
      replay.push((input.boost?1:0)|(input.dash?2:0));
      step(run,input);dashQueued=false;accumulator-=DT;
      for(const e of run.events){
        if(e.type==='phase-start'){ $('phase-status').textContent=run.specials.map(p=>phaseNames[p.kind]).join(' + ');tone(420,.2,'triangle',.04,700); }
        if(e.type==='storm-start'){message('60 SECONDS · INCOMING ASTEROID STORM',3.2);tone(260,.3,'triangle',.04,600);}
        if(e.type==='incoming'&&!run.events.some(event=>event.type==='storm-start')){message('Incoming asteroid — watch the crossing path',1.4);tone(390,.12,'triangle',.025,260);}
        if(e.type==='dash'){message('PHASE SHIFT · DEBRIS SHIELD',.8);tone(170,.25,'triangle',.06,1000);const p=point(run.radius);burst(p.x,p.y,'#b9a6ff',24);}
        if(e.type==='shard'){const p=point(e.radius,e.angle);burst(p.x,p.y,'#7df4ff',7);tone(650+run.shards%4*150,.07,'sine',.02);}
        if(e.type==='near'){comboText=`+${e.combo} COMBO`;comboUntil=visualTime+1.3;tone(800,.1,'triangle',.03,1200);}
        if(e.type==='death')finish();
      }
    }
    syncHUD();
  }
  if(live&&ticket&&['ready','playing','paused','dead'].includes(mode)&&now-lastBroadcast>=100){
    lastBroadcast=now;live.snapshot(run,mode,boosting()?1:0);
  }
  if(usePixi)renderPixi(dt);else render(dt);
  if(!disposed)animationFrame=requestAnimationFrame(frame);
}
rocket.addEventListener('error',()=>{$('load-error').hidden=false;$('load-error').textContent='Character artwork could not load. The flight prototype still works with a simple marker.';});
window.addEventListener('error',()=>{if(mode==='playing')pause();$('load-error').hidden=false;$('load-error').textContent='The activity encountered an error. Reload the page to try again.';});
if(import.meta.env.PROD)patchUrlMappings([{prefix:'/api',target:'api.acosmibot.com/api'},{prefix:'/discord-cdn',target:'cdn.discordapp.com'}]);
async function bootRenderer(){
  try{
    if(usePixi){
      const {createFlightRenderer}=await import('./pixi-renderer.mjs');
      gpu=await createFlightRenderer(canvas,{onLost(){pause();clearInput();message('Graphics interrupted. Waiting to reconnect…',3600);},onRestored(){message('Graphics restored. Resume your flight when ready.',5);}});
    }
    if(disposed){gpu?.destroy();return;}
    resize();animationFrame=requestAnimationFrame(frame);void connectDiscord();
  }catch(error){
    $('load-error').hidden=false;$('load-error').textContent='Graphics could not start. Enable hardware acceleration, then reopen the Activity.';
    $('launch').disabled=true;console.error('Event Horizon renderer initialization failed',error);
  }
}
window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(animationFrame);resizeObserver.disconnect();gpu?.destroy();});
void bootRenderer();
