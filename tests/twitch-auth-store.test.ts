import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { useAuthStore } from '../src/store/auth.ts';
import { useTwitchAuthStore, type TwitchMe } from '../src/features/twitch/shared/authStore.ts';
import {
  refreshTwitchSession,
  sanitizeTwitchReturnPath,
  startAddChannel,
  startTwitchLogin,
  takeTwitchReturnPath,
  twitchLogout,
} from '../src/features/twitch/shared/auth.ts';

const me: TwitchMe = {
  user: { twitch_user_id: '456', login: 'viewer', display_name: 'Viewer', profile_image_url: null },
  channels: [{ broadcaster_id: '123', login: 'streamer', display_name: 'Streamer', profile_image_url: null, status: 'active', role: 'moderator' }],
  own_channel: { broadcaster_id: '456', onboarded: false },
};

const discordUser = { id: '42', username: 'operator', avatar: null, global_name: 'Operator' };

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, String(value)); },
    removeItem: (key: string) => { data.delete(key); },
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() { return data.size; },
  };
};

const originalFetch = globalThis.fetch;
let location: { hostname: string; origin: string; pathname: string; href: string };

beforeEach(() => {
  location = { hostname: 'localhost', origin: 'http://localhost:5173', pathname: '/twitch', href: 'http://localhost:5173/twitch' };
  Object.defineProperty(globalThis, 'window', { value: { location }, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), configurable: true, writable: true });
  useTwitchAuthStore.setState({ me: null, status: 'checking', isReady: false });
  useAuthStore.setState({ user: discordUser, status: 'authenticated', isAuthReady: true, isAuthenticated: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const discordSnapshot = () => {
  const { user, status, isAuthReady, isAuthenticated } = useAuthStore.getState();
  return { user, status, isAuthReady, isAuthenticated };
};
const discordSignedIn = { user: discordUser, status: 'authenticated', isAuthReady: true, isAuthenticated: true };

test('the first Twitch session check holds pages behind the loading gate', () => {
  useTwitchAuthStore.getState().setChecking();
  const state = useTwitchAuthStore.getState();
  assert.equal(state.status, 'checking');
  assert.equal(state.isReady, false);
  assert.equal(state.me, null);
});

test('checking → authenticated → background checking keeps the workspace → anonymous', () => {
  const store = useTwitchAuthStore.getState();
  store.setChecking();
  store.setMe(me);
  assert.equal(useTwitchAuthStore.getState().status, 'authenticated');
  assert.equal(useTwitchAuthStore.getState().isReady, true);
  assert.deepEqual(useTwitchAuthStore.getState().me, me);

  useTwitchAuthStore.getState().setChecking();
  assert.equal(useTwitchAuthStore.getState().status, 'checking');
  assert.equal(useTwitchAuthStore.getState().isReady, true, 'background checks keep readiness');
  assert.deepEqual(useTwitchAuthStore.getState().me, me, 'background checks keep the identity');

  useTwitchAuthStore.getState().setAnonymous();
  assert.equal(useTwitchAuthStore.getState().status, 'anonymous');
  assert.equal(useTwitchAuthStore.getState().isReady, true);
  assert.equal(useTwitchAuthStore.getState().me, null);
});

test('Twitch session transitions never touch the Discord store', () => {
  const store = useTwitchAuthStore.getState();
  store.setChecking();
  store.setMe(me);
  store.setAnonymous();
  assert.deepEqual(discordSnapshot(), discordSignedIn);
  assert.notEqual(useTwitchAuthStore as unknown, useAuthStore as unknown);
});

test('refreshTwitchSession signs in from GET /auth/twitch/me', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ success: true, ...me }), { status: 200 });
  };
  assert.equal(await refreshTwitchSession(), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://localhost:5000/auth/twitch/me');
  assert.equal(calls[0].init?.credentials, 'include');
  assert.deepEqual(useTwitchAuthStore.getState().me, me);
  assert.equal(useTwitchAuthStore.getState().status, 'authenticated');
  assert.deepEqual(discordSnapshot(), discordSignedIn);
});

