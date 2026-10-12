import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { trackEvent } from '@/lib/analytics';
import { apiBase } from '@/lib/runtimeConfig';

export { apiBase } from '@/lib/runtimeConfig';

/**
 * Kick off Discord OAuth, remembering the current page so the OAuth callback
 * (see `AuthCallback` in App.tsx) can return the user here instead of the
 * default server selector.
 */
export const startLogin = (): void => {
  try {
    // Persist only a same-origin path. Query strings can contain identifiers or
    // callback credentials and are never needed to restore the intended page.
    localStorage.setItem('postLoginRedirect', window.location.pathname);
  } catch { /* ignore storage errors */ }
  trackEvent('login_start', { method: 'discord' });
  window.location.href = `${apiBase()}/auth/login`;
};

let refreshPromise: Promise<boolean> | null = null;

/** Clear the visible identity as soon as the API rejects the browser session. */
export const clearExpiredSession = (): void => {
  useAuthStore.getState().setAnonymous();
};

/** Refresh browser-session state without exposing the HttpOnly credential. */
export const refreshSession = (): Promise<boolean> => {
  if (refreshPromise) return refreshPromise;

  const { setChecking, setUser, setAnonymous } = useAuthStore.getState();
  const existingUser = useAuthStore.getState().user;
  const keepExistingSession = (): boolean => {
    if (!existingUser) {
      setAnonymous();
      return false;
    }
    setUser(existingUser);
    return true;
  };

  setChecking();
  refreshPromise = fetch(`${apiBase()}/auth/me`, { credentials: 'include' })
    .then(async (response) => {
      if (response.status === 401) {
        setAnonymous();
        return false;
      }
      // A temporary API or network failure is not proof that the HttpOnly
      // session expired. Preserve an already authenticated workspace so a
      // background check cannot destroy an in-progress form.
      if (!response.ok) return keepExistingSession();
      setUser(await response.json());
      return true;
    })
    .catch(keepExistingSession)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
};

export const endSession = async (): Promise<void> => {
  const response = await fetch(`${apiBase()}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('The server could not end this session.');
  useAuthStore.getState().logout();
};

/** Mount once near the application root to discover an existing cookie session. */
export function AuthSessionBootstrap(): null {
  useEffect(() => {
    // A tab can remain open beyond the cookie's 24-hour lifetime. Revalidate
    // when the user returns so the navbar cannot keep showing a stale avatar.
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshSession();
    };
    // Presence is first-party operational telemetry. Hidden tabs do not report
    // activity, and no browsing path or third-party analytics is involved.
    const reportPresence = () => {
      if (document.visibilityState !== 'visible' || !useAuthStore.getState().isAuthenticated) return;
      void fetch(`${apiBase()}/auth/presence`, { method: 'POST', credentials: 'include' })
        .then(response => { if (response.status === 401) clearExpiredSession(); })
        .catch(() => { /* Presence outages must not interrupt the website. */ });
    };
    void refreshSession().then(reportPresence);
    const presenceTimer = window.setInterval(reportPresence, 60_000);
    document.addEventListener('visibilitychange', reportPresence);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(presenceTimer);
      document.removeEventListener('visibilitychange', reportPresence);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);
  return null;
}

/**
 * Ensure the auth-store has checked the HttpOnly browser session. Components
 * may call this defensively; requests are deduplicated by `refreshSession`.
 */
export function useHydrateAuthUser(): void {
  const user = useAuthStore((s) => s.user);
  const isAuthReady = useAuthStore((s) => s.isAuthReady);

  useEffect(() => {
    if (isAuthReady || user) return;
    void refreshSession();
  }, [isAuthReady, user]);
}
