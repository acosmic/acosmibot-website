const colors={orbit:[9,25,48],asteroids:[85,40,20],convoy:[49,40,74],tide:[12,65,65],pulsar:[30,24,61]};
export const phaseNames={convoy:'DEBRIS CONVOY',tide:'GRAVITY TIDE',pulsar:'PULSAR SWEEP',asteroids:'ASTEROID STORM'};
export function createPhaseBackdrop(){
  let tint=[...colors.orbit];
  return (ctx,width,height,kind,dt,reduced)=>{
    const target=colors[kind]??colors.orbit,blend=reduced?1:1-Math.exp(-dt*.9);
    tint=tint.map((value,i)=>value+(target[i]-value)*blend);
    const wash=ctx.createRadialGradient(width*.6,height*.5,0,width*.6,height*.5,Math.max(width,height)*.8);
    wash.addColorStop(0,`rgba(${tint.map(Math.round).join(',')},.22)`);wash.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=wash;ctx.fillRect(0,0,width,height);
  };
}
export function drawSpecial(ctx,g,run,state,reduced,showLabel=true){
  const p=run.special;if(!p)return;
  const age=run.time-p.start;
  ctx.save();ctx.translate(g.cx,g.cy);
  if(p.kind==='convoy'&&p.gap!==null){
    ctx.strokeStyle='#c6bdde';ctx.lineWidth=1.5;ctx.setLineDash([4,7]);
    ctx.beginPath();ctx.arc(0,0,g.r*p.gap,-Math.PI/2-.7,-Math.PI/2+.7);ctx.stroke();ctx.setLineDash([]);
    ctx.font='700 11px system-ui';ctx.textAlign='center';ctx.fillStyle='#e2d9ee';ctx.fillText('GAP',0,-g.r*p.gap-10);
  }
  if(p.kind==='tide'&&age>=0){
    ctx.strokeStyle=state.gravity>1?'#87bbb9':'#426f76';ctx.lineWidth=2;
    const fraction=reduced?.5:((run.time*.35)%1);
    ctx.beginPath();ctx.arc(0,0,g.r*(.95-fraction*.28),-Math.PI*.9,-Math.PI*.1);ctx.stroke();
  }
  if(p.kind==='pulsar'){
    const radius=state.beam??.50;
    ctx.strokeStyle=state.beam===null?'#ddc38a88':'#ffe2a3';
    ctx.lineWidth=state.beam===null?2:g.r*.036;
    ctx.setLineDash(state.beam===null?[6,8]:[]);
    ctx.beginPath();ctx.arc(0,0,radius*g.r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    ctx.strokeStyle='#cab98766';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(0,0,g.r*.98,-Math.PI*.85,-Math.PI*.15);ctx.stroke();
  }
  if(showLabel){
    const parts=phaseNames[p.kind].split(' ');
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#eee7da';
    ctx.font=`750 ${Math.max(12,Math.min(24,g.r*.064))}px system-ui`;
    ctx.fillText(parts[0],0,-18,g.r*.60);ctx.fillText(parts.slice(1).join(' '),0,2,g.r*.60);
    const cue=age<0?`IN ${Math.ceil(-age)}s`:p.kind==='tide'?(state.gravity>1?'PULL +15%':'NORMAL PULL'):p.kind==='pulsar'?'CLIMB OUTWARD':p.kind==='convoy'?'FOLLOW THE GAP':'WATCH THE CROSSING';
    ctx.font=`600 ${Math.max(9,Math.min(13,g.r*.042))}px system-ui`;ctx.fillStyle='#b9cbd5';ctx.fillText(cue,0,25,g.r*.62);
  }
  ctx.restore();
}
