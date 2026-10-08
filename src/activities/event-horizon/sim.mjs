// Pure, seeded 60 Hz ranked simulation. Kept byte-identical to the API v9 verifier.
export const DT = 1 / 60;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function createRun(seed = 1) {
  return { seed: seed >>> 0 || 1, rng: seed >>> 0 || 1, time: 0, tick: 0,
    radius: .8, velocity: 0, heat: 0, energy: 100, phase: 0,
    score: 0, multiplier: 1, combo: 0, comboClock: 0, shards: 0, nearMisses: 0,
    objects: [], crossers: [], nextCrosser: 60, stormStarted: false,
    darkStage: 0, resonance: 0, darkDefeatedAt: 0, nextAttack: 285, attackNumber: 0, attacks: [],
    specials: [], nextSpecial: 105, nextKind: 'convoy',
    nextWave: 1.1, wave: 0, alive: true, cause: '', events: [], dashHeld: false };
}
function rand(s) { let x = s.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s.rng = x >>> 0; return s.rng / 4294967296; }
export const isInverted = s => s.darkStage === 1;
export const thrustActive = (s, held) => isInverted(s) ? !held : !!held;
export const resonanceReady = s => s.darkStage === 2 && s.resonance >= 10;
export function specialState(s) {
  const kinds=s.specials.map(p=>p.kind), tide=s.specials.find(p=>p.kind==='tide');
  const pulsar=s.specials.find(p=>p.kind==='pulsar');
  const age=pulsar?s.time-pulsar.start:0, cycle=Math.floor(age/8), sweep=age%8;
  // The sweep emerges from inside the hole, never materializes on the pilot.
  if(s.darkStage===1)kinds.push('inversion');
  if(s.darkStage===2)kinds.push('breachstorm');
  return {kind:kinds.at(-1)??(s.time>=60?'asteroids':'orbit'),kinds,
    gravity:tide&&(s.time-tide.start)%7<4?1.15:1,
    beam:pulsar&&sweep<6.5?.40+sweep*.08:null,cycle,pulsar};
}
function beginSpecial(s,kind,duration){
  s.specials.push({kind,start:s.time,end:s.time+duration,rung:0,
    direction:rand(s)<.5?1:-1,beamChecked:-1});
  s.events.push({type:'phase-start',kind});
}
function advanceSpecial(s) {
  s.specials=s.specials.filter(p=>s.time+1e-8<p.end);
  // Tick boundaries make both sudden control transitions exact, with no warning event.
  if(s.tick>=14400 && s.darkStage===0){s.darkStage=1;s.events.push({type:'dark-arrival'});}
  if(s.tick>=17100 && s.darkStage===1){s.darkStage=2;s.events.push({type:'breach-start'});}
  if(s.darkStage===1||s.darkStage===2)return;
  if(s.time+1e-8<s.nextSpecial)return;
  if(s.nextSpecial<240){
    // Existing hazards keep their trajectories and lifetime across every phase.
    beginSpecial(s,s.nextKind,45);
    s.nextKind=s.nextKind==='convoy'?'tide':'pulsar';s.nextSpecial+=45;
  }else{
    // After the Resonance Pulse introduce a pair; replace a member every 15 seconds.
    // Keep at most two effects; baseline hazards never depend on this director.
    const count=s.specials.length?1:2;
    for(let i=0;i<count;i++){
      const choices=['convoy','tide','pulsar'].filter(kind=>!s.specials.some(p=>p.kind===kind));
      beginSpecial(s,choices[Math.floor(rand(s)*choices.length)],count===2&&i===0?15:30);
    }
    s.nextSpecial+=15;
  }
}
function staircase(s,p){
  // Three offset slices per ordinary wave form continuous diagonal walls.
  // The radial step (.04) over ~.35 seconds is reachable with boost/release.
  for(let i=0;i<3;i++){
    const rung=p.rung++,phase=rung%14,level=phase<=7?phase:14-phase;
    const safe=.66+(p.direction>0?level:7-level)*.04,angle=2.5+i*.34;
    for(const [side,radius] of [[-1,safe-.15],[1,safe+.15]]){
      const type=(rung+(side>0?1:0))%4===0?'plasma':'rock';
      s.objects.push({type,radius,angle,size:type==='plasma'?.04:.033,
        spin:rand(s)*6.28,shape:Math.floor(rand(s)*10000),checked:false,stair:true});
    }
    s.objects.push({type:'shard',radius:safe,angle,size:.018,spin:0,shape:0,checked:false,stair:true});
  }
  s.wave++;s.nextWave=s.time+1.45;
}
function spawn(s) {
  const weave=s.specials.find(p=>p.kind==='convoy');
  if(weave){staircase(s,weave);return;}
  const difficulty = Math.min(1, s.time / 110);
  // Every wave leaves one broad radial corridor. Adjacent waves are separated
  // in angle/time so changing lanes is possible before the next arrival.
  const safe = s.wave % 4 === 0 ? .65 : .59 + rand(s) * .36;
  const candidates = [.57, .70, .83, 1.01];
  for (const r of candidates) {
    if (Math.abs(r - safe) < .12 || rand(s) > .70 + difficulty * .25) continue;
    const type = s.wave > 4 && s.wave % 5 === 0 ? 'plasma' : 'rock';
    s.objects.push({ id: `${s.wave}-${r}`, type, radius: r, angle: 2.5,
      size: type === 'plasma' ? .046 : .032 + rand(s) * .012,
      spin: rand(s) * 6.28, checked: false, shape: Math.floor(rand(s) * 10000) });
  }
  for (let i = 0; i < 3; i++) s.objects.push({ id: `gem-${s.wave}-${i}`,
    type: 'shard', radius: safe, angle: 2.36 + i * .13, size: .018,
    spin: 0, checked: false, shape: 0 });
  s.wave++;
  s.nextWave = s.time + Math.max(1.25, 2.3 - difficulty * .85);
}
function die(s, cause) { s.alive = false; s.cause = cause; s.events.push({ type: 'death', cause }); }
function spawnCrosser(s) {
  const side=rand(s)<.5?-1:1, x=side*1.45, y=-.28-rand(s)*.88;
  const targetY=-(.56+rand(s)*.46), length=Math.hypot(x,targetY-y);
  const speed=.74+rand(s)*.13+Math.min(.35,(s.time-60)*.002);
  s.crossers.push({type:'crosser',x,y,vx:-x/length*speed,vy:(targetY-y)/length*speed,
    targetY,warning:1.15,age:0,size:.038+rand(s)*.012,spin:rand(s)*6.28,
    shape:Math.floor(rand(s)*10000),checked:false,minDistance:10});
  s.nextCrosser=s.time+Math.max(3.8,6.7-(s.time-60)*.016)+rand(s)*1.6;
  s.events.push({type:'incoming'});
}
// Closest approach over one fixed tick prevents fast crossing hazards tunneling.
function segmentDistance(ax,ay,bx,by) {
  const dx=bx-ax,dy=by-ay,denom=dx*dx+dy*dy;
  const t=denom?clamp(-(ax*dx+ay*dy)/denom,0,1):0;
  return Math.hypot(ax+dx*t,ay+dy*t);
}
export function step(s, input = {}) {
  s.events = [];
  if (!s.alive) return s;
  s.time += DT; s.tick++;
  advanceSpecial(s);
  s.phase = Math.max(0, s.phase - DT);
  if (input.dash && !s.dashHeld && (s.energy >= 100 || resonanceReady(s))) {
    if(resonanceReady(s)){
      s.darkStage=3;s.darkDefeatedAt=s.time;s.attacks=[];
      s.objects=s.objects.filter(o=>o.type!=='resonance');
      s.nextSpecial=s.time+2; // Let the defeat resolve before mixed hazards begin.
      s.events.push({type:'resonance-pulse'});
    }
    s.energy = 0; s.phase = s.events.some(e=>e.type==='resonance-pulse')?2.5:.75; s.velocity = Math.max(s.velocity, .12);
    s.heat = Math.max(0, s.heat - 35); s.events.push({ type: 'dash' });
  }
  s.dashHeld = !!input.dash;
  s.energy = Math.min(100, s.energy + DT * 5);
  const special=specialState(s);
  const gravity = (.46 + Math.max(0, .72 - s.radius) * .32) * special.gravity;
  s.velocity += ((thrustActive(s,input.boost) ? .99 : 0) - gravity - s.velocity * 1.55) * DT;
  s.velocity = clamp(s.velocity, -.34, .34);
  const previousRadius=s.radius;
  s.radius += s.velocity * DT;
  if (s.radius > 1.065) { s.radius = 1.065; s.velocity = Math.min(0, s.velocity); }
  if (s.radius < .465) { die(s, isInverted(s)?'Darkn1de inverted your thrusters. Release boost to climb outward.':'Caught by the event horizon. Boost earlier to escape its pull.'); return s; }
  s.heat = clamp(s.heat + (s.radius < .66 ? ( .66 - s.radius) * 180 + 3 : -25) * DT, 0, 100);
  if (s.heat >= 100) { die(s, 'Your rocket overheated. Climb to the outer orbit to cool down.'); return s; }
  s.comboClock -= DT;
  if (s.comboClock <= 0) s.combo = 0;
  s.multiplier = 1 + clamp((.94 - s.radius) / .45, 0, 1) * 4;
  s.score += DT * (32 + s.time * .10) * s.multiplier * (1 + s.combo * .08);
  if (s.time >= s.nextWave) spawn(s);
  if(s.time>=60&&!s.stormStarted){s.stormStarted=true;s.events.push({type:'storm-start'});}
  if(s.time>=60&&s.time>=s.nextCrosser&&s.crossers.length<2)spawnCrosser(s);
  if(special.beam!==null&&special.pulsar.beamChecked!==special.cycle){
    const priorBeam=special.beam-.08*DT;
    const before=previousRadius-priorBeam, after=s.radius-special.beam;
    if(Math.abs(after)<.046||Math.abs(before)<.046||before*after<0){
      if(s.phase<=0){die(s,'Caught by the pulsar sweep. Climb ahead of the expanding ring or Phase Shift through it.');return s;}
      special.pulsar.beamChecked=special.cycle;
    }
  }
  advanceBreach(s,previousRadius);
  if(!s.alive)return s;
  const angularSpeed = .54 + Math.min(.43, s.time * .0037);
  for (const o of s.objects) {
    o.angle -= (o.speed??angularSpeed) * DT;
    o.spin += DT * .65;
    // Orbital debris and gems keep their original radius during every phase.
    const dx = Math.sin(o.angle) * o.radius;
    const dy = Math.cos(o.angle) * o.radius - s.radius;
    const distance = Math.hypot(dx, dy);
    if (!o.checked && distance < o.size + .028) {
      o.checked = true;
      if (o.type === 'resonance') {
        o.collected=true;s.resonance=Math.min(10,s.resonance+1);
        s.events.push({type:'resonance',radius:o.radius,angle:o.angle});
      } else if (o.type === 'shard') {
        s.energy = Math.min(100, s.energy + 5); s.shards++;
        s.score += 65 * s.multiplier; o.collected = true;
        s.events.push({ type: 'shard', radius: o.radius, angle: o.angle });
      } else if (s.phase <= 0) {
        die(s, o.type === 'plasma' ? 'Hit by a plasma flare. Change orbit or Phase Shift through it.' : 'Hit by orbital debris. Watch the incoming arc and change your altitude.');
        return s;
      } else { s.score += 80; s.events.push({ type: 'phase-through' }); }
    }
    if (!o.checked && o.angle < -.11) {
      o.checked = true;
      if (o.type !== 'shard' && o.type !== 'resonance' && Math.abs(o.radius - s.radius) < o.size + .115) {
        s.nearMisses++; s.combo = Math.min(12, s.combo + 1); s.comboClock = 6;
        s.score += 120 * s.multiplier; s.events.push({ type: 'near', combo: s.combo });
      }
    }
  }
  s.objects = s.objects.filter(o => o.angle > -2.7 && !o.collected);
  for(const o of s.crossers){
    o.age+=DT;
    if(o.warning>0){o.warning=Math.max(0,o.warning-DT);continue;}
    // Centerward acceleration, never aimed at the pilot. The warning interval
    // remains stationary and the existing swept collision check still applies.
    if(special.gravity>1){
      const distance=Math.max(.35,Math.hypot(o.x,o.y));
      o.vx-=o.x/distance*.025*DT;o.vy-=o.y/distance*.025*DT;
      o.tideCaptured=true;
    }
    const oldX=o.x,oldY=o.y;o.x+=o.vx*DT;o.y+=o.vy*DT;o.spin+=DT*2;
    const distance=segmentDistance(oldX,oldY+previousRadius,o.x,o.y+s.radius);
    o.minDistance=Math.min(o.minDistance,distance);
    if(!o.checked&&distance<o.size+.028){
      o.checked=true;
      if(s.phase<=0){die(s,'Hit by an incoming asteroid. Watch the warning line, change altitude, or Phase Shift.');return s;}
      s.score+=100;s.events.push({type:'phase-through'});
    }
    if(!o.checked&&Math.sign(o.vx)*o.x>o.size+.13){
      o.checked=true;
      if(o.minDistance<o.size+.13){s.nearMisses++;s.combo=Math.min(12,s.combo+1);s.comboClock=6;
        s.score+=160*s.multiplier;s.events.push({type:'near',combo:s.combo});}
    }
  }
  s.crossers=s.crossers.filter(o=>o.age<9&&Math.abs(o.x)<1.8&&Math.abs(o.y)<2&&(!o.tideCaptured||Math.hypot(o.x,o.y)>.35));
  return s;
}

