// Local artwork is shared by the retained GPU sprites and Canvas rollback renderer.
export function drawObjectArt(ctx,o,rr,reduced){
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
}
