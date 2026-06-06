import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';

/** Base URL for the API, from the injected runtime config (falls back to prod). */
export const apiBase = (): string =>
  (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';

/**
 * Kick off Discord OAuth, remembering the current page so the OAuth callback
 * (see `AuthCallback` in App.tsx) can return the user here instead of the
 * default server selector.
 */
export const startLogin = (): void => {
  try {
    localStorage.setItem('postLoginRedirect', window.location.pathname + window.location.search);
  } catch { /* ignore storage errors */ }
  window.location.href = `${apiBase()}/auth/login`;
};

/**
 * Hydrate the auth-store `user` from `/auth/me` when we have a token but no
 * user object yet. The profile and settings routes aren't wrapped in
 * `DashboardShell` (the only other place that hydrates), so without this the
 * owner can't be told apart from a visitor.
 */
export function useHydrateAuthUser(): void {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    if (!token || user) return;
    fetch(`${apiBase()}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setUser(data); })
      .catch(() => { /* non-fatal */ });
  }, [token, user, setUser]);
}
