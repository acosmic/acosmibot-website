import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { xAlertsApi, type XAlertSettings } from '@/api/xAlerts';

export function useXAlertsConfig(guildId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['x-alerts', guildId] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => xAlertsApi.getConfig(guildId),
    enabled: Boolean(guildId),
  });

  const mutation = useMutation({
    mutationFn: (settings: XAlertSettings) => xAlertsApi.updateConfig(guildId, settings),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
    },
  });

  return {
    ...query,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    saveError: mutation.error as Error | null,
  };
}
