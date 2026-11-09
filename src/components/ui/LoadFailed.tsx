import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RotateCw, TriangleAlert } from 'lucide-react';

export interface LoadFailedProps {
  /** Short statement of what could not load, e.g. "Leveling settings didn't load". */
  title?: string;
  /** One sentence telling the member what to do next. */
  message?: string;
  /** Specific retry. Defaults to refetching every active query on the page. */
  onRetry?: () => unknown;
  /** Smaller variant for a section inside a page (lists, ledgers). */
  compact?: boolean;
}

/**
 * Shared failed-load state. Use this whenever a request fails so a failure is
 * never presented as "no data" or as an empty list, and always offer Retry.
 */
export const LoadFailed: React.FC<LoadFailedProps> = ({
  title = "This page didn't load",
  message = 'Something went wrong while loading your settings. Nothing was changed. Try again in a moment.',
  onRetry,
  compact = false,
}) => {
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      await (onRetry ? onRetry() : queryClient.refetchQueries({ type: 'active' }));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      className={`load-failed${compact ? ' load-failed--compact' : ''}`}
    >
      <TriangleAlert className="load-failed__icon" aria-hidden="true" />
      <div className="load-failed__copy">
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      <button type="button" className="btn" onClick={() => void retry()} disabled={retrying} aria-busy={retrying}>
        <RotateCw size={16} aria-hidden="true" className={retrying ? 'load-failed__spin' : undefined} />
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  );
};