// Boss attacks retain their committed aim. No tracking after a telegraph begins.
// Alternation ramps to bounded overlap; replacements continue for missed shards.
function advanceBreach(s,previousRadius){
  if(s.darkStage!==2)return;
  if(s.time+1e-8>=s.nextAttack&&s.attacks.length<9){
    const n=s.attackNumber++,claw=n%2===0;
    const safe=claw?(n%4===0?.66:.92):clamp(s.radius+(s.radius<.8?.19:-.19),.64,.98);
    if(claw){
      for(const [i,radius] of (safe<.8?[.85,.94,1.03]:[.54,.63,.72]).entries())
        s.attacks.push({id:`claw-${n}-${i}`,type:'claw',radius,angle:1.8,size:.036,age:0,warning:.9,checked:false});
    }else{
      const side=n%4===1?1:-1;
      s.attacks.push({id:`spear-${n}`,type:'spear',x:side*1.4,y:-s.radius,
        vx:-side*1.15,vy:0,size:.033,age:0,warning:1.3,checked:false});
    }
    if(s.resonance<10&&s.objects.filter(o=>o.type==='resonance').length<4)
      s.objects.push({id:`resonance-${n}`,type:'resonance',radius:safe,angle:2.4,
        size:.029,spin:0,shape:0,checked:false});
    s.nextAttack=s.time+Math.max(2.6,4.8-(s.time-285)*.025);
  }
  for(const o of s.attacks){
    o.age+=DT;
    if(o.warning>0){o.warning=Math.max(0,o.warning-DT);continue;}
    let distance;
    if(o.type==='claw'){
      const angle=o.angle;o.angle-=.97*DT;
      distance=segmentDistance(Math.sin(angle)*o.radius,previousRadius-Math.cos(angle)*o.radius,
        Math.sin(o.angle)*o.radius,s.radius-Math.cos(o.angle)*o.radius);
    }else{
      const x=o.x,y=o.y;o.x+=o.vx*DT;o.y+=o.vy*DT;
      distance=segmentDistance(x,y+previousRadius,o.x,o.y+s.radius);
    }
    if(!o.checked&&distance<o.size+.028){
      o.checked=true;
      if(s.phase<=0){die(s,o.type==='claw'?'Caught by a rift claw. Fly through the open orbit or Phase Shift.':'Hit by a gravity spear. Move away from its marked path.');return;}
      s.events.push({type:'phase-through'});
    }
  }
  s.attacks=s.attacks.filter(o=>o.age<7&&(o.type==='claw'?o.angle>-.7:Math.abs(o.x)<1.7));
}
