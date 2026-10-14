import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  excludePrivateChannels,
  normalizeMemoryExcludedChannels,
  privateChannelsStillLearning,
  toggleMemoryChannel,
} from '../src/features/ai/memoryChannels.ts';

const channels = [
  { id: '1', name: 'general', is_private: false },
  { id: '2', name: 'staff', is_private: true },
  { id: '3', name: 'mods', is_private: true },
  { id: '4', name: 'memes' },
];

test('saved channel ids keep unique snowflake strings', () => {
  assert.deepEqual(normalizeMemoryExcludedChannels(['2', 2, ' 3 ', 'abc', '', null, '2']), ['2', '3']);
  assert.deepEqual(normalizeMemoryExcludedChannels(undefined), []);
  assert.deepEqual(normalizeMemoryExcludedChannels('2'), []);
});

test('only private channels that still learn are suggested', () => {
  assert.deepEqual(privateChannelsStillLearning(channels, []).map(c => c.id), ['2', '3']);
  assert.deepEqual(privateChannelsStillLearning(channels, ['2']).map(c => c.id), ['3']);
  assert.deepEqual(privateChannelsStillLearning(channels, ['2', '3']), []);
});

test('excluding private channels keeps existing choices', () => {
  assert.deepEqual(excludePrivateChannels(channels, ['4']), ['4', '2', '3']);
  assert.deepEqual(excludePrivateChannels(channels, ['3']), ['3', '2']);
});

test('toggling a channel adds or removes it', () => {
  assert.deepEqual(toggleMemoryChannel(['1'], '2'), ['1', '2']);
  assert.deepEqual(toggleMemoryChannel(['1', '2'], '1'), ['2']);
});

test('the AI page shows memory channel controls only while memory is enabled', async () => {
  const page = await readFile(new URL('../src/features/ai/AiPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /\{form\.memory_enabled && \(\s*<AiMemoryChannelsSection/);
  assert.match(page, /excluded=\{form\.memory_excluded_channels\}/);
});
