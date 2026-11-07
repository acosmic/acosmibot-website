import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,DT} from './sim.mjs';

test('seed and identical inputs reproduce a run',()=>{
  const a=createRun(918),b=createRun(918);
  for(let i=0;i<1800;i++){const input={boost:i%90<40,dash:i===130};step(a,input);step(b,input);}
  assert.deepEqual(a,b);
});
test('holding boosts, release dives; no-input eventually dies',()=>{
  const a=createRun(2),b=createRun(2);
  for(let i=0;i<60;i++){step(a,{boost:true});step(b);}
  assert.ok(a.radius>.8);assert.ok(b.radius<.8);
  for(let i=0;i<600&&b.alive;i++)step(b);
  assert.equal(b.alive,false);assert.match(b.cause,/horizon/);
});
test('dash consumes charge, cools, and cannot autorepeat while held',()=>{
  const s=createRun();s.heat=70;step(s,{dash:true});
  assert.ok(s.phase>0);assert.ok(s.energy<1);assert.ok(s.heat<36);
  s.energy=100;step(s,{dash:true});assert.equal(s.energy,100);
});
test('Phase Shift never changes pilot motion',()=>{
  for(const boost of [false,true])for(const velocity of [-.2,0,.2]){
    const a=createRun(),b=createRun();a.velocity=b.velocity=velocity;
    step(a,{boost,dash:true});step(b,{boost});
    assert.ok(a.phase>0);assert.equal(a.velocity,b.velocity);assert.equal(a.radius,b.radius);
  }
});
test('shield protects from debris but not the event horizon',()=>{
  const s=createRun();s.objects=[{type:'rock',radius:.8,angle:0,size:.04,spin:0,checked:false}];
  step(s,{dash:true});assert.ok(s.alive);
  s.radius=.46;step(s);assert.equal(s.alive,false);
});
test('unshielded collision ends flight',()=>{
  const s=createRun();s.objects=[{type:'rock',radius:.8,angle:0,size:.04,spin:0,checked:false}];
  step(s);assert.equal(s.alive,false);assert.match(s.cause,/debris/);
});
test('shards increase score and energy once',()=>{
  const s=createRun();s.energy=0;s.objects=[{type:'shard',radius:.8,angle:0,size:.018,spin:0,checked:false}];
  step(s);assert.equal(s.shards,1);assert.ok(s.score>65);assert.equal(s.energy,5+DT*5);
  step(s);assert.equal(s.shards,1);
});
test('inner orbit scores higher and heats up',()=>{
  const a=createRun(),b=createRun();a.radius=.6;b.radius=.95;
  for(let i=0;i<10;i++){step(a);step(b);}
  assert.ok(a.score>b.score*3);assert.ok(a.heat>b.heat);
});
test('dead runs never mutate score or time',()=>{
  const s=createRun();s.alive=false;step(s,{boost:true});assert.equal(s.time,0);assert.equal(s.score,0);
});
test('long seeded flights keep object count bounded',()=>{
  const s=createRun(45);
  for(let i=0;i<60*180;i++){
    // Test harness resets damage only to exercise generation, not a player mode.
    s.alive=true;s.heat=0;s.radius=.8;s.velocity=0;step(s,{boost:true});
    assert.ok(s.objects.length<100);assert.ok(Number.isFinite(s.score));
    assert.ok(s.crossers.length<=2);
  }
  assert.ok(s.time>179);assert.equal(DT,1/60);
});

test('crossing asteroid phase starts at 60 seconds, never before',()=>{
  const s=createRun(30);s.time=59;s.nextWave=Infinity;
  for(let i=0;i<59;i++){s.radius=.8;s.velocity=0;step(s);assert.equal(s.crossers.length,0);}
  for(let i=0;i<3;i++){s.radius=.8;s.velocity=0;step(s);}
  assert.equal(s.stormStarted,true);assert.equal(s.crossers.length,1);
  assert.ok(s.crossers[0].warning>1);assert.ok(Math.hypot(s.crossers[0].x,s.crossers[0].y)>1.065);
});
test('crossing asteroids warn without damage and sweep for collisions',()=>{
  const hazard={type:'crosser',x:.02,y:-.8,vx:-4,vy:0,warning:1,age:0,size:.04,spin:0,checked:false,minDistance:10};
  const s=createRun();s.crossers=[{...hazard}];step(s);assert.ok(s.alive);assert.equal(s.crossers[0].x,.02);
  s.crossers[0].warning=0;step(s);assert.equal(s.alive,false);assert.match(s.cause,/incoming asteroid/);
});
test('phase dash protects against crossing asteroid and awards only once',()=>{
  const s=createRun();s.crossers=[{type:'crosser',x:.01,y:-.8,vx:-1,vy:0,warning:0,age:0,size:.04,spin:0,checked:false,minDistance:10}];
  step(s,{dash:true});assert.ok(s.alive);assert.equal(s.events.filter(e=>e.type==='phase-through').length,1);
  step(s);assert.equal(s.events.filter(e=>e.type==='phase-through').length,0);
});
test('late-game crossing generation remains deterministic',()=>{
  const a=createRun(765),b=createRun(765);
  a.time=b.time=59.9;a.nextWave=b.nextWave=Infinity;
  for(let i=0;i<1200;i++)for(const s of [a,b]){s.alive=true;s.radius=.8;s.velocity=0;step(s);}
  assert.deepEqual(a,b);assert.ok(a.stormStarted);
});

