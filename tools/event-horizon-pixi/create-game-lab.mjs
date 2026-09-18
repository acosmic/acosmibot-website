// Generate a local, network-free fixture from the real game entry point.
// The generated files are ignored and are not production build inputs.
import fs from 'node:fs';
const base=new URL('../../',import.meta.url);
let code=fs.readFileSync(new URL('src/activities/event-horizon/game.mjs',base),'utf8');
code=code.replace("const usePixi=import.meta.env.VITE_EVENT_HORIZON_RENDERER!=='canvas';","const usePixi=new URLSearchParams(location.search).get('renderer')!=='canvas';");
code=code.replace('animationFrame=requestAnimationFrame(frame);void connectDiscord();','animationFrame=requestAnimationFrame(frame);fixtureReady();');
const fixture=`
const fixtureParams=new URLSearchParams(location.search);
const fixtureErrors=[];const fixtureConsoleWarn=console.warn;console.warn=(...args)=>{fixtureErrors.push(args.map(String).join(' '));fixtureConsoleWarn(...args);};const fixtureConsoleError=console.error;console.error=(...args)=>{fixtureErrors.push(args.map(String).join(' '));fixtureConsoleError(...args);};window.addEventListener('error',e=>fixtureErrors.push(e.message));window.addEventListener('unhandledrejection',e=>fixtureErrors.push(String(e.reason)));
let fixtureFrozen=!fixtureParams.has('benchmark'),fixtureScene=0,fixtureFrame=0,fixtureSamples=[],fixtureResults=[],fixturePrevious=0;
const fixtureTimes=[30,120,165,210,270];
const fixtureOutput=document.createElement('pre');fixtureOutput.id='renderer-results';new MutationObserver(()=>{if(parent!==window)parent.postMessage({rendererLab:fixtureOutput.textContent},location.origin);}).observe(fixtureOutput,{childList:true,subtree:true,characterData:true});fixtureOutput.style.cssText='position:fixed;z-index:90;top:70px;right:10px;background:#000b;color:white;font:12px monospace;max-width:430px;max-height:230px;overflow:auto';document.body.append(fixtureOutput);
function fixtureSelect(time){
 run=createRun(42);for(let i=0;i<time*60;i++){run.alive=true;run.phase=1;run.heat=0;run.radius=.82;run.velocity=0;step(run,{boost:true});}
 run.alive=true;run.phase=0;run.energy=100;run.radius=.82;run.heat=70;run.velocity=0;mode='playing';visualTime=time;muted=true;casualAvailable=true;ticket={casual:true,maxTicks:36000};replay=[];particles=[];shake=0;accumulator=0;last=performance.now();
 $('overlay').hidden=true;$('hud').hidden=false;$('flight-controls').hidden=false;$('pause').disabled=false;$('launch').disabled=false;syncHUD();fixtureFrame=0;fixtureSamples=[];fixturePrevious=0;
}
function fixtureReady(){
 fixtureSelect(Number(fixtureParams.get('time'))||fixtureTimes[fixtureScene]);
 const controls=document.createElement('div');controls.style.cssText='position:fixed;z-index:100;bottom:55px;left:10px';document.body.append(controls);
 for(const time of fixtureTimes){const b=document.createElement('button');b.textContent='Scene '+time;b.onclick=()=>{fixtureFrozen=true;fixtureSelect(time);};controls.append(b);}
 const loss=document.createElement('button');loss.textContent='Lose GPU context';loss.onclick=()=>{const ext=gpu?.app.renderer.gl.getExtension('WEBGL_lose_context');ext?.loseContext();setTimeout(()=>ext?.restoreContext(),250);};controls.append(loss);
 const recreate=document.createElement('button');recreate.textContent='Resize renderer';recreate.onclick=()=>{resize();fixtureOutput.textContent=JSON.stringify({resized:true,renderer:usePixi?'pixi':'canvas',width,height,ratio,errors:fixtureErrors,resources:gpu?.stats()});};controls.append(recreate);
 const sweep=document.createElement('button');sweep.textContent='Sweep ten minutes';sweep.onclick=async()=>{
 fixtureFrozen=true;let maxTextures=0;
 for(let sec=0;sec<=600;sec+=5){fixtureSelect(sec);if(usePixi)renderPixi(0);else render(0);maxTextures=Math.max(maxTextures,gpu?.stats().textures??0);await new Promise(requestAnimationFrame);}
 fixtureSelect(30);if(usePixi)renderPixi(0);else render(0);
 fixtureOutput.textContent=JSON.stringify({sweepComplete:true,maxTextures,resources:gpu?.stats(),errors:fixtureErrors});
 };controls.append(sweep);
 const play=document.createElement('button');play.textContent='Play fixture';play.onclick=()=>{fixtureFrozen=false;};controls.append(play);
 fixtureOutput.textContent=JSON.stringify({ready:true,renderer:usePixi?'pixi':'canvas',width,height,ratio,errors:fixtureErrors,resources:gpu?.stats()});
}
const fixtureActualFrame=frame;
frame=now=>{
 if(disposed)return;
 if(fixtureFrozen){if(usePixi)renderPixi(0);else render(0);animationFrame=requestAnimationFrame(frame);return;}
 run.alive=true;run.phase=1;run.heat=70;
 if(run.radius<.6||run.radius>1){run.radius=.82;run.velocity=0;}
 if(run.radius<.82)keys.add('Space');else keys.clear();
 const start=performance.now();fixtureActualFrame(now);const cost=performance.now()-start;
 if(fixtureFrame>=60)fixtureSamples.push({cost,interval:now-fixturePrevious});fixturePrevious=now;fixtureFrame++;
 if(fixtureParams.has('benchmark')&&fixtureFrame===300){
  const sorted=fixtureSamples.map(s=>s.cost).sort((a,b)=>a-b),intervals=fixtureSamples.map(s=>s.interval).sort((a,b)=>a-b);
  fixtureResults.push({time:fixtureTimes[fixtureScene],frames:fixtureSamples.length,mean:sorted.reduce((a,b)=>a+b,0)/sorted.length,p50:sorted[120],p95:sorted[228],fps:240000/intervals.reduce((a,b)=>a+b,0),intervalP95:intervals[228],framesOver25ms:intervals.filter(n=>n>25).length});
  fixtureScene++;if(fixtureScene<fixtureTimes.length)fixtureSelect(fixtureTimes[fixtureScene]);else fixtureFrozen=true;
  fixtureOutput.textContent=JSON.stringify({complete:fixtureFrozen,renderer:usePixi?'pixi':'canvas',width,height,ratio,errors:fixtureErrors,resources:gpu?.stats(),results:fixtureResults},null,2);
 }
};
`;
code=code.replace('void bootRenderer();',fixture+'\nvoid bootRenderer();');
fs.writeFileSync(new URL('src/activities/event-horizon/renderer-lab.generated.mjs',base),code);
const html=fs.readFileSync(new URL('activities/event-horizon/index.html',base),'utf8').replace('/src/activities/event-horizon/game.mjs','/src/activities/event-horizon/renderer-lab.generated.mjs');
fs.writeFileSync(new URL('activities/event-horizon/renderer-lab.generated.html',base),html);
