import { drawBlackHole } from '../../src/activities/event-horizon/black-hole.mjs';
import { flightCamera } from '../../src/activities/event-horizon/camera.mjs';
import { createPixiHole } from './black-hole.mjs';
const params=new URLSearchParams(location.search);
const width=Number(params.get('width'))||1280,height=Number(params.get('height'))||720,ratio=2;
const camera=flightCamera(width,height),reduced=params.has('reduced');
const reference=document.getElementById('reference'),candidate=document.getElementById('candidate');
reference.width=width*ratio;reference.height=height*ratio;
const ctx=reference.getContext('2d'),cache={};
ctx.scale(ratio,ratio);
const canvasRender=t=>{ctx.clearRect(0,0,width,height);drawBlackHole(ctx,t,camera,reduced,cache);};
const results=document.getElementById('results');
try{
  const pixi=await createPixiHole({canvas:candidate,width,height,ratio,camera,reduced});
  canvasRender(120);pixi.render(120);
  let animated=false,frameId;
  function animate(now){if(!animated)return;canvasRender(now/1000);pixi.render(now/1000);frameId=requestAnimationFrame(animate);}
  document.getElementById('animate').onclick=()=>{animated=!animated;if(animated)frameId=requestAnimationFrame(animate);else cancelAnimationFrame(frameId);};
  results.textContent=JSON.stringify({ready:true,width,height,ratio,reduced,textureBytes:pixi.textureBytes},null,2);
  const summarize=a=>{a.sort((x,y)=>x-y);return {mean:a.reduce((a,b)=>a+b,0)/a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)]};};
  document.getElementById('benchmark').onclick=async()=>{
    document.getElementById('benchmark').disabled=true;document.getElementById('animate').disabled=true;
    animated=false;cancelAnimationFrame(frameId);results.textContent='Measuring…';
    const metrics={width,height,ratio,reduced,textureBytes:pixi.textureBytes,scenes:[]};
    for(const time of [0,30,120,210,300]){
      const canvasTimes=[],pixiTimes=[];
      for(let i=0;i<150;i++){
        await new Promise(requestAnimationFrame);
        const t=time+i/60;
        // Alternate order to reduce systematic scheduler bias. CPU submission
        // is reported separately from readback; it is not a GPU or FPS claim.
        const measure=(fn,samples)=>{const start=performance.now();fn(t);samples.push(performance.now()-start);};
        if(i%2){measure(pixi.render,pixiTimes);measure(canvasRender,canvasTimes);}
        else{measure(canvasRender,canvasTimes);measure(pixi.render,pixiTimes);}
      }
      metrics.scenes.push({time,canvas:summarize(canvasTimes.slice(30)),pixi:summarize(pixiTimes.slice(30))});
    }
    canvasRender(120);pixi.render(120);
    // Compare the visible composite, not unpremultiplied RGB in transparent pixels.
    // Capture immediately after render (WebGL's drawing buffer is not preserved).
    const composite=document.createElement('canvas');composite.width=reference.width;composite.height=reference.height;
    const pixels=composite.getContext('2d',{willReadFrequently:true});
    const capture=source=>{pixels.fillStyle='#050814';pixels.fillRect(0,0,composite.width,composite.height);pixels.drawImage(source,0,0);return pixels.getImageData(0,0,composite.width,composite.height).data;};
    const a=capture(reference);pixi.render(120);const b=capture(candidate);
    let changed=0,total=0,max=0,overEight=0;
    for(let i=0;i<a.length;i+=4){let diff=0,peak=0;for(let c=0;c<3;c++){const d=Math.abs(a[i+c]-b[i+c]);diff+=d;peak=Math.max(peak,d);max=Math.max(max,d);total+=d;}if(diff)changed++;if(peak>8)overEight++;}
    metrics.pixelDifference={changedPixels:changed,totalPixels:a.length/4,pixelsOverEight:overEight,meanChannelError:total/(a.length/4*3),maxChannelError:max};
    results.textContent=JSON.stringify(metrics,null,2);
    document.getElementById('benchmark').disabled=false;document.getElementById('animate').disabled=false;
  };
  window.addEventListener('pagehide',()=>{animated=false;cancelAnimationFrame(frameId);pixi.destroy();},{once:true});
}catch(error){results.textContent=error.stack;throw error;}
