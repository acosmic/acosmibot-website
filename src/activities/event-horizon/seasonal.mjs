// Cosmetic themes never mutate simulation state, collision geometry, or replay inputs.
export const SEASONS = Object.freeze([
  {id:'classic', name:'Classic', available:true, description:'Rocks, plasma flares, and asteroids.'},
  {id:'halloween', name:'Halloween', available:true, description:'Tumbling skulls, jack-o’-lantern flares, and a candy storm.'},
  {id:'thanksgiving', name:'Thanksgiving', available:false, description:'Coming soon · exploding turkeys bursting into gravy.'},
  {id:'christmas', name:'Christmas', available:false, description:'Coming soon · a winter orbit is on its way.'},
]);
export const availableSeason = value => SEASONS.some(s=>s.id===value&&s.available)?value:'classic';
export function readSeason(storage) {try{return availableSeason(storage?.getItem('eh-season'));}catch{return 'classic';}}
export function saveSeason(storage,value) {const theme=availableSeason(value);try{storage?.setItem('eh-season',theme);}catch{/* webview storage is optional */}return theme;}
export function seasonalCopy(text,theme){return theme==='halloween'?text.replace(/ASTEROID/g,'CANDY').replace(/asteroid/g,'candy meteor').replace(/plasma flare/g,'jack-o’-lantern').replace(/orbital debris/g,'a tumbling skull'):text;}

export function drawSeasonalObject(ctx,o,rr,theme){
  if(theme!=='halloween'||!['plasma','rock','crosser'].includes(o.type))return false;
  ctx.save();ctx.scale(rr,rr);ctx.lineJoin='round';ctx.lineWidth=.065;
  if(o.type==='plasma'){
    // A round lantern keeps the flare's hit radius legible, even without bloom.
    const glow=ctx.createRadialGradient(-.3,-.4,.05,0,0,1);glow.addColorStop(0,'#ffcc65');glow.addColorStop(.5,'#ff8b24');glow.addColorStop(1,'#a43c14');ctx.fillStyle=glow;ctx.strokeStyle='#ffd078';
    ctx.beginPath();ctx.ellipse(0,.04,.94,.86,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle='#b74718';ctx.lineWidth=.055;
    for(const x of [-.4,.4]){ctx.beginPath();ctx.ellipse(x*.4,.04,.45,.8,0,-Math.PI/2,Math.PI/2);ctx.stroke();}
    ctx.fillStyle='#799744';ctx.fillRect(-.11,-1,.22,.22);
    ctx.fillStyle='#321524';
    for(const x of [-.36,.36]){ctx.beginPath();ctx.moveTo(x,-.43);ctx.lineTo(x-.21,-.04);ctx.lineTo(x+.21,-.04);ctx.closePath();ctx.fill();}
    ctx.beginPath();ctx.moveTo(-.57,.23);ctx.lineTo(-.23,.4);ctx.lineTo(-.09,.23);ctx.lineTo(.1,.4);ctx.lineTo(.27,.23);ctx.lineTo(.56,.23);ctx.lineTo(.34,.61);ctx.lineTo(-.31,.61);ctx.closePath();ctx.fill();
    ctx.fillStyle='#ffe198';for(const x of [-.36,.36]){ctx.beginPath();ctx.arc(x,-.16,.055,0,Math.PI*2);ctx.fill();}
  }else if(o.type==='crosser'){
    const pink=Math.floor(Math.abs(o.shape||0)*100)%2===0;
    ctx.fillStyle=pink?'#f873bc':'#b2ed73';ctx.strokeStyle='#fff4d6';
    for(const sign of [-1,1]){ctx.beginPath();ctx.moveTo(sign*.47,0);ctx.lineTo(sign*.85,-.47);ctx.lineTo(sign*.98,-.2);ctx.lineTo(sign*.9,.08);ctx.lineTo(sign*.85,.47);ctx.closePath();ctx.fill();ctx.stroke();}
    ctx.beginPath();ctx.ellipse(0,0,.66,.72,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.save();ctx.clip();ctx.strokeStyle=pink?'#fff0c9':'#407143';ctx.lineWidth=.23;
    for(const x of [-.7,0,.7]){ctx.beginPath();ctx.moveTo(x-.45,-.8);ctx.lineTo(x+.45,.8);ctx.stroke();}ctx.restore();
    ctx.fillStyle='#ffffff';ctx.beginPath();ctx.ellipse(-.23,-.38,.2,.09,-.4,0,Math.PI*2);ctx.fill();
  }else{
    const bone=ctx.createLinearGradient(-.6,-.8,.7,.9);bone.addColorStop(0,'#fff4d2');bone.addColorStop(.55,'#ded2b5');bone.addColorStop(1,'#9f8d81');ctx.fillStyle=bone;ctx.strokeStyle='#bca995';
    ctx.beginPath();ctx.ellipse(0,-.15,.86,.8,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle=bone;ctx.fillRect(-.5,.25,1,.6);
    ctx.fillStyle='#30243b';
    for(const x of [-.34,.34]){ctx.beginPath();ctx.ellipse(x,-.16,.25,.28,x*.4,0,Math.PI*2);ctx.fill();}
    ctx.beginPath();ctx.moveTo(0,.11);ctx.lineTo(-.14,.39);ctx.lineTo(.14,.39);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#6c6070';ctx.lineWidth=.065;
    for(const x of [-.28,0,.28]){ctx.beginPath();ctx.moveTo(x,.55);ctx.lineTo(x,.85);ctx.stroke();}
    ctx.beginPath();ctx.moveTo(.12,-.92);ctx.lineTo(-.04,-.62);ctx.lineTo(.13,-.5);ctx.stroke();
  }
  ctx.restore();return true;
}
