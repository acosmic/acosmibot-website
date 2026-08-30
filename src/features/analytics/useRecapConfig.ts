import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi } from '@/api/config';

export interface RecapConfig {
  enabled: boolean;
  channel_id: string | null;
  weekday: number;
  post_time: string;
  timezone: string;
  sections: {
    commands: boolean;
    reactions: boolean;
    channels: boolean;
    members: boolean;
    ai: boolean;
    social_embeds: boolean;
  };
}

const DEFAULT_RECAP: RecapConfig = {
  enabled: false,
  channel_id: null,
  weekday: 0,
  post_time: '17:00',
  timezone: 'UTC',
  sections: {
    commands: true,
    reactions: true,
    channels: true,
    members: false,
    ai: true,
    social_embeds: false,
  },
};

/**
 * Weekly Recap configuration, stored under the `recap` key of the guild's
 * hybrid settings blob. Disabled by default — a server must opt in and pick a
 * channel before the bot posts on the selected local schedule.
 */
export function useRecapConfig(guildId: string, enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['guild', guildId, 'config-hybrid'],
    queryFn: () => configApi.getHybridConfig(guildId),
    enabled: !!guildId && enabled,
  });

  const mutation = useMutation({
    mutationFn: (recap: RecapConfig) => configApi.upsertHybridSections(guildId, { recap }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'config-hybrid'] });
    },
  });

  const settings = query.data?.data?.settings;
  const recap = useMemo<RecapConfig | undefined>(
    () => {
      if (!query.data) return undefined;
      const stored = settings?.recap || {};
      return {
        ...DEFAULT_RECAP,
        ...stored,
        sections: {
          ...DEFAULT_RECAP.sections,
          ...(stored.sections || {}),
        },
      };
    },
    [query.data, settings?.recap],
  );

  return {
    recap,
    isLoading: query.isLoading,
    loadError: query.error as Error | null,
    refetch: query.refetch,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
  };
}
