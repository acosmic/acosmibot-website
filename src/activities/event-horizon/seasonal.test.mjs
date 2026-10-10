import test from 'node:test';
import assert from 'node:assert/strict';
import { SEASONS, availableSeason, readSeason, saveSeason, drawSeasonalObject, seasonalCopy, seasonEnabled, seasonTheme, hazardAura, hazardRotation, ambientPose, paintBackdrop } from './seasonal.mjs';
import { drawSeasonBit, seasonBitCount, drawAmbient, AMBIENT_VARIANTS } from './seasonal-art.mjs';
import { SCORES } from './audio.mjs';

const gradient={addColorStop(){}};
const fakeContext=()=>new Proxy({}, {get:(_,key)=>key.startsWith('create')?()=>gradient:()=>{}});
const themed=['halloween','thanksgiving','christmas'];

test('preview and invalid themes cannot be enabled through persisted preferences',()=>{
  for(const id of ['thanksgiving','christmas','unknown',null])assert.equal(availableSeason(id),'classic');
  const storage={getItem:()=> 'halloween',setItem(key,value){this.saved=[key,value];}};
  assert.equal(readSeason(storage),'halloween');assert.equal(saveSeason(storage,'christmas'),'classic');
  assert.deepEqual(storage.saved,['eh-season','classic']);
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
  assert.equal(readSeason(denied),'classic');assert.equal(saveSeason(denied,'halloween'),'halloween');
});
test('a release build offers Classic and Halloween; a preview build offers every season',()=>{
  assert.deepEqual(SEASONS.filter(s=>seasonEnabled(s)).map(s=>s.id),['classic','halloween']);
  assert.deepEqual(SEASONS.filter(s=>seasonEnabled(s,true)).map(s=>s.id),['classic','halloween','thanksgiving','christmas']);
  for(const id of ['thanksgiving','christmas'])assert.equal(availableSeason(id,true),id);
  assert.equal(availableSeason('unknown',true),'classic');
  const storage={getItem:()=> 'christmas',setItem(key,value){this.saved=[key,value];}};
  assert.equal(readSeason(storage,true),'christmas');assert.equal(readSeason(storage),'classic');
  assert.equal(saveSeason(storage,'thanksgiving',true),'thanksgiving');assert.deepEqual(storage.saved,['eh-season','thanksgiving']);
});
test('seasonal rendering handles only hazards and never changes their replay state',()=>{
  const ctx=fakeContext();
  for(const type of ['rock','plasma','crosser','shard','resonance'])for(const shape of [0,1,2,3,9999]){
    const object=Object.freeze({type,shape,size:.03,angle:.2,radius:.8,spin:1.4});
    for(const season of themed)assert.equal(drawSeasonalObject(ctx,object,12,season),['rock','plasma','crosser'].includes(type));
    assert.equal(drawSeasonalObject(ctx,object,12,'classic'),false);
  }
});
test('every season defines the full palette the renderer and game read',()=>{
  const keys=Object.keys(seasonTheme('classic')).sort();
  for(const {id} of SEASONS){
    const theme=seasonTheme(id);
    assert.deepEqual(Object.keys(theme).sort(),keys);assert.equal(theme.id,id);
    assert.equal(theme.bits,seasonBitCount(id));assert.equal(theme.nebula.length,2);assert.equal(theme.disk.length,3);
    assert.ok(SCORES[id],`${id} has a score`);assert.equal(SCORES[id].notes.length,7);
    paintBackdrop(fakeContext(),300,200,id);
  }
  assert.equal(seasonTheme('unknown'),seasonTheme('classic'));
});
test('debris bits and ambient drifters draw for each themed season',()=>{
  const ctx=fakeContext();
  for(const season of themed){
    for(let i=0;i<seasonBitCount(season);i++)drawSeasonBit(ctx,season,i,24);
    const {kind,count}=seasonTheme(season).ambient;
    for(let i=0;i<AMBIENT_VARIANTS[kind];i++)drawAmbient(ctx,kind,i,32);
    for(let i=0;i<count;i++)for(const t of [0,7.5,600]){
      const pose=ambientPose(kind,i,t,800,600);
      assert.deepEqual(pose,ambientPose(kind,i,t,800,600));
      assert.ok(pose.x>=-60&&pose.x<=860&&pose.y>=-60&&pose.y<=660,`${kind} ${i} stays near the screen`);
      assert.ok(pose.size>0&&pose.alpha>0&&pose.alpha<=1);
    }
  }
  assert.equal(seasonBitCount('classic'),0);assert.equal(seasonTheme('classic').ambient,null);
});
test('faces, bulbs, and turkeys rock upright while other hazards keep their spin',()=>{
  const plasma={type:'plasma',spin:40,shape:2},rock={type:'rock',spin:40,shape:2};
  for(const season of ['halloween','christmas'])assert.ok(Math.abs(hazardRotation(plasma,season))<=.3);
  assert.ok(Math.abs(hazardRotation(rock,'thanksgiving'))<=.3);
  assert.equal(hazardRotation(plasma,'classic'),40);assert.equal(hazardRotation(plasma,'thanksgiving'),40);
  for(const season of ['classic','halloween','christmas'])assert.equal(hazardRotation(rock,season),40);
  assert.equal(hazardAura(plasma,'classic'),0xff4f7d);assert.equal(hazardAura(plasma,'halloween'),0xff9b36);
  assert.notEqual(hazardAura({type:'plasma',shape:0},'christmas'),hazardAura({type:'plasma',shape:1},'christmas'));
});
test('seasonal labels work both as whole titles and split renderer words',()=>{
  assert.equal(seasonalCopy('ASTEROID STORM','halloween'),'CANDY STORM');
  assert.equal(seasonalCopy('ASTEROID','halloween'),'CANDY');
  assert.equal(seasonalCopy('ASTEROID STORM','classic'),'ASTEROID STORM');
  assert.equal(seasonalCopy('ASTEROID STORM','thanksgiving'),'PIE STORM');
  assert.equal(seasonalCopy('ASTEROID STORM','christmas'),'PRESENT STORM');
  assert.equal(seasonalCopy('Hit by orbital debris. Watch the incoming arc and change your altitude.','christmas'),'Hit by a snowball. Watch the incoming arc and change your altitude.');
  assert.equal(seasonalCopy('Hit by a plasma flare. Change orbit or Phase Shift through it.','thanksgiving'),'Hit by a gravy flare. Change orbit or Phase Shift through it.');
  assert.equal(seasonalCopy('GRAVITY TIDE','christmas'),'GRAVITY TIDE');
});
