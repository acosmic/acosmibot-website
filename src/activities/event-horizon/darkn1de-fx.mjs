// Presentation only: sightings never touch simulation RNG, input, or scoring.
export const SIGHTINGS = [30,82,127,172,217];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function darkn1deView(run,reduced=false){
  const age=run.time-(run.darkDefeatedAt||0),defeating=run.darkStage===3&&age<2;
  const active=run.darkStage===1||run.darkStage===2;
  const sight=run.darkStage===0?SIGHTINGS.findIndex((t,i)=>run.time>=t&&run.time<t+[.55,.7,.9,.9,1.15][i]):-1;
  const start=SIGHTINGS[sight],duration=[.55,.7,.9,.9,1.15][sight];
  const opacity=sight<0?0:Math.sin((run.time-start)/duration*Math.PI);
  const p=defeating?clamp(age/2,0,1):0;
  return {active,defeating,sight,opacity,asset:run.darkStage===1?'inversion':active||defeating?'arrival':'apparition',
    alpha:active?1:defeating?1-p:sight===2?.075*opacity:sight===4?.14*opacity:0,
    scale:defeating?Math.max(.01,1-p*p):1,
    rotation:defeating&&!reduced?p*p*6:0,
    y:defeating?p*.13:reduced?0:Math.sin(run.time*1.3)*.012,
    pulse:defeating?age:0};
}
export function bossCaption(run){
  if(run.darkStage===1)return ['DARKN1DE','RELEASE TO CLIMB'];
  if(run.darkStage===2)return ['BREACHSTORM',run.resonance>=10?'RESONANCE PULSE · SHIFT':`RESONANCE ${run.resonance}/10`];
  return ['', ''];
}
// Small shared path vocabulary keeps Canvas fallback and WebGL geometry aligned.
export function darkShapes(run,view){
  const shapes=[],line=(points,color,alpha,width)=>shapes.push({points,color,alpha,width});
  const red=0xff546a,cyan=0x8afff5;
  if(view.sight===0||view.sight===4){
    for(const side of [-1,1])line([side*.035-.013,-.035,side*.035+.013,-.027],red,view.opacity*(view.sight===0?.23:.5),.006);
  }
  if(view.sight===1)line([-.20,.025,-.07,.013,.025,.033,.13,.018],red,view.opacity*.19,.003);
  if(view.sight===3)for(let i=0;i<6;i++){
    const a=i*.47,rr=.18+(run.time-172)*.05;
    line([Math.cos(a)*rr,Math.sin(a)*rr*.38,Math.cos(a)*(rr+.006),Math.sin(a)*rr*.38],red,view.opacity*.28,.004);
  }
  if(view.sight===4)for(let i=0;i<3;i++)line([.16+i*.014,.10,.17+i*.014,.13,.16+i*.014,.145],0x9297a8,view.opacity*.28,.008);
  for(const o of run.attacks??[]){
    const warn=o.warning>0;
    if(o.type==='spear'){
      if(warn)line([-1.15,o.y,1.15,o.y],red,.22,.003);
      else {
        const points=[o.x-Math.sign(o.vx)*.13,o.y,o.x,o.y];
        line(points,red,.18,.06);line(points,red,.95,.014);line(points,0xffd8df,.95,.004);
      }
    }else{
      const x=Math.sin(o.angle)*o.radius,y=-Math.cos(o.angle)*o.radius;
      const points=[x-.010,y-.036,x+.009,y-.014,x-.008,y+.008,x+.004,y+.034];
      if(!warn)line(points,red,.16,.026);
      line(points,red,warn?.32:.9,warn?.004:.009);
      if(!warn)line(points,0xffd8df,.9,.002);
      if(warn)line([Math.sin(.16)*o.radius,-Math.cos(.16)*o.radius,0,-o.radius],red,.18,.004);
    }
  }
  if(view.defeating){
    const rr=view.pulse*1.05;
    shapes.push({circle:rr,color:cyan,alpha:Math.max(0,1-view.pulse/2)*.7,width:.012});
    for(let i=0;i<10;i++){
      const a=i*Math.PI/5+view.pulse*.3,r=.08+view.pulse*.3;
      line([Math.cos(a)*r,Math.sin(a)*r,Math.cos(a)*(r+.025),Math.sin(a)*(r+.025)],i%2?cyan:red,1-view.pulse/2,.005);
    }
  }
  return shapes;
}
export function drawDarkn1de(ctx,g,run,images,reduced){
  const view=darkn1deView(run,reduced);
  ctx.save();ctx.translate(g.cx,g.cy);
  if(view.alpha>0){
    const image=images[view.asset],h=g.r*.65*view.scale;
    if(image?.complete&&image.naturalWidth){ctx.save();ctx.translate(0,g.r*(view.y-.035));ctx.rotate(view.rotation);ctx.globalAlpha=view.alpha;ctx.drawImage(image,-h*image.naturalWidth/image.naturalHeight/2,-h/2,h*image.naturalWidth/image.naturalHeight,h);ctx.restore();}
  }
  for(const shape of darkShapes(run,view)){
    ctx.beginPath();ctx.globalAlpha=shape.alpha;ctx.strokeStyle='#'+shape.color.toString(16).padStart(6,'0');ctx.lineWidth=Math.max(.7,shape.width*g.r);
    if(shape.circle!==undefined)ctx.arc(0,0,shape.circle*g.r,0,Math.PI*2);
    else for(let i=0;i<shape.points.length;i+=2){if(i)ctx.lineTo(shape.points[i]*g.r,shape.points[i+1]*g.r);else ctx.moveTo(shape.points[i]*g.r,shape.points[i+1]*g.r);}
    ctx.stroke();
  }
  ctx.globalAlpha=1;ctx.textAlign='center';ctx.fillStyle='#dceff5';ctx.font=`700 ${Math.max(10,g.r*.034)}px system-ui`;
  bossCaption(run).forEach((line,i)=>ctx.fillText(line,0,g.r*(.32+i*.05),g.r*.85));
  ctx.restore();
}