// ---- v11 combos ----
import {comboBonus,comboWindow,RAZOR_GAP,CLOSE_GAP} from './sim.mjs';
// One orbiting hazard about to pass the pilot at the given hull clearance.
function pass(s,gap,type='rock'){
  const size=type==='plasma'?.04:.033;
  s.objects=[{type,radius:s.radius+gap+size,angle:-.105,size,spin:0,shape:0,checked:false}];
  s.nextWave=1e9;s.heat=0;s.radius=.8;s.velocity=0;
  step(s);return s.events;
}
test('near-misses are graded: razor adds two stacks, close adds one, wide adds none',()=>{
  const s=createRun(3);
  assert.deepEqual(pass(s,.04).find(e=>e.type==='near'),{type:'near',combo:2,grade:'razor'});
  assert.deepEqual(pass(s,.07).find(e=>e.type==='near'),{type:'near',combo:3,grade:'close'});
  assert.equal(pass(s,CLOSE_GAP+.01).some(e=>e.type==='near'),false);
  assert.equal(s.combo,3);assert.equal(s.nearMisses,2);
  assert.ok(RAZOR_GAP<CLOSE_GAP);
});
test('following the Debris Field shard line is not a near-miss',()=>{
  // Staircase walls sit .15 from the shard path: rock .117 and plasma .11 of clearance.
  for(const type of ['rock','plasma'])assert.equal(pass(createRun(4),.15-(type==='plasma'?.04:.033),type).some(e=>e.type==='near'),false);
});
test('combos have no cap and add diminishing score',()=>{
  const s=createRun(5);
  for(let i=0;i<30;i++)pass(s,.07);
  assert.equal(s.combo,30);
  assert.equal(comboBonus(12),.96);
  assert.ok(comboBonus(30)>comboBonus(12));
  assert.ok(comboBonus(30)-comboBonus(18)<comboBonus(12)-comboBonus(0));
  for(let c=1;c<200;c++)assert.ok(comboBonus(c)>comboBonus(c-1));
});
test('the combo window tightens as the chain grows, down to three seconds',()=>{
  assert.equal(comboWindow(0),6);assert.ok(comboWindow(20)<comboWindow(10));assert.equal(comboWindow(60),3);assert.equal(comboWindow(500),3);
  const s=createRun(6);pass(s,.07);assert.equal(s.comboClock,comboWindow(1)-DT+DT);
});
test('the instant near-miss bonus grows with the chain',()=>{
  const short=createRun(7),long=createRun(7);
  long.combo=40;long.comboClock=3;
  const before=[short.score,long.score];pass(short,.07);pass(long,.07);
  assert.ok(long.score-before[1]>(short.score-before[0])*1.5);
});
test('an expired chain resets once and reports its length',()=>{
  const s=createRun(8);pass(s,.07);pass(s,.07);
  const lost=[];
  for(let i=0;i<60*7;i++){s.radius=.8;s.velocity=0;s.heat=0;s.objects=[];step(s);lost.push(...s.events.filter(e=>e.type==='combo-lost'));}
  assert.deepEqual(lost,[{type:'combo-lost',combo:2}]);assert.equal(s.combo,0);
});
test('Phase Shift through debris and asteroids extends the chain',()=>{
  const s=createRun();s.objects=[{type:'rock',radius:.8,angle:0,size:.04,spin:0,checked:false}];
  step(s,{dash:true});
  assert.deepEqual(s.events.find(e=>e.type==='graze'),{type:'graze',combo:1});assert.equal(s.nearMisses,0);
  s.crossers=[{type:'crosser',x:.01,y:-s.radius,vx:-1,vy:0,warning:0,age:0,size:.04,spin:0,checked:false,minDistance:10}];
  step(s);assert.equal(s.combo,2);
});
