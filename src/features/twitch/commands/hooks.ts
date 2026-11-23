/** Data hooks of the Commands section. */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SettingsSectionResponse } from '../types';
import { channelPath, twitchApi, twitchRetry } from '../shared/api';
import { settingsKey, tk } from '../shared/queryKeys';
import { commandsApi } from './api';
import type { TemplateIssue } from './model';

export const commandsKey = (channelId: string) => tk(channelId, 'commands', 'custom');
export const defaultCommandsKey = (channelId: string) => tk(channelId, 'commands', 'defaults');
export const regularsKey = (channelId: string) => tk(channelId, 'commands', 'regulars');

/** `value` after it stopped changing for `delayMs`. */
export function useDebounced<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * The server's template check (`POST /commands/validate`) for a response
 * while it is typed: errors block saving, warnings are shown as notes.
 * `key` checks a built-in's response override (500 characters, its extra names).
 */
export function useTemplateIssues(channelId: string, response: string, options: { key?: string; enabled?: boolean } = {}) {
  const text = useDebounced(response);
  const query = useQuery({
    queryKey: tk(channelId, 'commands', 'validate', options.key ?? '', text),
    queryFn: () => commandsApi.validate(channelId, text, options.key),
    enabled: (options.enabled ?? true) && text.trim().length > 0,
    retry: false,
    staleTime: Infinity,
    placeholderData: (previous) => previous,
  });
  const issues: TemplateIssue[] = text.trim() ? query.data?.issues ?? [] : [];
  return { issues, checking: query.isFetching, stale: text !== response };
}

/** The loyalty currency name for cost previews ("points" until known). */
export function useCurrencyName(channelId: string): string {
  const query = useQuery({
    queryKey: settingsKey(channelId, 'loyalty'),
    queryFn: () => twitchApi.get<SettingsSectionResponse<{ currency_name?: string }>>(channelPath(channelId, '/settings/loyalty')),
    retry: twitchRetry,
    staleTime: 5 * 60 * 1000,
  });
  return query.data?.value?.currency_name || 'points';
}
