import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient();

/** Remove every private memory projection before an identity is cleared. */
export const purgePrivateMemoryQueries = (): void => {
  void queryClient.cancelQueries({
    predicate: query => {
      const first = query.queryKey[0];
      return first === 'personal-memory'
        || first === 'memory-graph'
        || first === 'memory-graph-node'
        || first === 'memory-participation';
    },
  });
  queryClient.removeQueries({
    predicate: query => {
      const first = query.queryKey[0];
      return first === 'personal-memory'
        || first === 'memory-graph'
        || first === 'memory-graph-node'
        || first === 'memory-participation';
    },
  });
};
