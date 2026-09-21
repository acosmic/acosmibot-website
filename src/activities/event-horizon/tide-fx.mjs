// Shared visual timing follows simulation time, including delayed/paused viewers.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function tideStrength(run,reduced=false){
  const tide=run?.specials.find(p=>p.kind==='tide');
  if(!tide)return 0;
  const age=Math.max(0,run.time-tide.start)%7;
  if(age>=4)return 0;
  if(reduced)return .65;
  // Fade within the actual pull window; no flicker or misleading recovery glow.
  return Math.min(1,age/.3,(4-age)/.4);
}
export const TIDE_DUST_COUNT=36;
export function tideDust(i,time,out={}){
  const life=(time*.24+i/TIDE_DUST_COUNT)%1;
  const angle=i*2.399-life*2.1;
  const radius=.35+(1-life)*(.24+(i%5)*.024);
  out.x=Math.cos(angle)*radius;out.y=Math.sin(angle)*radius;
  out.angle=angle-Math.PI*.65;
  out.alpha=Math.sin(life*Math.PI)*.65;
  out.length=.006+(i%3)*.002;
  return out;
}
export function debrisOpacity(o){
  if(!o.tideCaptured)return 1;
  const radius=o.type==='crosser'?Math.hypot(o.x,o.y):o.radius;
  return clamp((radius-.35)/.07,0,1);
}
