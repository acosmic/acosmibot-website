// Cache only values independent of animation time. Draw order and canvas
// operations stay unchanged, including at reduced-effects and resize boundaries.
export function holeGeometry(r,reduced){
  const count=reduced?22:62;
  return {
    streams:Array.from({length:count},(_,i)=>{
      const k=i/count,rr=r*(.36+k*.11);
      return {i,k,rr,ry:rr*(.92+Math.sin(i)*.04),color:`hsla(${20+k*26},100%,${60+k*28}%,${.16+(1-k)*.55})`,width:(i%4===0?2.4:1)*Math.max(.6,r/300)};
    }),
    photons:Array.from({length:reduced?3:7},(_,i)=>({i,rr:r*(.36+i*.004),span:.42+(i%3)*.18,
      strokes:Array.from({length:12},(_,j)=>{
        const strength=(j+1)/12;
        return {j,color:`rgba(255,${185+i*8},${115+i*13},${strength*.75})`,width:Math.max(.6,r/300)*(.5+strength*1.3)};
      })
    }))
  };
}

// Keep surviving particle references and their draw order, retaining the newest
// 240 exactly as filter(...).slice(-240) did, without two new arrays per frame.
export function compactParticles(particles,limit=240){
  let write=0;
  for(let read=0;read<particles.length;read++)if(particles[read].life>0)particles[write++]=particles[read];
  if(write>limit)particles.copyWithin(0,write-limit,write);
  particles.length=Math.min(write,limit);
}

export function cachedLabel(){
  const values=new Map();
  return (key,value,format)=>{
    const entry=values.get(key);
    if(entry&&Object.is(entry.value,value))return entry.text;
    const text=format(value);values.set(key,{value,text});return text;
  };
}
