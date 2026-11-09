import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { channelIdOrNull } from '../src/features/games/eventHorizonSettings.ts';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('stored channel ids are kept only as snowflake strings', () => {
  assert.equal(channelIdOrNull('123456789012345678'), '123456789012345678');
  assert.equal(channelIdOrNull(' 123456789012345678 '), '123456789012345678');
  for (const bad of [null, undefined, '', 'general', '12', true, {}]) assert.equal(channelIdOrNull(bad), null);
});

test('the dashboard prize ladder mirrors the core constants that pay it', async () => {
  const section = await read('../src/features/games/EventHorizonSection.tsx');
  const dao = await read('../../acosmibot-core/acosmibot_core/dao/event_horizon_dao.py').catch(() => null);
  assert.match(section, /const DAILY_PRIZES = \[250_000, 150_000, 100_000, 60_000, 40_000\];/);
  assert.match(section, /const FULL_PILOTS = 5;/);
  if (dao) {
    assert.match(dao, /DAILY_PRIZES = \(250_000, 150_000, 100_000, 60_000, 40_000\)/);
    assert.match(dao, /DAILY_PRIZE_FULL_PILOTS = 5\b/);
  }
});

test('Event Horizon results settings save with the Games page but outside its master switch', async () => {
  const page = await read('../src/features/games/GamesPage.tsx');
  const hook = await read('../src/features/games/useGamesConfig.ts');
  assert.match(hook, /event_horizon: cfg\.event_horizon,/);
  assert.match(page, /validateEventHorizon\(form\.event_horizon\)/);
  // The dimmed master-switch wrapper closes before the Event Horizon section opens.
  assert.ok(page.indexOf('title="Keno"') < page.indexOf('title="Event Horizon"'));
  assert.ok(page.lastIndexOf("pointerEvents: masterOff") < page.indexOf('title="Event Horizon"'));
});
