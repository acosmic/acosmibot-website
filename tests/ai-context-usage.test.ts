import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contextGroups,
  contextLimitLabel,
  contextPartTokens,
  contextPercent,
  peakContextSpan,
} from '../src/utils/aiContextUsage.ts';

test('reads context parts from stringified span metadata and ignores everything else', () => {
  assert.deepEqual(
    contextPartTokens({ ctx_instructions: '3790', ctx_message: 12, ctx_images: '0', context_limit: '1050000', used: true }),
    { instructions: 3790, message: 12 },
  );
  assert.deepEqual(contextPartTokens(undefined), {});
});

test('groups parts by who wrote them and keeps a fixed order', () => {
  const groups = contextGroups({ tool_results: 100, memory: 50, message: 50, instructions: 200, tool_definitions: 600 });
  assert.deepEqual(groups.map(group => [group.key, group.tokens, group.share]), [
    ['instructions', 200, 0.2],
    ['tool_definitions', 600, 0.6],
    ['conversation', 100, 0.1],
    ['tool_activity', 100, 0.1],
  ]);
});

test('a call that recorded no parts has no groups', () => {
  assert.deepEqual(contextGroups({}), []);
});

test('the peak span is the one nearest its own window, across models', () => {
  const spans = [
    { name: 'large window', context_share: 0.012 },
    { name: 'no limit', context_share: null },
    { name: 'small window', context_share: 0.09 },
  ];
  assert.equal(peakContextSpan(spans)?.name, 'small window');
  assert.equal(peakContextSpan([{ context_share: null }]), null);
});

test('small shares keep two decimals so calls near 1% stay comparable', () => {
  assert.equal(contextPercent(0.01148), '1.15%');
  assert.equal(contextPercent(0.0013), '0.13%');
  assert.equal(contextPercent(0.25), '25.0%');
  assert.equal(contextPercent(null), '—');
});

test('window sizes keep the precision that tells 1.05M from 1.1M', () => {
  assert.equal(contextLimitLabel(1_050_000), '1.05M');
  assert.equal(contextLimitLabel(128_000), '128K');
});
