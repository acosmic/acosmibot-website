import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

const [shared, sharedCss, streaming, streamingApi, xAlerts] = await Promise.all([
  readSource('../src/components/ui/SocialAlertsLayout.tsx'),
  readSource('../src/components/ui/SocialAlertsLayout.css'),
  readSource('../src/features/streaming/StreamPlatformFeature.tsx'),
  readSource('../src/api/streaming.ts'),
  readSource('../src/features/x-alerts/XAlertsPage.tsx'),
]);

test('X and streaming alerts consume the same operational layout primitives', () => {
  for (const source of [xAlerts, streaming]) {
    assert.match(source, /SocialAlertsTelemetry/);
    assert.match(source, /SocialAlertsPanel/);
    assert.match(source, /SocialAlertsAdd/);
    assert.match(source, /SocialAlertRecord/);
    assert.match(source, /SocialAlertsNotice/);
  }

  assert.match(sharedCss, /\.social-alerts-grid/);
  assert.match(sharedCss, /\.social-alerts-record__state\.is-active/);
  assert.match(sharedCss, /@media \(max-width: 720px\)/);
});

test('shared records expose literal state and an accessible pause switch', () => {
  assert.match(shared, /type SocialAlertState = 'active' \| 'ready' \| 'paused' \| 'suspended' \| 'unverified'/);
  assert.match(shared, /role="switch"/);
  assert.match(shared, /toggleLabel/);
  assert.match(streaming, /onEnabledChange=\{\(enabled\) => updateStreamer\(index, \{ enabled \}\)\}/);
});

test('legacy streaming records normalize to enabled and verified without losing saved settings', () => {
  assert.match(streamingApi, /enabled: streamer\.enabled !== false/);
  assert.match(streamingApi, /isValid: streamer\.isValid !== false && Boolean\(username\)/);
  assert.match(streamingApi, /mention_role_ids: Array\.isArray/);
});

test('streaming validates new creators before adding and blocks incomplete saves', () => {
  assert.match(streaming, /await streamingApi\.validateStreamer\(platform, candidate\)/);
  assert.match(streaming, /enabled: true/);
  assert.match(streaming, /Choose a Discord channel before enabling alerts/);
  assert.match(streaming, /Verify every saved/);
  assert.match(streaming, /saveDisabled=\{Boolean\(validationMessage\)\}/);
});

test('streaming ignores stale validation after an edit, delete, or discard', () => {
  assert.match(streaming, /const validationRunRef = useRef\(0\)/);
  assert.match(streaming, /validationRunRef\.current !== validationRun/);
  assert.match(streaming, /formRef\.current\?\.tracked_streamers\?\.\[index\]/);
  assert.match(streaming, /validationRunRef\.current \+= 1/);
});
