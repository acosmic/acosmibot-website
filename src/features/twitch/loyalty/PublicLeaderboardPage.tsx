/**
 * Public leaderboard, `/t/:login/leaderboard` (§11.1, §12.4). Reads
 * `GET /public/:login/leaderboard` (no session): rank, name, points and watch
 * time only. Names are rendered as plain text.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadFailed, LoadingSpinner } from '@/components/ui';
import { publicKey } from '../shared/queryKeys';
import { twitchRetry } from '../shared/api';
import { EmptyState, TabPanel, Tabs } from '../shared/ui';
import { formatNumber } from '../shared/ui/format';
import { publicLoyaltyApi } from './api';
import { formatWatchMinutes, type LeaderboardBy } from './model';
import './loyalty.css';

export const PublicLeaderboardPage: React.FC<{ login: string }> = ({ login }) => {
  const [by, setBy] = useState<LeaderboardBy>('points');
  const query = useQuery({
    queryKey: publicKey(login, 'leaderboard', by),
    queryFn: () => publicLoyaltyApi.leaderboard(login, by),
    retry: twitchRetry,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });

  if (query.isError) {
    return (
      <LoadFailed
        title="The leaderboard didn't load"
        message={`${query.error instanceof Error ? query.error.message : 'Something went wrong.'} Try again in a moment.`}
        onRetry={() => query.refetch()}
      />
    );
  }
  if (query.isPending) return <LoadingSpinner />;

  const { items, currency_name: currency } = query.data;
  return (
    <section aria-labelledby="tw-public-leaderboard-title" className="tw-loyalty-stack">
      <h2 id="tw-public-leaderboard-title" className="tw-section-title">Leaderboard</h2>
      <Tabs
        label="Rank by" idPrefix="tw-public-leaderboard"
        tabs={[{ id: 'points', label: currency.charAt(0).toUpperCase() + currency.slice(1) }, { id: 'watch_minutes', label: 'Watch time' }]}
        active={by} onChange={(id) => setBy(id as LeaderboardBy)}
      />
      {(['points', 'watch_minutes'] as const).map((tabId) => (
        <TabPanel key={tabId} idPrefix="tw-public-leaderboard" id={tabId} active={by}>
          {items.length === 0 ? (
            <EmptyState title="Nobody on the board yet" description={`Viewers appear here once they earn ${currency} in chat.`} />
          ) : (
            <ol className="tw-loyalty-board" aria-live="polite">
              {items.map((entry) => (
                <li key={entry.login} className={entry.rank <= 3 ? `tw-loyalty-board__row is-top is-rank-${entry.rank}` : 'tw-loyalty-board__row'}>
                  <span className="tw-loyalty-board__rank" aria-label={`Rank ${entry.rank}`}>{entry.rank}</span>
                  <span className="tw-loyalty-board__name">{entry.display_name || entry.login}</span>
                  <span className="tw-loyalty-board__value">
                    {by === 'points' ? `${formatNumber(entry.points)} ${currency}` : formatWatchMinutes(entry.watch_minutes)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </TabPanel>
      ))}
    </section>
  );
};
