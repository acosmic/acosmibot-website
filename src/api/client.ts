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
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message ?? `API error ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = { fetch: apiFetch };
