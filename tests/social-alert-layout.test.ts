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

test('social alert avatars load private-safe HTTPS images with a resilient fallback', () => {
  assert.match(shared, /\^https:\\\/\\\//);
  assert.match(shared, /loading="lazy"/);
  assert.match(shared, /decoding="async"/);
  assert.match(shared, /referrerPolicy="no-referrer"/);
  assert.match(shared, /onError=\{\(\) => setFailedSrc\(safeSrc\)\}/);
  assert.match(xAlerts, /<SocialAlertAvatar/);
  assert.match(streaming, /<SocialAlertAvatar/);
});

test('streaming hydrates provider avatars and reuses successful validation responses', () => {
  assert.match(streamingApi, /profile_image_url\?: string \| null/);
  assert.match(streamingApi, /result\?\.channel_info\?\.thumbnail_url/);
  assert.match(streaming, /const profileQueries = useQueries/);
  assert.match(streaming, /streamerProfileQueryKey\(platform, streamer\.username\)/);
  assert.match(streaming, /queryClient\.setQueryData<StreamerValidationResult>/);
  assert.match(streaming, /getStreamerProfileImage\(profileQueries\[index\]\?\.data\)/);
});

test('legacy streaming records normalize to enabled and verified without losing saved settings', () => {
  assert.match(streamingApi, /enabled: streamer\.enabled !== false/);
  assert.match(streamingApi, /isValid: streamer\.isValid !== false && Boolean\(username\)/);
  assert.match(streamingApi, /mention_role_ids: Array\.isArray/);

  const normalizeStart = streamingApi.indexOf('const normalizeStreamers');
  const normalizeEnd = streamingApi.indexOf('export const streamingApi');
  assert.ok(normalizeStart >= 0 && normalizeEnd > normalizeStart);
  assert.doesNotMatch(streamingApi.slice(normalizeStart, normalizeEnd), /profile_image_url/);
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
