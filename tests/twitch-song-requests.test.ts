import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import {
  IDLE_START_GAP_MS,
  YOUTUBE_EMBED_ORIGIN,
  YOUTUBE_IFRAME_API_SRC,
  blockProblem,
  describePlayerError,
  describeQueueLength,
  formatSongDuration,
  isVideoId,
  moveTarget,
  oneLine,
  planPlayer,
  reorderIds,
  requesterLabel,
  songInputProblem,
  youtubeEmbedSrc,
  type PlayerPlanInput,
} from '../src/features/twitch/song-requests/model.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const dir = new URL('../src/features/twitch/song-requests/', import.meta.url);
const sources = () => readdirSync(dir).filter((name) => /\.(ts|tsx)$/.test(name)).map((name) => [name, read(`src/features/twitch/song-requests/${name}`)] as const);

const VID = 'dQw4w9WgXcQ';

test('formatSongDuration and describeQueueLength', () => {
  assert.equal(formatSongDuration(213), '3:33');
  assert.equal(formatSongDuration(3723), '1:02:03');
  assert.equal(formatSongDuration(0), '0:00');
  assert.equal(formatSongDuration(-5), '0:00');
  assert.equal(formatSongDuration(Number.NaN), '0:00');
  assert.equal(describeQueueLength([{ duration_s: 600 }, { duration_s: 300 }]), '15 min');
  assert.equal(describeQueueLength([{ duration_s: 3600 }, { duration_s: 600 }]), '1 h 10 min');
  assert.equal(describeQueueLength([]), '0 min');
});

test('video ids are exactly 11 URL-safe characters', () => {
  assert.equal(isVideoId(VID), true);
  assert.equal(isVideoId('abc-_DEF123'), true);
  for (const bad of ['', 'short', `${VID}x`, 'abc def ghi', 'abc/def/ghi', '../../etc/x', 'a'.repeat(12), null, undefined, 5]) {
    assert.equal(isVideoId(bad), false, String(bad));
  }
});

test('the embed URL is built from a validated id on the fixed YouTube host only', () => {
  const src = youtubeEmbedSrc(VID, 'https://acosmibot.com');
  assert.ok(src);
  const url = new URL(src);
  assert.equal(url.origin, YOUTUBE_EMBED_ORIGIN);
  assert.equal(url.origin, 'https://www.youtube.com');
  assert.equal(url.pathname, `/embed/${VID}`);
  assert.equal(url.searchParams.get('enablejsapi'), '1');
  assert.equal(url.searchParams.get('origin'), 'https://acosmibot.com');
  for (const hostile of ['https://evil.example/x', `${VID}?autoplay=1`, 'javascript:alert(1)', `${VID}/../x`, '', null]) {
    assert.equal(youtubeEmbedSrc(hostile, 'https://acosmibot.com'), null, String(hostile));
  }
});

test('the IFrame API loader URL is the official one', () => {
  assert.equal(YOUTUBE_IFRAME_API_SRC, 'https://www.youtube.com/iframe_api');
});

test('player error codes skip the song and explain why', () => {
  for (const code of [2, 5, 100, 101, 150, 153, 999]) {
    const view = describePlayerError(code);
    assert.equal(view.skip, true, String(code));
    assert.ok(view.message.length > 10);
  }
  assert.match(describePlayerError(101).message, /embedded players/);
  assert.match(describePlayerError(150).message, /embedded players/);
  assert.match(describePlayerError(100).message, /removed or is private/);
  assert.match(describePlayerError(153).message, /referrer/);
});

const plan = (overrides: Partial<PlayerPlanInput>): ReturnType<typeof planPlayer> => planPlayer({
  armed: true, current: null, queueLength: 0, fallbackPossible: false, loadedRequestId: null, now: 100_000,
  lastIdleStartAt: null, ...overrides,
});
const song = (id: number, source: 'chat' | 'fallback' = 'chat') => ({ id, video_id: VID, source });

