import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const slotSets = await readFile(new URL('../src/features/games/slotSets.ts', import.meta.url), 'utf8');
const slotsSection = await readFile(new URL('../src/features/games/SlotsSection.tsx', import.meta.url), 'utf8');
const featureTypes = await readFile(new URL('../src/types/features.ts', import.meta.url), 'utf8');

const SLOT_NAMES = [
  'sl_coin', 'sl_chip', 'sl_battery', 'sl_gear', 'sl_core', 'sl_satellite',
  'sl_mug', 'sl_heart', 'sl_bolt', 'sl_star', 'sl_gem', 'sl_darkn1de', 'sl_portal',
];

test('Acosmibot is the canonical first and active slot set', () => {
  assert.match(slotSets, /ACOSMIBOT_SLOT_SET_ID = 'acosmibot'/);
  assert.match(slotSets, /symbol_sets = \[createAcosmibotSlotSet\(\), \.\.\.customSets\]/);
  assert.match(slotSets, /active_set_id.*ACOSMIBOT_SLOT_SET_ID/s);
  assert.match(featureTypes, /active_set_id: string/);
  assert.match(featureTypes, /symbol_sets: SlotSymbolSet\[\]/);
});

test('the website catalog declares and ships every application slot asset', async () => {
  for (const name of SLOT_NAMES) {
    assert.match(slotSets, new RegExp(`catalog\\('${name}'`));
    await access(new URL(`../public/images/slots/acosmibot/${name}.png`, import.meta.url));
  }
});

test('slot set controls cover create, activate, duplicate, rename, and guarded delete', () => {
  assert.match(slotsSection, />\s*New set\s*</);
  assert.match(slotsSection, />\s*Use this set\s*</);
  assert.match(slotsSection, />\s*Duplicate\s*</);
  assert.match(slotsSection, /Set name/);
  assert.match(slotsSection, /Confirm delete/);
  assert.match(slotsSection, /Protected core set/);
});

test('custom sets can reuse the bot-owned Acosmibot symbols', () => {
  assert.match(slotsSection, /applicationEmojis=\{ACOSMIBOT_SLOT_CATALOG\}/);
  assert.match(slotSets, /common: 6/);
  assert.match(slotSets, /legendary: \['app:sl_darkn1de'\]/);
  assert.match(slotSets, /scatter: \['app:sl_portal'\]/);
});
