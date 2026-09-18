import { holeGeometry } from './render-cache.mjs';
const allLayers={};

// Cache belongs to one camera/resolution. The optional layer mask is for the
// renderer experiment; the game draws every layer in the original order.
export function drawBlackHole(ctx,t,{cx,cy,r},reduced,cache={},layers=allLayers){
  const geometry=cache.geometry??=holeGeometry(r,reduced);
  ctx.save(); ctx.translate(cx,cy);
  if(layers.bloom!==false){
    const bloom=ctx.createRadialGradient(0,0,r*.30,0,0,r*.76);
    bloom.addColorStop(0,'#ffa06465');bloom.addColorStop(.35,'#b840352b');bloom.addColorStop(1,'#a9408200');
    ctx.fillStyle=bloom;ctx.beginPath();ctx.arc(0,0,r*.76,0,Math.PI*2);ctx.fill();
  }
  // Accretion streamlines orbit continuously. Bright inner light contrasts with
  // the quiet, readable outer flight lane rather than covering it with particles.
  if(layers.streams!==false)for(const {i,k,rr,ry,color,width:lineWidth} of geometry.streams) {
    ctx.strokeStyle=color;
    ctx.lineWidth=lineWidth;
    ctx.beginPath();const a=i*2.39+t*(.08+k*.12);
    ctx.ellipse(0,0,rr,ry,-.28,a,a+1.8+(i%3));ctx.stroke();
  }
  if(layers.core!==false){
    const hole=ctx.createRadialGradient(-r*.08,-r*.1,0,0,0,r*.35);
    hole.addColorStop(0,'#010208');hole.addColorStop(.9,'#020309');hole.addColorStop(1,'#271621');
    ctx.fillStyle=hole;ctx.beginPath();ctx.arc(0,0,r*.35,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#ffe4b6';ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(0,0,r*.354,0,Math.PI*2);ctx.stroke();
  }
  // Tapered photon streams skim the rim; nothing crosses the dark center.
  if(layers.photons!==false)for(const {i,rr,span,strokes} of geometry.photons){
    const head=i*2.399+(reduced?0:t*(.18+i*.027));
    for(const {j,color,width:lineWidth} of strokes){
      ctx.strokeStyle=color;
      ctx.lineWidth=lineWidth;
      ctx.beginPath();ctx.arc(0,0,rr,head-span+j*span/12,head-span+(j+1)*span/12+.002);ctx.stroke();
    }
  }
  if(layers.embers!==false&&!reduced)for(let i=0;i<60;i++){
    const a=i*2.399+t*(.06+i%4*.025),rr=r*(.37+(i%13)*.006);
    ctx.fillStyle=i%3?'#ffc68999':'#fff1cacc';
    ctx.fillRect(Math.cos(a)*rr,Math.sin(a)*rr,.8+i%2,.8+i%2);
  }
  if(layers.lane!==false){
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
  const advances=cache.titleAdvances??=Array.from(title,char=>ctx.measureText(char).width+tracking);
  let angle=-Math.PI/2-advances.reduce((sum,w)=>sum+w,0)/(2*titleRadius);
  Array.from(title).forEach((char,i)=>{
    const half=advances[i]/(2*titleRadius);angle+=half;
    ctx.save();ctx.translate(Math.cos(angle)*titleRadius,Math.sin(angle)*titleRadius);
    ctx.rotate(angle+Math.PI/2);ctx.fillText(char,0,0);ctx.restore();angle+=half;
  });
  ctx.restore();
  ctx.fillStyle='#ffcca9';ctx.font=`500 ${Math.max(9,r*.025)}px system-ui`;ctx.fillText('HOT ORBIT · HIGH SCORE',0,r*.60);
  }
  ctx.restore();
}