test('nothing happens until the player is started by a click', () => {
  assert.deepEqual(plan({ armed: false, current: song(1) }), { kind: 'wait' });
  assert.deepEqual(plan({ armed: false, queueLength: 3 }), { kind: 'wait' });
});

test('a playing song that is not loaded yet is loaded by its video id only', () => {
  assert.deepEqual(plan({ current: song(7) }), { kind: 'load', requestId: 7, videoId: VID });
  assert.deepEqual(plan({ current: song(7), loadedRequestId: 7 }), { kind: 'wait' });
  assert.deepEqual(plan({ current: song(8), loadedRequestId: 7 }), { kind: 'load', requestId: 8, videoId: VID });
});

test('a current song with a malformed video id is never loaded', () => {
  assert.deepEqual(plan({ current: { id: 1, video_id: 'https://evil.example/x', source: 'chat' } }), { kind: 'wait' });
});

test('an idle player asks the bot to start the queue, at most once per gap', () => {
  assert.deepEqual(plan({ queueLength: 2 }), { kind: 'start' });
  assert.deepEqual(plan({ queueLength: 2, lastIdleStartAt: 100_000 - IDLE_START_GAP_MS + 1 }), { kind: 'wait' });
  assert.deepEqual(plan({ queueLength: 2, lastIdleStartAt: 100_000 - IDLE_START_GAP_MS }), { kind: 'start' });
  assert.deepEqual(plan({ fallbackPossible: true }), { kind: 'start' });
  assert.deepEqual(plan({}), { kind: 'wait' });
});

test('a fallback song gives way to a viewer request, but only once it is loaded', () => {
  assert.deepEqual(plan({ current: song(5, 'fallback'), queueLength: 1, loadedRequestId: 5 }), { kind: 'skip_fallback', requestId: 5 });
  assert.deepEqual(plan({ current: song(5, 'fallback'), queueLength: 1, loadedRequestId: null }), { kind: 'load', requestId: 5, videoId: VID });
  assert.deepEqual(plan({ current: song(5, 'fallback'), queueLength: 0, loadedRequestId: 5 }), { kind: 'wait' });
  assert.deepEqual(plan({ current: song(5, 'chat'), queueLength: 4, loadedRequestId: 5 }), { kind: 'wait' });
});

test('moveTarget gives the before_id the API expects', () => {
  const items = [{ id: 10 }, { id: 11 }, { id: 12 }];
  assert.deepEqual(moveTarget(items, 12, 'up'), { before_id: 11 });
  assert.deepEqual(moveTarget(items, 12, 'top'), { before_id: 10 });
  assert.equal(moveTarget(items, 10, 'up'), undefined);
  assert.equal(moveTarget(items, 10, 'top'), undefined);
  assert.deepEqual(moveTarget(items, 10, 'down'), { before_id: 12 });
  assert.deepEqual(moveTarget(items, 11, 'down'), { before_id: null });
  assert.equal(moveTarget(items, 12, 'down'), undefined);
  assert.equal(moveTarget(items, 99, 'up'), undefined);
});

test('reorderIds swaps neighbours and ignores moves off the ends', () => {
  assert.deepEqual(reorderIds([1, 2, 3], 1, -1), [2, 1, 3]);
  assert.deepEqual(reorderIds([1, 2, 3], 1, 1), [1, 3, 2]);
  assert.deepEqual(reorderIds([1, 2, 3], 0, -1), [1, 2, 3]);
  assert.deepEqual(reorderIds([1, 2, 3], 2, 1), [1, 2, 3]);
  const original = [1, 2];
  reorderIds(original, 0, 1);
  assert.deepEqual(original, [1, 2]);
});

