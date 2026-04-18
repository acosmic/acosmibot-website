import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';

export interface CustomCommand {
  id: string;
  command: string;
  prefix: string;
  response_type: 'text' | 'embed';
  response_text: string;
  created_at?: string;
}

export function useCustomCommands(guildId: string) {
  const queryClient = useQueryClient();

  const commandsQuery = useQuery({
    queryKey: ['guild', guildId, 'custom-commands'],
    queryFn: () => api.fetch<any>(`/api/guilds/${guildId}/custom-commands`),
    enabled: !!guildId,
  });

  const statsQuery = useQuery({
    queryKey: ['guild', guildId, 'custom-commands', 'stats'],
    queryFn: () => api.fetch<any>(`/api/guilds/${guildId}/custom-commands/stats`),
    enabled: !!guildId,
  });

  const addMutation = useMutation({
    mutationFn: (data: { command: string; prefix?: string; response_type: string; response_text: string }) =>
      api.fetch<any>(`/api/guilds/${guildId}/custom-commands`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'custom-commands'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ commandId, data }: { commandId: string; data: Partial<CustomCommand> }) =>
      api.fetch<any>(`/api/guilds/${guildId}/custom-commands/${commandId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'custom-commands'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commandId: string) =>
      api.fetch<any>(`/api/guilds/${guildId}/custom-commands/${commandId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'custom-commands'] });
    },
  });

  return {
    commands: commandsQuery.data?.commands || [],
    maxCommands: statsQuery.data?.stats?.max_commands || 25,
    isLoading: commandsQuery.isLoading || statsQuery.isLoading,
    addCommand: addMutation.mutate,
    isAdding: addMutation.isPending,
    updateCommand: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    deleteCommand: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
