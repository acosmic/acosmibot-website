import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bannedUsersApi, BannedUsersConfig } from '@/api/bannedUsers';

const DEFAULT_CONFIG: BannedUsersConfig = {
  enabled: true,
  response_mode: 'ignore',
  dm_message: 'You have been banned from using this bot in {guild_name}.',
  channel_message: '{user_mention}, you are banned from using this bot.',
  users: [],
};

export function useBannedUsersConfig(guildId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['guild', guildId, 'banned-users'],
    queryFn: () => bannedUsersApi.getConfig(guildId),
    enabled: !!guildId,
  });

  const mutation = useMutation({
    mutationFn: (config: BannedUsersConfig) => bannedUsersApi.saveConfig(guildId, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'banned-users'] });
    },
  });

  const data = useMemo<BannedUsersConfig | undefined>(
    () => (query.data ? { ...DEFAULT_CONFIG, ...query.data.data } : undefined),
    [query.data],
  );

  return {
    data,
    isLoading: query.isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
  };
}
