import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { activityMonitorApi, type ActivityMonitorConfig } from '@/api/activityMonitor';

const FALLBACK: ActivityMonitorConfig = { enabled: false, check_interval: 60, rules: [] };

/**
 * Activity-monitor config with auto-save semantics (the legacy page saved on
 * every toggle/rule change rather than using a SaveBar).
 */
export function useActivityMonitorConfig(guildId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['guild', guildId, 'activity-monitor'];

  const query = useQuery({
    queryKey,
    queryFn: () => activityMonitorApi.getConfig(guildId),
    enabled: !!guildId,
  });

  const mutation = useMutation({
    mutationFn: (config: ActivityMonitorConfig) => activityMonitorApi.saveConfig(guildId, config),
    onSuccess: (saved) => queryClient.setQueryData(queryKey, saved),
  });

  return {
    config: query.data ?? (query.isError ? FALLBACK : undefined),
    isLoading: query.isLoading,
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
