/**
 * Public store, `/t/:login/store` (§11.1, §12.4). Reads `GET /public/:login/store`
 * (no session) and shows how to redeem each item in chat.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadFailed, LoadingSpinner } from '@/components/ui';
import { publicKey } from '../shared/queryKeys';
import { twitchRetry } from '../shared/api';
import { levelLabel } from '../shared/useMeta';
import { EmptyState, StatusChip } from '../shared/ui';
import { formatNumber } from '../shared/ui/format';
import { publicLoyaltyApi } from './api';
import { describeStock, kindLabel, redeemCommand } from './model';
import './loyalty.css';

export const PublicStorePage: React.FC<{ login: string }> = ({ login }) => {
  const query = useQuery({
    queryKey: publicKey(login, 'store'),
    queryFn: () => publicLoyaltyApi.store(login),
    retry: twitchRetry,
    staleTime: 30_000,
  });

  if (query.isError) {
    return (
      <LoadFailed
        title="The store didn't load"
        message={`${query.error instanceof Error ? query.error.message : 'Something went wrong.'} Try again in a moment.`}
        onRetry={() => query.refetch()}
      />
    );
  }
  if (query.isPending) return <LoadingSpinner />;

  const { items, currency_name: currency } = query.data;
  return (
    <section aria-labelledby="tw-public-store-title" className="tw-loyalty-stack">
      <h2 id="tw-public-store-title" className="tw-section-title">Store</h2>
      <p className="tw-muted">Earn {currency} by watching and chatting, then type the command in chat to redeem.</p>
      {items.length === 0 ? (
        <EmptyState title="Nothing for sale yet" description="Items appear here once the streamer adds them." />
      ) : (
        <ul className="tw-loyalty-shop">
          {items.map((item) => (
            <li key={item.id} className="tw-loyalty-shop__item">
              <div className="tw-loyalty-shop__head">
                <strong>{item.name}</strong>
                <span className="tw-loyalty-number">{formatNumber(item.cost)} {currency}</span>
              </div>
              {item.description && <p>{item.description}</p>}
              <div className="tw-loyalty-shop__meta">
                <span>{kindLabel(item.kind)}</span>
                {item.level_name !== 'everyone' && <span>{levelLabel(item.level_name)} and up</span>}
                {item.stock !== null && (
                  <StatusChip tone={item.stock > 0 ? 'neutral' : 'warning'}>{describeStock(item.stock)}</StatusChip>
                )}
              </div>
              <code className="tw-loyalty-shop__command">{redeemCommand(item)}</code>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
