import { useAuthStore } from '@/store/auth';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token;
  
  const response = await fetch(path, {
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
