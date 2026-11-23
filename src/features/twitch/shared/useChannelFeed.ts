/**
 * The dashboard's single live-feed poller (§10.6, §11.6).
 *
 * `FeedProvider` is mounted once by `TwitchDashboardShell` per open channel.
 * It long-polls `GET /channels/:id/feed` (first call without a cursor, then
 * `wait=15`), honours `retry_after_ms`, backs off 2 s → 30 s on errors, pauses
 * while the tab is hidden, and hands every envelope to the subscribers
 * registered through `useFeedEvents`. A `config.changed` event refetches the
 * channel's queries except forms a user is currently editing.
 */
import { createContext, createElement, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { FeedEnvelope } from '../types';
import { TwitchApiError, channelPath, twitchApi } from './api';

interface FeedResponse {
  success: true;
  cursor: string;
  events: FeedEnvelope[];
  retry_after_ms: number;
}

type FeedHandler = (event: FeedEnvelope) => void;

interface FeedContextValue {
  channelId: string;
  subscribe: (types: string[], handler: FeedHandler) => () => void;
  /** Keep a query out of `config.changed` refetches while it backs a dirty form. */
  protect: (queryKey: QueryKey) => () => void;
}

const FeedContext = createContext<FeedContextValue | null>(null);

const MAX_BACKOFF_MS = 30_000;
const FIRST_BACKOFF_MS = 2_000;
const REQUEST_TIMEOUT_MS = 25_000;
const MIN_EMPTY_INTERVAL_MS = 1_000;

/**
 * `types` entries match exactly (`giveaway.update`), by prefix when they end
 * with `.` or `*` (`activity.`, `song.*`). An empty list matches everything.
 */
export const matchesFeedType = (types: readonly string[], type: string): boolean =>
  types.length === 0 || types.some((entry) => {
    if (entry === type) return true;
    if (entry.endsWith('*')) return type.startsWith(entry.slice(0, -1));
    if (entry.endsWith('.')) return type.startsWith(entry);
    return false;
  });

const abortableSleep = (ms: number, signal: AbortSignal): Promise<void> => new Promise((resolve) => {
  if (signal.aborted) return resolve();
  const timer = setTimeout(done, ms);
  function done() {
    clearTimeout(timer);
    signal.removeEventListener('abort', done);
    resolve();
  }
  signal.addEventListener('abort', done, { once: true });
});

const untilVisible = (signal: AbortSignal): Promise<void> => new Promise((resolve) => {
  if (typeof document === 'undefined' || document.visibilityState === 'visible' || signal.aborted) return resolve();
  const check = () => {
    if (document.visibilityState !== 'visible' && !signal.aborted) return;
    document.removeEventListener('visibilitychange', check);
    signal.removeEventListener('abort', check);
    resolve();
  };
  document.addEventListener('visibilitychange', check);
  signal.addEventListener('abort', check, { once: true });
});

export function FeedProvider({ channelId, children }: { channelId: string; children?: ReactNode }) {
  const queryClient = useQueryClient();
  const subscribers = useRef(new Set<{ types: string[]; handler: FeedHandler }>());
  const protectedKeys = useRef(new Map<string, number>());

  useEffect(() => {
    const stop = new AbortController();
    let cursor: string | null = null;
    let backoff = 0;

    const refetchChannelQueries = () => {
      void queryClient.invalidateQueries({
        queryKey: ['twitch', channelId],
        predicate: (query) => !protectedKeys.current.has(JSON.stringify(query.queryKey)),
      });
    };

    const dispatch = (events: FeedEnvelope[]) => {
      for (const event of events) {
        if (event.type === 'config.changed') refetchChannelQueries();
        for (const subscriber of subscribers.current) {
          if (!matchesFeedType(subscriber.types, event.type)) continue;
          try {
            subscriber.handler(event);
          } catch (error) {
            console.error('Twitch feed subscriber failed', error);
          }
        }
      }
    };

    const loop = async () => {
      while (!stop.signal.aborted) {
        await untilVisible(stop.signal);
        if (stop.signal.aborted) break;

        const params = new URLSearchParams();
        if (cursor) {
          params.set('cursor', cursor);
          params.set('wait', '15');
        } else {
          params.set('wait', '0');
        }

        const request = new AbortController();
        const abortRequest = () => request.abort();
        const timeout = setTimeout(abortRequest, REQUEST_TIMEOUT_MS);
        stop.signal.addEventListener('abort', abortRequest, { once: true });
        const startedAt = Date.now();
        const hadCursor = cursor !== null;

        try {
          const response = await twitchApi.get<FeedResponse>(
            channelPath(channelId, `/feed?${params.toString()}`),
            { signal: request.signal },
          );
          backoff = 0;
          if (typeof response?.cursor === 'string' && response.cursor) cursor = response.cursor;
          const events = Array.isArray(response?.events) ? response.events : [];
          dispatch(events);
          const retryAfter = Number(response?.retry_after_ms) || 0;
          if (retryAfter > 0) {
            await abortableSleep(retryAfter, stop.signal);
          } else if (hadCursor && events.length === 0 && Date.now() - startedAt < MIN_EMPTY_INTERVAL_MS) {
            // A server that answers an empty long poll instantly must not turn into a hot loop.
            await abortableSleep(MIN_EMPTY_INTERVAL_MS, stop.signal);
          }
        } catch (error) {
          if (stop.signal.aborted) break;
          // Signed out: the store has already switched to anonymous and the shell will unmount.
          if (error instanceof TwitchApiError && error.status === 401) break;
          backoff = error instanceof TwitchApiError && (error.status === 403 || error.status === 404)
            ? MAX_BACKOFF_MS
            : backoff ? Math.min(backoff * 2, MAX_BACKOFF_MS) : FIRST_BACKOFF_MS;
          await abortableSleep(backoff, stop.signal);
        } finally {
          clearTimeout(timeout);
          stop.signal.removeEventListener('abort', abortRequest);
        }
      }
    };

    void loop();
    return () => stop.abort();
  }, [channelId, queryClient]);

  const value = useMemo<FeedContextValue>(() => ({
    channelId,
    subscribe: (types, handler) => {
      const entry = { types, handler };
      subscribers.current.add(entry);
      return () => { subscribers.current.delete(entry); };
    },
    protect: (queryKey) => {
      const id = JSON.stringify(queryKey);
      protectedKeys.current.set(id, (protectedKeys.current.get(id) ?? 0) + 1);
      return () => {
        const count = (protectedKeys.current.get(id) ?? 1) - 1;
        if (count <= 0) protectedKeys.current.delete(id);
        else protectedKeys.current.set(id, count);
      };
    },
  }), [channelId]);

  return createElement(FeedContext.Provider, { value }, children);
}

/**
 * Subscribe to live feed events for the open channel, e.g.
 * `useFeedEvents(['giveaway.'], (event) => …)`. The handler may change every
 * render; the subscription follows the latest one. Outside the shell this is a
 * no-op.
 */
export function useFeedEvents<D = Record<string, unknown>>(types: string[], handler: (event: FeedEnvelope<D>) => void): void {
  const context = useContext(FeedContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const typesKey = types.join('|');

  useEffect(() => {
    if (!context) return undefined;
    const list = typesKey ? typesKey.split('|') : [];
    return context.subscribe(list, (event) => handlerRef.current(event as FeedEnvelope<D>));
  }, [context, typesKey]);
}

/** While `active`, `config.changed` does not refetch `queryKey` (used by dirty settings forms). */
export function useProtectFromFeedRefetch(queryKey: QueryKey, active: boolean): void {
  const context = useContext(FeedContext);
  const keyId = JSON.stringify(queryKey);

  useEffect(() => {
    if (!context || !active) return undefined;
    return context.protect(JSON.parse(keyId) as QueryKey);
  }, [context, active, keyId]);
}
