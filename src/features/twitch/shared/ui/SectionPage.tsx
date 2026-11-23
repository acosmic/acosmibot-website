import React from 'react';
import { LoadFailed, LoadingSpinner } from '@/components/ui';
import { isRole } from '../roles';
import { TwitchApiError } from '../api';
import { RoleRequired } from '../../shell/RoleRequired';
import type { QueryState } from './queries';

export interface SectionPageProps {
  /** Page heading (rendered as the page's only `h1`). */
  title: string;
  description?: React.ReactNode;
  /** Header actions (primary "Add …" button etc.). */
  actions?: React.ReactNode;
  /**
   * The query the page cannot render without. While pending the page shows a
   * spinner; on failure `LoadFailed` with Retry (or the role panel on a 403).
   * Use `combineQueries(a, b)` for several.
   */
  query?: QueryState;
  /** Title for the failed-load panel; default "<title> didn't load". */
  failedTitle?: string;
  children?: React.ReactNode;
}

/**
 * Standard frame for every Twitch dashboard page: header, then exactly one of
 * loading / failed / content. The working width is capped at 1080px.
 */
export const SectionPage: React.FC<SectionPageProps> = ({ title, description, actions, query, failedTitle, children }) => {
  let body: React.ReactNode = children;

  if (query?.isError) {
    const error = query.error;
    if (error instanceof TwitchApiError && error.status === 403 && error.code === 'insufficient_role') {
      const required = (error.details as { required?: unknown } | undefined)?.required;
      body = <RoleRequired required={isRole(required) ? required : 'editor'} sectionLabel={title} />;
    } else {
      body = (
        <LoadFailed
          title={failedTitle ?? `${title} didn't load`}
          message={error instanceof Error && error.message
            ? `${error.message} Nothing was changed.`
            : 'Something went wrong while loading this page. Nothing was changed. Try again in a moment.'}
          onRetry={() => query.refetch()}
        />
      );
    }
  } else if (query?.isPending) {
    body = <LoadingSpinner />;
  }

  return (
    <div className="feature-page tw-section-page">
      <header className="page-header tw-page-header">
        <div className="tw-page-header__copy">
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="tw-page-header__actions">{actions}</div>}
      </header>
      {body}
    </div>
  );
};
