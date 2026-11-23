/**
 * Twitch API client (§11.2). Every Twitch endpoint goes through
 * `twitchApi.fetch` so the session rules hold in one place:
 *
 * - cookie credentials (`acosmibot_twitch_session`), JSON headers, base `apiBase()`;
 * - a 401 clears only the Twitch store; the Discord store is never touched;
 * - error bodies `{error, code, details}` (§10.4) become `TwitchApiError`.
 *
 * Pure module (relative `.ts` imports, no React) so Node tests can import it.
 */
import { apiBase } from '../../../lib/runtimeConfig.ts';
import { useTwitchAuthStore } from './authStore.ts';

export class TwitchApiError extends Error {
  /** HTTP status; 0 when the request never reached the API. */
  status: number;
  /** Snake-case code from §10.4, or `http_<status>` / `network_error` / `invalid_response`. */
  code: string;
  details?: unknown;
  /** Seconds from a 429 `Retry-After` header, when present. */
  retryAfterS?: number;

  constructor(status: number, code: string, message: string, details?: unknown, retryAfterS?: number) {
    super(message);
    this.name = 'TwitchApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfterS = retryAfterS;
  }
}

const NETWORK_MESSAGE = 'Acosmibot could not be reached. Check your connection and try again.';

const defaultMessage = (status: number): string => {
  if (status === 401) return 'Your Twitch session has ended. Sign in again to continue.';
  if (status === 403) return 'Your role on this channel does not allow this.';
  if (status === 404) return 'That could not be found. It may have been removed.';
  if (status === 409) return 'This changed somewhere else. Reload and try again.';
  if (status === 413) return 'That is too large to send.';
  if (status === 422) return 'A limit for this channel has been reached.';
  if (status === 429) return 'Too many requests. Wait a moment and try again.';
  if (status >= 500) return 'Acosmibot could not complete this right now. Try again in a moment.';
  return 'The request was not accepted.';
};

const readBody = async (response: Response): Promise<Record<string, unknown> | null> => {
  try {
    const text = await response.text();
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

/** Builds the error for a non-OK response. Exported for tests. */
export function errorFromResponse(response: Response, body: Record<string, unknown> | null): TwitchApiError {
  const reason = typeof body?.error === 'string' && body.error
    ? body.error
    : typeof body?.message === 'string' && body.message ? body.message : defaultMessage(response.status);
  const code = typeof body?.code === 'string' && body.code ? body.code : `http_${response.status}`;
  const retryHeader = Number(response.headers.get('Retry-After'));
  return new TwitchApiError(
    response.status,
    code,
    reason,
    body?.details,
    Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : undefined,
  );
}

async function twitchFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${apiBase()}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...init?.headers,
      },
    });
  } catch (error) {
    // Callers that abort (the feed poller, unmounting pages) see the AbortError.
    if (init?.signal?.aborted) throw error;
    throw new TwitchApiError(0, 'network_error', NETWORK_MESSAGE);
  }

  if (response.status === 401) {
    // Only the Twitch session ends; a Discord session in the same browser stays.
    useTwitchAuthStore.getState().setAnonymous();
  }

  if (!response.ok) throw errorFromResponse(response, await readBody(response));
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new TwitchApiError(response.status, 'invalid_response', 'Acosmibot sent a response this page could not read.');
  }
}

const withBody = (method: string, body?: unknown, init?: RequestInit): RequestInit => ({
  ...init,
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const twitchApi = {
  fetch: twitchFetch,
  get: <T>(path: string, init?: RequestInit) => twitchFetch<T>(path, { ...init, method: 'GET' }),
  post: <T>(path: string, body?: unknown, init?: RequestInit) => twitchFetch<T>(path, withBody('POST', body, init)),
  put: <T>(path: string, body?: unknown, init?: RequestInit) => twitchFetch<T>(path, withBody('PUT', body, init)),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) => twitchFetch<T>(path, withBody('PATCH', body, init)),
  del: <T>(path: string, body?: unknown, init?: RequestInit) => twitchFetch<T>(path, withBody('DELETE', body, init)),
};

/** `/api/twitch-bot/channels/<id><rest>` with the id encoded. */
export const channelPath = (channelId: string, rest = ''): string =>
  `/api/twitch-bot/channels/${encodeURIComponent(channelId)}${rest}`;

export const isTwitchApiError = (error: unknown, code?: string): error is TwitchApiError =>
  error instanceof TwitchApiError && (code === undefined || error.code === code);

/** The sentence to show a person for any thrown value. */
export const twitchErrorMessage = (error: unknown, fallback = 'Something went wrong. Try again.'): string => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

/**
 * TanStack Query `retry` for Twitch queries: never retry client errors (401,
 * 403, 404, 409, 422); retry server and network failures once.
 */
export const twitchRetry = (failureCount: number, error: unknown): boolean => {
  if (error instanceof TwitchApiError && error.status >= 400 && error.status < 500 && error.status !== 408) return false;
  return failureCount < 1;
};
