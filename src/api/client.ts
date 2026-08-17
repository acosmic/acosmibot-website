import { resolveAnalyticsPage, trackEvent } from '@/lib/analytics';
import { clearExpiredSession } from '@/lib/auth';

const getApiBase = (): string =>
  (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${getApiBase()}${path}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const trackedFeature = configFeatureForRequest(path, options?.method);

  if (!response.ok) {
    if (response.status === 401) clearExpiredSession();
    const body = await response.json().catch(() => ({}));
    if (trackedFeature) trackEvent('config_save', { feature: trackedFeature, outcome: 'error' });
    // The API is inconsistent about the field name: most endpoints return the
    // human-readable reason under `error`, some under `message`. Prefer whichever
    // is present so callers (and users) see the real reason, not "API error 400".
    const reason = body.error ?? body.message;
    throw new Error(reason ?? `API error ${response.status}`);
  }

  const body = await response.json() as T;
  if (trackedFeature) trackEvent('config_save', { feature: trackedFeature, outcome: 'success' });
  return body;
}

function configFeatureForRequest(path: string, method = 'GET'): string | null {
  if (!['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) return null;
  const configRequest = [
    '/config-hybrid',
    '/jail/setup',
    '/giveaway-config',
    '/activity-monitor/config',
    '/custom-commands',
    '/embeds',
    '/reaction-roles',
  ].some((segment) => path.includes(segment));
  if (!configRequest || /\/(send|duplicate|cancel)(?:\?|$)/.test(path)) return null;

  const normalizedPage = resolveAnalyticsPage(window.location.pathname).path;
  const feature = normalizedPage.match(/^\/server\/:guild\/([a-z0-9-]+)/)?.[1];
  return feature && feature !== 'feature' ? feature : null;
}

export const api = { fetch: apiFetch };