test('refreshTwitchSession treats only a 401 as signed out', async () => {
  useTwitchAuthStore.getState().setMe(me);
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, code: 'session_expired' }), { status: 401 });
  assert.equal(await refreshTwitchSession(), false);
  assert.equal(useTwitchAuthStore.getState().status, 'anonymous');
  assert.equal(useTwitchAuthStore.getState().me, null);
  assert.deepEqual(discordSnapshot(), discordSignedIn, 'a Twitch 401 leaves the Discord session alone');
});

test('a temporary API or network failure keeps an existing Twitch session', async () => {
  useTwitchAuthStore.getState().setMe(me);
  globalThis.fetch = async () => new Response('unavailable', { status: 503 });
  assert.equal(await refreshTwitchSession(), true);
  assert.deepEqual(useTwitchAuthStore.getState().me, me);

  globalThis.fetch = async () => { throw new TypeError('network down'); };
  assert.equal(await refreshTwitchSession(), true);
  assert.equal(useTwitchAuthStore.getState().status, 'authenticated');
});

test('a failure on the first check resolves to anonymous instead of hanging', async () => {
  globalThis.fetch = async () => { throw new TypeError('network down'); };
  assert.equal(await refreshTwitchSession(), false);
  assert.equal(useTwitchAuthStore.getState().isReady, true);
  assert.equal(useTwitchAuthStore.getState().status, 'anonymous');
});

test('concurrent refreshes share one request', async () => {
  let count = 0;
  let release: (response: Response) => void = () => {};
  globalThis.fetch = () => {
    count += 1;
    return new Promise<Response>((resolve) => { release = resolve; });
  };
  const first = refreshTwitchSession();
  const second = refreshTwitchSession();
  assert.equal(first, second);
  release(new Response(JSON.stringify({ success: true, ...me }), { status: 200 }));
  await first;
  assert.equal(count, 1);
});

test('sign-in keeps the return path same-origin and puts no credentials in the URL', () => {
  location.pathname = '/twitch/c/123/commands';
  startTwitchLogin();
  assert.equal(location.href, 'http://localhost:5000/auth/twitch/login?return=%2Ftwitch%2Fc%2F123%2Fcommands');
  assert.equal(takeTwitchReturnPath(), '/twitch/c/123/commands');
  assert.equal(takeTwitchReturnPath(), null, 'the stored path is used once');

  startTwitchLogin('https://evil.example/twitch');
  assert.equal(location.href, 'http://localhost:5000/auth/twitch/login?return=%2Ftwitch%2Fdashboard');
  startTwitchLogin('/twitch');
  assert.match(location.href, /return=%2Ftwitch%2Fdashboard$/);
  assert.doesNotMatch(location.href, /token|code=|state=/);
});

test('return paths are limited to /twitch pages without query strings', () => {
  assert.equal(sanitizeTwitchReturnPath('/twitch/dashboard'), '/twitch/dashboard');
  assert.equal(sanitizeTwitchReturnPath('/twitch'), '/twitch');
  assert.equal(sanitizeTwitchReturnPath('//evil.example/twitch'), null);
  assert.equal(sanitizeTwitchReturnPath('/servers'), null);
  assert.equal(sanitizeTwitchReturnPath('/twitch/c/1?error=x'), null);
  assert.equal(sanitizeTwitchReturnPath('/twitch-overlay/alerts.html'), null);
});

test('add-channel starts the broadcaster flow with the auto-mod choice', () => {
  startAddChannel(true);
  assert.equal(location.href, 'http://localhost:5000/auth/twitch/channel/login?auto_mod=1');
  startAddChannel(false);
  assert.equal(location.href, 'http://localhost:5000/auth/twitch/channel/login?auto_mod=0');
});

test('Twitch logout clears only the Twitch store', async () => {
  useTwitchAuthStore.getState().setMe(me);
  let request: { url: string; init?: RequestInit } | null = null;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  await twitchLogout();
  assert.equal(request!.url, 'http://localhost:5000/auth/twitch/logout');
  assert.equal(request!.init?.method, 'POST');
  assert.equal(useTwitchAuthStore.getState().me, null);
  assert.deepEqual(discordSnapshot(), discordSignedIn);
});

test('a refused logout keeps the Twitch session and reports it', async () => {
  useTwitchAuthStore.getState().setMe(me);
  globalThis.fetch = async () => new Response('{}', { status: 500 });
  await assert.rejects(twitchLogout(), /could not sign you out/i);
  assert.deepEqual(useTwitchAuthStore.getState().me, me);
});
