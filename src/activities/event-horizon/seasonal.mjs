import { CLASSIC_HOLE } from './render-cache.mjs';
import { BULBS, artVariant } from './seasonal-art.mjs';
export { drawSeasonalObject } from './seasonal-art.mjs';
// Cosmetic themes never mutate simulation state, collision geometry, or replay inputs.
// Availability comes from the owner-controlled runtime configuration.
export const SEASONS = Object.freeze([
  {id:'classic', name:'Classic', description:'Rocks, plasma flares, and asteroids.'},
  {id:'halloween', name:'Halloween', description:'Tumbling skulls, glowing jack-o’-lanterns, and a candy storm under a haunted sky.'},
  {id:'thanksgiving', name:'Thanksgiving', description:'Roast turkeys, bubbling gravy, and a pie storm over a harvest sky.'},
  {id:'christmas', name:'Christmas', description:'Snowballs and coal, Christmas lights, and runaway presents in a winter orbit.'},
]);
export function normalizeAvailability(value) {
  return Object.fromEntries(SEASONS.map(({id})=>[id,id==='classic'?'playable':
    value && typeof value==='object' && ['hidden','coming_soon','playable'].includes(value[id])?value[id]:'hidden']));
}
export const seasonState = (season,availability) => normalizeAvailability(availability)[season.id]??'hidden';
export const seasonEnabled = (season,availability) => seasonState(season,availability)==='playable';
export const availableSeason = (value,availability) => SEASONS.some(s=>s.id===value&&seasonEnabled(s,availability))?value:'classic';
export function readSeason(storage,availability) {try{return availableSeason(storage?.getItem('eh-season'),availability);}catch{return 'classic';}}
export function saveSeason(storage,value,availability) {const theme=availableSeason(value,availability);try{storage?.setItem('eh-season',theme);}catch{/* webview storage is optional */}return theme;}

