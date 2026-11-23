/**
 * Public quotes page, `/t/:login/quotes` (§11.1, §12.8). Reads
 * `GET /public/:login/quotes` (no session). Quote text is rendered as plain text.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { LoadFailed, LoadingSpinner } from '@/components/ui';
import { publicKey } from '../shared/queryKeys';
import { twitchRetry } from '../shared/api';
import { EmptyState, Field } from '../shared/ui';
import { formatDateTime } from '../shared/ui/format';
import { publicQuotesApi } from './api';
import { QUOTE_LIMITS, describePage, quoteQuery } from './model';
import './stream-tools.css';

export const PublicQuotesPage: React.FC<{ login: string }> = ({ login }) => {
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: publicKey(login, 'quotes', search, page),
    queryFn: () => publicQuotesApi.list(login, quoteQuery(search, page)),
    retry: twitchRetry,
    placeholderData: (previous) => previous,
  });

  if (query.isError) {
    return (
      <LoadFailed
        title="Quotes didn't load"
        message={`${query.error instanceof Error ? query.error.message : 'Something went wrong.'} Try again in a moment.`}
        onRetry={() => query.refetch()}
      />
    );
  }
  if (query.isPending) return <LoadingSpinner />;

  const { items, total } = query.data;
  const lastPage = Math.max(0, Math.ceil(total / QUOTE_LIMITS.pageSize) - 1);

  return (
    <section aria-labelledby="tw-public-quotes-title" className="tw-st-stack">
      <h2 id="tw-public-quotes-title" className="tw-section-title">Quotes</h2>
      <form
        className="tw-st-inline"
        role="search"
        onSubmit={(event) => { event.preventDefault(); setSearch(searchText.trim()); setPage(0); }}
      >
        <Field label="Search quotes" hideLabel>
          {(control) => (
            <input {...control} className="form-control" type="search" placeholder="Search the quotes" maxLength={QUOTE_LIMITS.searchMax}
              value={searchText} onChange={(event) => setSearchText(event.target.value)} />
          )}
        </Field>
        <button type="submit" className="btn"><Search size={16} aria-hidden="true" /> Search</button>
        {search && <button type="button" className="btn" onClick={() => { setSearchText(''); setSearch(''); setPage(0); }}>Clear</button>}
      </form>
      {items.length === 0 ? (
        <EmptyState
          title={search ? 'No quotes match' : 'No quotes yet'}
          description={search ? 'Try fewer or different words.' : 'Quotes appear here once the channel has added some.'}
        />
      ) : (
        <div aria-live="polite">
          <ul className="tw-link-ledger" style={{ listStyle: 'none', padding: 0 }}>
            {items.map((quote) => (
              <li key={quote.number} className="tw-st-public-quote">
                <blockquote className="tw-st-quote">&ldquo;{quote.text}&rdquo;</blockquote>
                <small>
                  #{quote.number}
                  {quote.quoted_name ? ` · ${quote.quoted_name}` : ''}
                  {quote.category_name ? ` · ${quote.category_name}` : ''}
                  {quote.created_at ? ` · ${formatDateTime(quote.created_at)}` : ''}
                </small>
              </li>
            ))}
          </ul>
          {total > QUOTE_LIMITS.pageSize && (
            <div className="tw-st-pager">
              <span className="tw-muted">{describePage(page, QUOTE_LIMITS.pageSize, items.length, total)}</span>
              <span className="tw-st-row-actions">
                <button type="button" className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                <button type="button" className="btn" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>Next</button>
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
