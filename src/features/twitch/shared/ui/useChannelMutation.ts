import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { showToast } from '@/utils/toast';
import { twitchErrorMessage } from '../api';

export interface ChannelMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Query keys to refetch after success, e.g. `[tk(channelId, 'commands')]`. */
  invalidate?: QueryKey[];
  /** Toast after success (string, or built from the response). Omit for silence. */
  successMessage?: string | ((data: TData, variables: TVariables) => string | null);
  /** Toast prefix on failure; the API's sentence follows. Set `false` to handle errors yourself. */
  errorMessage?: string | false;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: unknown, variables: TVariables) => void;
}

/**
 * `useMutation` with the dashboard conventions: failures surface through the
 * existing toast helper (and leave the caller's form state alone), successes
 * refetch the listed queries.
 *
 *   const remove = useChannelMutation({
 *     mutationFn: (id: number) => twitchApi.del(channelPath(channelId, `/quotes/${id}`)),
 *     invalidate: [tk(channelId, 'quotes')],
 *     successMessage: 'Quote deleted',
 *   });
 */
export function useChannelMutation<TData = unknown, TVariables = void>(options: ChannelMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();
  return useMutation<TData, unknown, TVariables>({
    mutationFn: options.mutationFn,
    onSuccess: (data, variables) => {
      for (const key of options.invalidate ?? []) void queryClient.invalidateQueries({ queryKey: key });
      const message = typeof options.successMessage === 'function'
        ? options.successMessage(data, variables)
        : options.successMessage;
      if (message) showToast(message, 'success');
      options.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      if (options.errorMessage !== false) {
        const reason = twitchErrorMessage(error);
        showToast(options.errorMessage ? `${options.errorMessage} ${reason}` : reason, 'error');
      }
      options.onError?.(error, variables);
    },
  });
}
