/**
 * Twitch sign-in flows and session bootstrap (§11.2, §5.1.3, §10.6).
 *
 * Mirrors `src/lib/auth.ts` for the Discord session without sharing any state:
 * the browser only ever holds the HttpOnly `acosmibot_twitch_session` cookie,
 * starts are full-page navigations to the API, and no token or code is ever
 * placed in a URL by this code.
 *
 * Uses relative `.ts` imports so Node tests can import it.
 */
import { useEffect } from 'react';
import { apiBase } from '../../../lib/runtimeConfig.ts';
import { useTwitchAuthStore, type TwitchMe } from './authStore.ts';

const RETURN_KEY = 'twitchPostLoginRedirect';
const RETURN_TTL_MS = 15 * 60 * 1000;
/** The API accepts only this shape for `?return=` (§5.1.2). */
const RETURN_PATTERN = /^\/twitch(\/[A-Za-z0-9_\-/]*)?$/;
const DEFAULT_RETURN = '/twitch/dashboard';

/** A same-origin `/twitch…` path, or null. Never a query string or another origin. */
export const sanitizeTwitchReturnPath = (path: string | null | undefined): string | null =>
  typeof path === 'string' && RETURN_PATTERN.test(path) ? path : null;

const storage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

const rememberReturnPath = (path: string): void => {
  try {
    storage()?.setItem(RETURN_KEY, JSON.stringify({ path, at: Date.now() }));
  } catch { /* storage may be unavailable */ }
};

export const forgetTwitchReturnPath = (): void => {
  try {
    storage()?.removeItem(RETURN_KEY);
  } catch { /* storage may be unavailable */ }
};

/**
 * Returns (and clears) the page a visitor was on when they started sign-in,
 * if it is recent and valid. The API normally redirects there itself through
 * `?return=`; this is the fallback when it lands on the default destination.
 */
export const takeTwitchReturnPath = (): string | null => {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(RETURN_KEY) ?? null;
  } catch { /* storage may be unavailable */ }
  forgetTwitchReturnPath();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof parsed.at !== 'number' || Date.now() - parsed.at > RETURN_TTL_MS) return null;
    return sanitizeTwitchReturnPath(typeof parsed.path === 'string' ? parsed.path : null);
  } catch {
    return null;
  }
};

const navigateTo = (url: string): void => {
  window.location.href = url;
};

/** Sign in with Twitch, coming back to `returnPath` (default: the current `/twitch` page). */
export const startTwitchLogin = (returnPath?: string): void => {
  const requested = sanitizeTwitchReturnPath(returnPath ?? window.location.pathname);
  // The landing page itself is not a useful destination after signing in.
  const destination = requested && requested !== '/twitch' ? requested : DEFAULT_RETURN;
  rememberReturnPath(destination);
  navigateTo(`${apiBase()}/auth/twitch/login?return=${encodeURIComponent(destination)}`);
};

/** "Add Acosmibot to my channel" (broadcaster consent, §5.1.3 `channel` flow). */
export const startAddChannel = (autoMod: boolean): void => {
  navigateTo(`${apiBase()}/auth/twitch/channel/login?auto_mod=${autoMod ? 1 : 0}`);
};

/** Connect a custom bot account for one channel (§5.1.3 `custom_bot` flow). */
export const startCustomBotLogin = (channelId: string, login: string): void => {
  const params = new URLSearchParams({ channel_id: channelId, login: login.trim().toLowerCase() });
  navigateTo(`${apiBase()}/auth/twitch/custom-bot/login?${params.toString()}`);
};

let refreshPromise: Promise<boolean> | null = null;

const parseMe = (body: unknown): TwitchMe | null => {
  if (!body || typeof body !== 'object') return null;
  const value = body as Partial<TwitchMe>;
  if (!value.user || typeof value.user.twitch_user_id !== 'string') return null;
  return {
    user: value.user,
    channels: Array.isArray(value.channels) ? value.channels : [],
    own_channel: value.own_channel ?? { broadcaster_id: value.user.twitch_user_id, onboarded: false },
  };
};

/**
 * `GET /auth/twitch/me`, deduplicated. Same failure rules as the Discord
 * session: only a 401 signs the visitor out; a temporary API or network
 * failure keeps an already signed-in workspace mounted.
 */
export const refreshTwitchSession = (): Promise<boolean> => {
  if (refreshPromise) return refreshPromise;

  const { setChecking, setMe, setAnonymous } = useTwitchAuthStore.getState();
  const existing = useTwitchAuthStore.getState().me;
  const keepExisting = (): boolean => {
    if (!existing) {
      setAnonymous();
      return false;
    }
    setMe(existing);
    return true;
  };

  setChecking();
  refreshPromise = fetch(`${apiBase()}/auth/twitch/me`, { credentials: 'include' })
    .then(async (response) => {
      if (response.status === 401) {
        setAnonymous();
        return false;
      }
      if (!response.ok) return keepExisting();
      const me = parseMe(await response.json().catch(() => null));
      if (!me) return keepExisting();
      setMe(me);
      return true;
    })
    .catch(keepExisting)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
};

/** `POST /auth/twitch/logout`. Throws when the API refuses, so the caller can say so. */
export const twitchLogout = async (): Promise<void> => {
  const response = await fetch(`${apiBase()}/auth/twitch/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  // 401 means the session was already gone, which is the outcome we wanted.
  if (!response.ok && response.status !== 401) {
    throw new Error('Acosmibot could not sign you out of Twitch. Try again.');
  }
  forgetTwitchReturnPath();
  useTwitchAuthStore.getState().setAnonymous();
};

/** Mounted once by `TwitchRoot`: checks the session on mount, focus and when the tab becomes visible. */
export function TwitchAuthBootstrap(): null {
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshTwitchSession();
    };
    void refreshTwitchSession();
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);
  return null;
}
