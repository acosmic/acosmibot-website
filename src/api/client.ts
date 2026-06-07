import { useAuthStore } from '@/store/auth';

const getApiBase = (): string =>
  (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token;
  const url = path.startsWith('http') ? path : `${getApiBase()}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    // The API is inconsistent about the field name: most endpoints return the
    // human-readable reason under `error`, some under `message`. Prefer whichever
    // is present so callers (and users) see the real reason, not "API error 400".
    const reason = body.error ?? body.message;
    throw new Error(reason ?? `API error ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = { fetch: apiFetch };