// One palette per season. Everything here is presentation: colours, copy, and which
// ambient layer and debris bits the renderer bakes. Shards, Phase Shift, warning lines,
// and heat cues keep their Classic colours in every season so they always read the same.
const CLASSIC = {
  id:'classic',swatch:['#67ecff','#a98bff'],
  backdrop:{base:'#050812',glows:[[.85,.25,.6,'#261747'],[.16,.7,.7,'#092e4c'],[.65,.72,.35,'#331136']]},
  nebula:[0,1],stars:[0xc9b6ff,0xffe6c8,0xcfeeff],comet:0xd8f4ff,
  hole:CLASSIC_HOLE,disk:[[1,.94,.82],[1,.58,.24],[.82,.2,.12]],
  aura:0xff4f7d,rim:['rgba(255,190,120,.85)','rgba(255,120,60,.35)','rgba(255,90,40,0)'],streak:['#ff724400','#ff9a5a99','#ffe0b8ee'],
  exhaust:'#7ff1ff',trail:0x4fe4ff,flame:[.35,.95,1],engine:0x59e8ff,
  fx:{near:'#9af3ff',death:'#ffa677',deathCore:'#fff1d6',smoke:'#46304a'},
  bits:0,ambient:null,lost:'ORBIT LOST',
  rule:'Skim the hot inner orbit for up to 5× points, dodge rocks and plasma, collect cyan shards, and boost out to cool down.',
  copy:[],
};
const THEMES = {
  classic:CLASSIC,
  halloween:{...CLASSIC,id:'halloween',swatch:['#ff9b36','#8a4dff'],
    backdrop:{base:'#07060f',glows:[[.85,.25,.6,'#2a1247'],[.16,.7,.7,'#12300f'],[.65,.72,.35,'#3a1a08']]},
    nebula:[['rgba(120,50,190,A)','rgba(60,150,50,A)','rgba(210,90,20,A)','rgba(90,200,90,A)'],['rgba(70,140,40,A)','rgba(150,50,180,A)','rgba(230,110,30,A)','rgba(60,40,120,A)']],
    stars:[0xb9ff9a,0xffc27a,0xe6d8ff],comet:0xb6ff9a,
    hole:{...CLASSIC_HOLE,hue:16,span:16,photon:[255,160,70],bloom:['#ff8a2a65','#7a2aa82b','#4c9a2a00'],rim:'#ffd28a',ember:[0xff9a3c,0xb6ff6a],emberCss:['#ff9a3c99','#b6ff6acc']},
    disk:[[1,.9,.62],[1,.48,.1],[.5,.16,.72]],
    aura:0xff9b36,rim:['rgba(170,255,140,.8)','rgba(90,220,90,.3)','rgba(60,200,80,0)'],streak:['#7a2aff00','#b56bff99','#ffd9ffee'],
    exhaust:'#a8ff7a',trail:0x86f06a,flame:[.5,1,.38],engine:0x8cff66,
    fx:{near:'#c9a6ff',death:'#ff9b36',deathCore:'#eaffc8',smoke:'#2c2140'},
    bits:3,ambient:{kind:'bats',count:6},lost:'R.I.P. ORBIT',
    rule:'Skim the hot inner orbit for up to 5× points, dodge skulls and jack-o’-lanterns, collect cyan shards, and boost out to cool down.',
    copy:[[/ASTEROID/g,'CANDY'],[/asteroid/g,'candy meteor'],[/plasma flare/g,'jack-o’-lantern'],[/orbital debris/g,'a tumbling skull']]},
  thanksgiving:{...CLASSIC,id:'thanksgiving',swatch:['#f0a23c','#a8431f'],
    backdrop:{base:'#0a0708',glows:[[.85,.25,.6,'#3a1c10'],[.16,.7,.7,'#2e2408'],[.65,.72,.35,'#3a1018']]},
    nebula:[['rgba(170,70,30,A)','rgba(190,130,30,A)','rgba(120,30,50,A)','rgba(200,150,60,A)'],['rgba(140,60,20,A)','rgba(110,90,30,A)','rgba(220,120,50,A)','rgba(90,30,40,A)']],
    stars:[0xffd9a0,0xffb86a,0xfff0d8],comet:0xffe2a8,
    hole:{...CLASSIC_HOLE,hue:28,span:18,photon:[255,200,120],bloom:['#ffb05a65','#a8502a2b','#8a3a1a00'],rim:'#ffe9bd',ember:[0xffc070,0xffe9b0],emberCss:['#ffc07099','#ffe9b0cc']},
    disk:[[1,.95,.8],[.98,.64,.2],[.6,.22,.08]],
    aura:0xffb347,streak:['#ff8a2a00','#ffb45a99','#fff0c8ee'],
    exhaust:'#ffc46a',trail:0xffb04a,flame:[1,.72,.3],engine:0xffb45a,
    fx:{near:'#ffd9a0',death:'#c98a2c',deathCore:'#fff0c8',smoke:'#3a2616'},
    bits:4,ambient:{kind:'leaves',count:16},lost:'ORBIT STUFFED',
    rule:'Skim the hot inner orbit for up to 5× points, dodge roast turkeys and gravy, collect cyan shards, and boost out to cool down.',
    copy:[[/ASTEROID/g,'PIE'],[/asteroid/g,'flying pie'],[/plasma flare/g,'gravy flare'],[/orbital debris/g,'a roast turkey']]},
  christmas:{...CLASSIC,id:'christmas',swatch:['#e8474c','#3fbf73'],
    backdrop:{base:'#040a14',glows:[[.85,.25,.6,'#0c2a4a'],[.16,.7,.7,'#0a3324'],[.65,.72,.35,'#3a0f1c']]},
    nebula:[['rgba(30,130,90,A)','rgba(40,110,200,A)','rgba(180,40,60,A)','rgba(120,220,220,A)'],['rgba(30,90,170,A)','rgba(40,160,110,A)','rgba(200,60,70,A)','rgba(150,200,255,A)']],
    stars:[0xff9a9a,0x9affb0,0xeaf6ff],comet:0xfff2b8,
    hole:{...CLASSIC_HOLE,hue:196,span:18,photon:[200,235,255],photonStep:[4,2,0],bloom:['#8fd8ff65','#3a6ad02b','#2a8a5a00'],rim:'#e6f6ff',ember:[0xff5a5a,0x7dff9a],emberCss:['#ff5a5a99','#7dff9acc']},
    disk:[[.95,.98,1],[.5,.8,1],[.2,.35,.85]],
    aura:0xffd24d,rim:['rgba(220,240,255,.85)','rgba(140,200,255,.35)','rgba(100,170,255,0)'],streak:['#4db8ff00','#bfe6ff99','#ffffffee'],
    exhaust:'#e6f6ff',trail:0xbfe6ff,flame:[.72,.9,1],engine:0xcdeaff,
    fx:{near:'#eaf6ff',death:'#ff6b6b',deathCore:'#f2fff6',smoke:'#24344a'},
    bits:4,ambient:{kind:'snow',count:70},lost:'ORBIT FROZEN',
    rule:'Skim the hot inner orbit for up to 5× points, dodge snowballs and Christmas lights, collect cyan shards, and boost out to cool down.',
    copy:[[/ASTEROID/g,'PRESENT'],[/asteroid/g,'runaway present'],[/plasma flare/g,'Christmas light'],[/orbital debris/g,'a snowball']]},
};
export const seasonTheme = id => THEMES[id]??CLASSIC;
export function seasonalCopy(text,theme){return seasonTheme(theme).copy.reduce((value,[from,to])=>value.replace(from,to),text);}

