import test from 'node:test';
import assert from 'node:assert/strict';
import { availableSeason, readSeason, saveSeason, drawSeasonalObject, seasonalCopy } from './seasonal.mjs';

test('unreleased and invalid themes cannot be enabled through persisted preferences',()=>{
  for(const id of ['thanksgiving','christmas','unknown',null])assert.equal(availableSeason(id),'classic');
  const storage={getItem:()=> 'halloween',setItem(key,value){this.saved=[key,value];}};
  assert.equal(readSeason(storage),'halloween');assert.equal(saveSeason(storage,'christmas'),'classic');
  assert.deepEqual(storage.saved,['eh-season','classic']);
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
  assert.equal(readSeason(denied),'classic');assert.equal(saveSeason(denied,'halloween'),'halloween');
});
test('seasonal rendering handles only hazards and never changes their replay state',()=>{
  const gradient={addColorStop(){}};
  const ctx=new Proxy({}, {get:(_,key)=>key.startsWith('create')?()=>gradient:()=>{}});
  for(const type of ['rock','plasma','crosser','shard','resonance']){
    const object=Object.freeze({type,shape:1,size:.03,angle:.2,radius:.8});
    assert.equal(drawSeasonalObject(ctx,object,12,'halloween'),['rock','plasma','crosser'].includes(type));
    assert.equal(drawSeasonalObject(ctx,object,12,'classic'),false);
  }
});

test('Halloween labels work both as whole titles and split renderer words',()=>{
  assert.equal(seasonalCopy('ASTEROID STORM','halloween'),'CANDY STORM');
  assert.equal(seasonalCopy('ASTEROID','halloween'),'CANDY');
  assert.equal(seasonalCopy('ASTEROID STORM','classic'),'ASTEROID STORM');
});
