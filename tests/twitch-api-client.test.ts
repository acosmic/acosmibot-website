import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { useAuthStore } from '../src/store/auth.ts';
import { useTwitchAuthStore } from '../src/features/twitch/shared/authStore.ts';
import {
  TwitchApiError,
  channelPath,
  isTwitchApiError,
  twitchApi,
  twitchErrorMessage,
  twitchRetry,
} from '../src/features/twitch/shared/api.ts';

const discordUser = { id: '42', username: 'operator', avatar: null, global_name: 'Operator' };
const twitchMe = {
  user: { twitch_user_id: '456', login: 'viewer', display_name: 'Viewer', profile_image_url: null },
  channels: [],
  own_channel: { broadcaster_id: '456', onboarded: false },
};

const originalFetch = globalThis.fetch;
type Call = { url: string; init?: RequestInit };
let calls: Call[];

const respondWith = (factory: (call: Call) => Response | Promise<Response>) => {
  globalThis.fetch = async (url, init) => {
    const call = { url: String(url), init };
    calls.push(call);
    return factory(call);
  };
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

beforeEach(() => {
  calls = [];
  Object.defineProperty(globalThis, 'window', {
    value: { location: { hostname: 'localhost', origin: 'http://localhost:5173', pathname: '/twitch/dashboard' } },
    configurable: true,
    writable: true,
  });
  useTwitchAuthStore.setState({ me: twitchMe, status: 'authenticated', isReady: true });
  useAuthStore.setState({ user: discordUser, status: 'authenticated', isAuthReady: true, isAuthenticated: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('requests go to the API base with cookie credentials and JSON headers', async () => {
  respondWith(() => json({ success: true, channels: [], can_add_own_channel: true }));
  const body = await twitchApi.get<{ can_add_own_channel: boolean }>('/api/twitch-bot/channels');
  assert.equal(body.can_add_own_channel, true);
  assert.equal(calls[0].url, 'http://localhost:5000/api/twitch-bot/channels');
  assert.equal(calls[0].init?.credentials, 'include');
  assert.equal(calls[0].init?.method, 'GET');
  assert.equal((calls[0].init?.headers as Record<string, string>)['Content-Type'], 'application/json');
});

test('write helpers send JSON bodies with the right method', async () => {
  respondWith(() => json({ success: true, value: {}, config_version: 4, live_applied: true }));
  await twitchApi.put(channelPath('123', '/settings/loyalty'), { value: { enabled: true }, config_version: 3 });
  assert.equal(calls[0].url, 'http://localhost:5000/api/twitch-bot/channels/123/settings/loyalty');
  assert.equal(calls[0].init?.method, 'PUT');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { value: { enabled: true }, config_version: 3 });

  await twitchApi.del(channelPath('123', '/quotes/7'));
  assert.equal(calls[1].init?.method, 'DELETE');
  assert.equal(calls[1].init?.body, undefined);
});

test('a 401 clears only the Twitch store', async () => {
  respondWith(() => json({ success: false, error: 'Sign in with Twitch to continue.', code: 'session_required' }, 401));
  await assert.rejects(twitchApi.get('/api/twitch-bot/channels'), (error: unknown) => {
    assert.ok(error instanceof TwitchApiError);
    assert.equal(error.status, 401);
    assert.equal(error.code, 'session_required');
    return true;
  });
  assert.equal(useTwitchAuthStore.getState().me, null);
  assert.equal(useTwitchAuthStore.getState().status, 'anonymous');
  const discord = useAuthStore.getState();
  assert.deepEqual(discord.user, discordUser);
  assert.equal(discord.isAuthenticated, true);
  assert.equal(discord.status, 'authenticated');
});

test('other errors keep the Twitch session', async () => {
  respondWith(() => json({ success: false, error: 'Nope.', code: 'forbidden' }, 403));
  await assert.rejects(twitchApi.get(channelPath('123')));
  assert.equal(useTwitchAuthStore.getState().status, 'authenticated');
});

test('error bodies {error, code, details} become TwitchApiError', async () => {
  respondWith(() => json({
    success: false,
    error: 'This needs the editor role.',
    code: 'insufficient_role',
    details: { required: 'editor' },
  }, 403));
  await assert.rejects(twitchApi.put(channelPath('123', '/settings/store'), { value: {}, config_version: 1 }), (error: unknown) => {
    assert.ok(error instanceof TwitchApiError);
    assert.ok(error instanceof Error);
    assert.equal(error.name, 'TwitchApiError');
    assert.equal(error.status, 403);
    assert.equal(error.code, 'insufficient_role');
    assert.equal(error.message, 'This needs the editor role.');
    assert.deepEqual(error.details, { required: 'editor' });
    assert.equal(isTwitchApiError(error, 'insufficient_role'), true);
    assert.equal(isTwitchApiError(error, 'forbidden'), false);
    return true;
  });
});

test('version conflicts and validation details are preserved for forms', async () => {
  respondWith(() => json({ success: false, error: 'Changed elsewhere.', code: 'version_conflict', details: { current_version: 9 } }, 409));
  await assert.rejects(twitchApi.put(channelPath('1', '/settings/timers'), {}), (error: unknown) => {
    assert.ok(isTwitchApiError(error, 'version_conflict'));
    assert.deepEqual(error.details, { current_version: 9 });
    return true;
  });
});

test('non-JSON error bodies fall back to a readable sentence and http_<status>', async () => {
  respondWith(() => new Response('<html>Bad gateway</html>', { status: 502 }));
  await assert.rejects(twitchApi.get('/api/twitch-bot/meta'), (error: unknown) => {
    assert.ok(error instanceof TwitchApiError);
    assert.equal(error.code, 'http_502');
    assert.match(error.message, /could not complete this right now/);
    return true;
  });
});

test('429 responses expose Retry-After seconds', async () => {
  respondWith(() => json({ success: false, error: 'Slow down.', code: 'rate_limited' }, 429, { 'Retry-After': '12' }));
  await assert.rejects(twitchApi.post(channelPath('1', '/chat'), { text: 'hi' }), (error: unknown) => {
    assert.ok(error instanceof TwitchApiError);
    assert.equal(error.code, 'rate_limited');
    assert.equal(error.retryAfterS, 12);
    return true;
  });
});

test('network failures become status 0 network_error; aborts stay aborts', async () => {
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(twitchApi.get('/api/twitch-bot/meta'), (error: unknown) => {
    assert.ok(error instanceof TwitchApiError);
    assert.equal(error.status, 0);
    assert.equal(error.code, 'network_error');
    return true;
  });
  assert.equal(useTwitchAuthStore.getState().status, 'authenticated');

  const controller = new AbortController();
  controller.abort();
  globalThis.fetch = async () => { throw new DOMException('aborted', 'AbortError'); };
  await assert.rejects(twitchApi.get('/api/twitch-bot/meta', { signal: controller.signal }), (error: unknown) => {
    assert.equal((error as Error).name, 'AbortError');
    return true;
  });
});

test('empty and 204 responses resolve to undefined', async () => {
  respondWith(() => new Response(null, { status: 204 }));
  assert.equal(await twitchApi.del(channelPath('1', '/counters/deaths')), undefined);
});

test('twitchRetry never retries client errors and retries server errors once', () => {
  assert.equal(twitchRetry(0, new TwitchApiError(404, 'not_found', 'x')), false);
  assert.equal(twitchRetry(0, new TwitchApiError(403, 'forbidden', 'x')), false);
  assert.equal(twitchRetry(0, new TwitchApiError(503, 'bot_offline', 'x')), true);
  assert.equal(twitchRetry(1, new TwitchApiError(503, 'bot_offline', 'x')), false);
  assert.equal(twitchRetry(0, new TwitchApiError(0, 'network_error', 'x')), true);
});

test('helpers build encoded channel paths and readable messages', () => {
  assert.equal(channelPath('123'), '/api/twitch-bot/channels/123');
  assert.equal(channelPath('12/3', '/status'), '/api/twitch-bot/channels/12%2F3/status');
  assert.equal(twitchErrorMessage(new TwitchApiError(400, 'validation_failed', 'Name is taken.')), 'Name is taken.');
  assert.equal(twitchErrorMessage('weird', 'Fallback.'), 'Fallback.');
});