test('input checks mirror the API', () => {
  assert.match(songInputProblem('   ') ?? '', /Enter a YouTube link/);
  assert.equal(songInputProblem(`https://youtu.be/${VID}`), null);
  assert.match(songInputProblem('x'.repeat(201)) ?? '', /at most 200/);
  assert.equal(blockProblem('term', ' loud '), null);
  assert.match(blockProblem('term', '') ?? '', /Enter a value/);
  assert.match(blockProblem('term', 'x'.repeat(101)) ?? '', /at most 100/);
  assert.equal(blockProblem('channel', `UC${'a'.repeat(22)}`), null);
  assert.match(blockProblem('channel', VID) ?? '', /starts with UC/);
  assert.equal(blockProblem('video', VID), null);
  assert.equal(oneLine('  a\n\tb   c '), 'a b c');
});

test('requesterLabel names the fallback playlist and never leaves a blank', () => {
  assert.equal(requesterLabel({ requested_by_login: 'dj', source: 'chat' }), 'dj');
  assert.equal(requesterLabel({ requested_by_login: null, source: 'fallback' }), 'Fallback playlist');
  assert.equal(requesterLabel({ requested_by_login: null, source: 'chat' }), 'Unknown');
});

// ── Source guards (the player is the risky part) ──────────────────────────

test('the IFrame API script is loaded from the official origin and nowhere else', () => {
  const loaders = sources().filter(([, text]) => /createElement\('script'\)/.test(text));
  assert.deepEqual(loaders.map(([name]) => name), ['youtubePlayer.ts']);
  const text = read('src/features/twitch/song-requests/youtubePlayer.ts');
  assert.match(text, /script\.src = YOUTUBE_IFRAME_API_SRC/);
  const urls = sources().flatMap(([name, body]) => [...body.matchAll(/https?:\/\/[a-z0-9.-]+/gi)].map((match) => [name, match[0]] as const));
  const external = urls.filter(([, url]) => !/^https?:\/\/(www\.youtube\.com|www\.googleapis\.com)$/.test(url) && !/example|acosmibot/.test(url));
  assert.deepEqual(external, []);
});

test('the player iframe is made from a validated id and carries a referrer policy', () => {
  const text = read('src/features/twitch/song-requests/youtubePlayer.ts');
  assert.match(text, /youtubeEmbedSrc\(videoId, window\.location\.origin\)/);
  assert.match(text, /referrerPolicy = 'strict-origin-when-cross-origin'/);
  assert.match(text, /iframe\.allow = 'autoplay; encrypted-media'/);
  assert.match(text, /isVideoId\(videoId\)/);
});

test('no song page renders HTML from data or builds URLs from viewer text', () => {
  for (const [name, text] of sources()) {
    assert.ok(!/dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML|document\.write/.test(text), name);
  }
  const player = read('src/features/twitch/song-requests/PlayerPanel.tsx');
  assert.ok(!/window\.open|location\.href\s*=/.test(player));
});

test('the player reports each song once and names the autoplay gate', () => {
  const text = read('src/features/twitch/song-requests/PlayerPanel.tsx');
  assert.match(text, /reportedRef\.current\.has\(key\)/);
  assert.match(text, /Start player/);
  assert.match(text, /only allows sound after you press a button/);
  assert.match(text, /songsApi\.player\(/);
});

test('the section and the public page are registered with the ids the API uses', () => {
  const section = read('src/features/twitch/song-requests/section.tsx');
  assert.match(section, /id: 'song-requests'/);
  assert.match(section, /minRole: 'moderator'/);
  assert.match(section, /group: 'community'/);
  const publicPage = read('src/features/twitch/song-requests/public.tsx');
  assert.match(publicPage, /id: 'songs'/);
});

test('the endpoints match the spec paths', () => {
  const api = read('src/features/twitch/song-requests/api.ts');
  for (const path of ['/songs/queue', '/songs/queue/${id}', '/songs/queue/clear', '/songs/player', '/songs/history', '/songs/blocklist',
    '/songs/blocklist/${id}', '/songs/fallback', '/songs/fallback/${id}', '/songs/fallback/order']) {
    assert.ok(api.includes(path), path);
  }
  assert.match(api, /\/public\/\$\{encodeURIComponent\(login\)\}\/songs/);
});