export function paintBackdrop(ctx,width,height,theme) {
  const {base,glows}=seasonTheme(theme).backdrop;
  ctx.fillStyle=base;ctx.fillRect(0,0,width,height);
  for(const [x,y,r,color] of glows){
    const grad=ctx.createRadialGradient(width*x,height*y,0,width*x,height*y,width*r);
    grad.addColorStop(0,color);grad.addColorStop(1,`${base}00`);
    ctx.fillStyle=grad;ctx.fillRect(0,0,width,height);
  }
}
// Christmas lights glow in their own bulb colour; every other hot hazard uses the theme aura.
export function hazardAura(o,theme) {return theme==='christmas'?BULBS[artVariant(o,BULBS.length)][0]:seasonTheme(theme).aura;}
// Faces, bulbs, and turkeys rock instead of tumbling upside down. Presentation only.
const ROCKING = {halloween:['plasma'],thanksgiving:['rock'],christmas:['plasma']};
export function hazardRotation(o,theme) {return ROCKING[theme]?.includes(o.type)?Math.sin(o.spin||0)*.3:o.spin;}

const hash = (i,salt) => {const v=Math.sin(i*127.1+salt*311.7)*43758.5453;return v-Math.floor(v);};
// Deterministic ambient motion from time and index alone: no per-sprite state to reset.
export function ambientPose(kind,i,t,width,height,out={}) {
  const a=hash(i,1),b=hash(i,2),c=hash(i,3);
  out.flip=1;out.squash=1;
  if(kind==='snow'){
    out.x=((a*width+Math.sin(t*.4+i)*18)%width+width)%width;out.y=(b*height+t*(18+c*30))%(height+20)-10;
    out.size=2+c*3.5;out.rotation=t*(.2+a)+i;out.alpha=.3+b*.4;
  }else if(kind==='leaves'){
    out.x=width+40-(a*(width+80)+t*(25+c*30))%(width+80);out.y=(b*height+t*(12+c*14))%(height+40)-20+Math.sin(t*.8+i)*14;
    out.size=11+c*8;out.rotation=t*(.6+c)+i;out.alpha=.5;
  }else{
    const span=width+80,travel=(a*span+t*(40+c*40))%span;
    out.flip=i%2?1:-1;out.x=out.flip>0?travel-40:width+40-travel;out.y=b*height*.8+Math.sin(t*1.3+i*2)*22;
    out.size=18+c*12;out.rotation=Math.sin(t*1.3+i*2)*.15*out.flip;out.squash=.5+.5*Math.abs(Math.sin(t*9+i));out.alpha=.75;
  }
  return out;
}
