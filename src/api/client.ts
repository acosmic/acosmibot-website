import { resolveAnalyticsPage, trackEvent } from '@/lib/analytics';
import { clearExpiredSession } from '@/lib/auth';
import { apiBase } from '@/lib/runtimeConfig';

export const getApiBase = (): string => apiBase();

/** A refused request. `message` is the API's reason; `status` and `body` keep the rest (such as a `field` to point at). Its name stays "Error", so `String(error)` reads as before. */
export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(message: string, status: number, body: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${apiBase()}${path}`;

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
    throw new ApiError(reason ?? `API error ${response.status}`, response.status, body && typeof body === 'object' ? body : {});
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
    '/x-alerts',
    '/custom-commands',
    '/embeds',
    '/reaction-roles',
  ].some((segment) => path.includes(segment));
  if (!configRequest || /\/(send|duplicate|cancel)(?:\?|$)/.test(path)) return null;

  const normalizedPage = resolveAnalyticsPage(window.location.pathname).path;
  const feature = normalizedPage.match(/^\/server\/:guild\/([a-z0-9-]+)/)?.[1];
  return feature && feature !== 'feature' ? feature : null;
}

export interface UploadOptions {
  /** Called as the body goes out, with the share sent so far (0 to 1). */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * A multipart upload with progress. fetch() cannot report upload progress, so this uses
 * XMLHttpRequest, with the session cookie sent the same way as `api.fetch`.
 */
function apiUpload<T>(path: string, form: FormData, options: UploadOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${getApiBase()}${path}`;
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.responseType = 'text';
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) options.onProgress?.(Math.min(1, event.loaded / event.total));
    };
    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(xhr.responseText || '{}');
        if (parsed && typeof parsed === 'object') body = parsed;
      } catch {
        /* not JSON: a proxy page, for example */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(1);
        resolve(body as T);
        return;
      }
      if (xhr.status === 401) clearExpiredSession();
      const reason = body.error ?? body.message;
      reject(new ApiError(typeof reason === 'string' ? reason : `API error ${xhr.status}`, xhr.status, body));
    };
    xhr.onerror = () => reject(new TypeError('Failed to fetch'));
    xhr.onabort = () => reject(new DOMException('The upload was cancelled.', 'AbortError'));
    if (options.signal) {
      if (options.signal.aborted) {
        reject(new DOMException('The upload was cancelled.', 'AbortError'));
        return;
      }
      options.signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
    xhr.send(form);
  });
}

export const api = { fetch: apiFetch, upload: apiUpload };
