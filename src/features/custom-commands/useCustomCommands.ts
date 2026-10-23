import type { SavedFeatureStats } from '@/components/ui/SavedFeaturePlan';
import { showToast } from '@/utils/toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';

export interface EmbedConfig {
  title?: string | null;
  description?: string | null;
  color?: number | null;
  thumbnail?: { url: string } | null;
  image?: { url: string } | null;
  footer?: { text: string } | null;
}

export interface CustomCommand {
  is_enabled: boolean;
  id: string;
  command: string;
  prefix: string;
  description?: string | null;
  response_type: 'text' | 'embed';
  response_text?: string | null;
  embed_config?: EmbedConfig | null;
  auto_delete_input_seconds?: number;
  auto_delete_output_seconds?: number;
  allowed_role_ids?: string[];
  created_at?: string;
}

export interface CommandPayload {
  command: string;
  prefix: string;
  description: string;
  response_type: 'text' | 'embed';
  response_text?: string;
  embed_config?: EmbedConfig;
  auto_delete_input_seconds?: number;
  auto_delete_output_seconds?: number;
  allowed_role_ids: string[];
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
    mutationFn: (data: CommandPayload) =>
      api.fetch<any>(`/api/guilds/${guildId}/custom-commands`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'custom-commands'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ commandId, data }: { commandId: string; data: CommandPayload }) =>
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

  const activeMutation = useMutation({
    mutationFn: (command: CustomCommand) => api.fetch(`/api/guilds/${guildId}/custom-commands/${command.id}/active`, {
      method: 'PUT', body: JSON.stringify({ active: !command.is_enabled }),
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'custom-commands'] }); },
    onError: (error) => showToast(error instanceof Error ? error.message : 'Could not change active selection', 'error'),
  });

  return {
    stats: statsQuery.data?.stats as SavedFeatureStats | undefined,
    setActive: activeMutation.mutate,
    isSelecting: activeMutation.isPending,
    commands: (commandsQuery.data?.commands || []) as CustomCommand[],
    maxCommands: (statsQuery.data?.stats?.saved_limit ?? 0) as number,
    isLoading: commandsQuery.isLoading || statsQuery.isLoading,
    addCommand: addMutation.mutate,
    isAdding: addMutation.isPending,
    updateCommand: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    deleteCommand: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
