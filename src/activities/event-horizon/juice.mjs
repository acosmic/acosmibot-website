// Presentation-only "game feel" state. Nothing here reads or writes simulation
// state, so replays, scores, and spectators are unaffected by any value below.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export function createJuice(){
  return {trauma:0,zoom:0,flash:0,flashColor:[1,1,1],chroma:0,
    kickX:0,kickY:0,waves:[],speedLines:0,timeScale:1,slowUntil:0};
}

// Trauma is squared before use so small hits stay subtle and big hits feel heavy.
export function addTrauma(j,amount,dirX=0,dirY=0){
  j.trauma=clamp(j.trauma+amount,0,1);
  const length=Math.hypot(dirX,dirY);
  if(length>0){j.kickX+=dirX/length*amount*14;j.kickY+=dirY/length*amount*14;}
}
export function punch(j,{zoom=0,flash=0,color=null,chroma=0,speedLines=0}={}){
  j.zoom=Math.max(j.zoom,zoom);j.chroma=Math.max(j.chroma,chroma);
  j.speedLines=Math.max(j.speedLines,speedLines);
  if(flash>j.flash){j.flash=flash;if(color)j.flashColor=color;}
}
// Two shockwave slots are rendered by the post-process pass; the oldest is replaced.
export function shockwave(j,x,y,strength=1,t=0){
  j.waves.push({x,y,strength,t0:t});
  if(j.waves.length>2)j.waves.shift();
}

export function updateJuice(j,dt,t){
  j.trauma=Math.max(0,j.trauma-dt*1.6);
  j.zoom*=Math.exp(-dt*9);j.chroma*=Math.exp(-dt*6);
  j.flash*=Math.exp(-dt*7);j.speedLines*=Math.exp(-dt*5);
  j.kickX*=Math.exp(-dt*12);j.kickY*=Math.exp(-dt*12);
  j.timeScale=t<j.slowUntil?.3:Math.min(1,j.timeScale+dt*2.5);
  j.waves=j.waves.filter(w=>t-w.t0<1.4);
}

// Smooth, non-repeating noise from incommensurate sines (no per-frame random jitter).
function noise(t,seed){return (Math.sin(t*1.7+seed)*.5+Math.sin(t*3.1+seed*2.3)*.3+Math.sin(t*5.9+seed*.7)*.2);}
export function shakeOffset(j,t,reduced=false){
  if(reduced)return {x:0,y:0,rotation:0};
  const s=j.trauma*j.trauma;
  return {x:s*16*noise(t*9,1.3)+j.kickX,y:s*16*noise(t*9,7.1)+j.kickY,rotation:s*.035*noise(t*7,4.2)};
}

// Critically damped spring toward 1: used for the pop-in of combo and score text.
export function popScale(age,duration=.42){
  if(age<0||age>=duration)return 1;
  const x=age/duration;
  return 1+Math.exp(-6*x)*Math.sin(x*Math.PI*3.2)*.45+(x<.08?(.08-x)*4:0);
}
export const easeOutCubic=x=>1-(1-clamp(x,0,1))**3;
export const easeInCubic=x=>clamp(x,0,1)**3;

// Displayed counters chase their target quickly but never overshoot it.
export function rollToward(current,target,dt,rate=14){
  if(target<=current)return target;
  const next=current+(target-current)*(1-Math.exp(-dt*rate));
  return target-next<1?target:next;
}

// Adaptive quality never upgrades during a session, so it cannot oscillate.
export const TIERS=['low','medium','high'];
export function createQuality(initial='high'){return {tier:initial,slow:0,average:16.7,samples:0};}
export function sampleQuality(q,frameMs,{budget=24,window=2.5}={}){
  if(!(frameMs>0)||frameMs>250)return q.tier; // ignore stalls and tab switches
  q.average+=(frameMs-q.average)*.05;q.samples++;
  if(q.samples<90)return q.tier;
  q.slow=q.average>budget?q.slow+frameMs/1000:0;
  if(q.slow>=window&&q.tier!=='low'){
    q.tier=TIERS[TIERS.indexOf(q.tier)-1];q.slow=0;q.samples=0;q.average=16.7;
  }
  return q.tier;
}

// Stylised Doppler beaming for a face-on disk: the approaching side is brighter
// and whiter, the receding side dimmer and redder. Shared by tests and shaders.
export const DOPPLER_ANGLE=Math.PI*1.08;
export function doppler(angle){return 1+.55*Math.cos(angle-DOPPLER_ANGLE);}

export function heatTier(multiplier){return multiplier>=4?'blaze':multiplier>=3?'hot':multiplier>=2?'warm':'cool';}

// Haptics are optional and only supported on some Android browsers.
export function haptic(pattern,enabled=true){
  try{if(enabled&&typeof navigator!=='undefined'&&navigator.vibrate)navigator.vibrate(pattern);}catch{/* never block flight */}
}
