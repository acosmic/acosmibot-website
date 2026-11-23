/** Helpers for combining TanStack Query states into one page state. */

export interface QueryState {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
}

/**
 * One state for several queries a page needs before it can render:
 * pending while any is pending, failed when any failed (first error wins),
 * and one retry that refetches the failed ones.
 *
 *   <SectionPage title="Store" query={combineQueries(items, settings.query)}>
 */
export function combineQueries(...queries: QueryState[]): QueryState {
  const failed = queries.filter((query) => query.isError);
  return {
    isPending: queries.some((query) => query.isPending && !query.isError),
    isError: failed.length > 0,
    error: failed[0]?.error ?? null,
    refetch: () => Promise.all((failed.length ? failed : queries).map((query) => query.refetch())),
  };
}
