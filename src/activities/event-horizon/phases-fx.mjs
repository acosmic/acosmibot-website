const colors={orbit:[9,25,48],asteroids:[85,40,20],convoy:[49,40,74],tide:[12,65,65],pulsar:[30,24,61]};
export const phaseNames={convoy:'DEBRIS WEAVE',tide:'GRAVITY TIDE',pulsar:'PULSAR SWEEP',asteroids:'ASTEROID STORM'};
export function createPhaseBackdrop(){
  let tint=[...colors.orbit];
  return (ctx,width,height,kind,dt,reduced)=>{
    const palette=(Array.isArray(kind)?kind:[kind]).map(k=>colors[k]??colors.orbit);
    const target=[0,1,2].map(i=>palette.reduce((sum,c)=>sum+c[i],0)/palette.length),blend=reduced?1:1-Math.exp(-dt*.9);
    tint=tint.map((value,i)=>value+(target[i]-value)*blend);
    const wash=ctx.createRadialGradient(width*.6,height*.5,0,width*.6,height*.5,Math.max(width,height)*.8);
    wash.addColorStop(0,`rgba(${tint.map(Math.round).join(',')},.22)`);wash.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=wash;ctx.fillRect(0,0,width,height);
  };
}
export function drawSpecial(ctx,g,run,state,reduced,showLabel=true){
  if(!run.specials.length)return;
  ctx.save();ctx.translate(g.cx,g.cy);
  if(state.kinds.includes('tide')){
    ctx.strokeStyle=state.gravity>1?'#87bbb9':'#426f76';ctx.lineWidth=2;
    const fraction=reduced?.5:((run.time*.35)%1);
    ctx.beginPath();ctx.arc(0,0,g.r*(.95-fraction*.28),-Math.PI*.9,-Math.PI*.1);ctx.stroke();
  }
  if(state.beam!==null){
    const radius=state.beam;
    ctx.strokeStyle='#ffe2a3';
    ctx.lineWidth=g.r*.036;
    ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(0,0,radius*g.r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    ctx.strokeStyle='#cab98766';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(0,0,g.r*.98,-Math.PI*.85,-Math.PI*.15);ctx.stroke();
  }
  if(showLabel){
    const stacked=state.kinds.length>1;
    const parts=stacked?state.kinds.map(k=>phaseNames[k]):phaseNames[state.kind].split(' ');
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#eee7da';
    ctx.font=`750 ${Math.max(12,Math.min(stacked?18:24,g.r*.064))}px system-ui`;
    ctx.fillText(parts[0],0,-18,g.r*.72);ctx.fillText(parts.slice(1).join(' '),0,2,g.r*.72);
    const cue=state.beam!==null?'CLIMB OUTWARD':state.gravity>1?'PULL +15%':stacked?'DOUBLE PRESSURE':state.kind==='convoy'?'RIDE THE STAIRCASE':'NORMAL PULL';
    ctx.font=`600 ${Math.max(9,Math.min(13,g.r*.042))}px system-ui`;ctx.fillStyle='#b9cbd5';ctx.fillText(cue,0,25,g.r*.62);
  }
  ctx.restore();
}
