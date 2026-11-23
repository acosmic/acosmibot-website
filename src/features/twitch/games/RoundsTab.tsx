/** Recent rounds (§10.7.5 `GET /games/rounds`): what ran, how it ended and how many points moved. */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadFailed, LoadingSpinner } from '@/components/ui';
import { EmptyState, Field, RecordTable, StatusChip, formatDateTime, tk, twitchErrorMessage, twitchRetry, type Column } from '../shared/ui';
import { gamesApi } from './api';
import { GAME_LABELS, GAME_NAMES, STATUS_LABELS, describeStakes, roundTitle, type GameName, type GameRound, type RoundStatus } from './model';

const TONE: Record<RoundStatus, 'active' | 'neutral' | 'warning' | 'error'> = {
  open: 'active', locked: 'warning', resolved: 'neutral', cancelled: 'neutral', refunded: 'neutral',
};

export const RoundsTab: React.FC<{ channelId: string; currency: string }> = ({ channelId, currency }) => {
  const [game, setGame] = useState<GameName | ''>('');
  const list = useQuery({
    queryKey: tk(channelId, 'games', 'rounds', game),
    queryFn: () => gamesApi.rounds(channelId, game),
    retry: twitchRetry,
    refetchInterval: 30_000,
  });

  const columns: Column<GameRound>[] = [
    { key: 'game', header: 'Game', width: '110px', render: (r) => GAME_LABELS[r.game] },
    { key: 'title', header: 'Round', primary: true, render: (r) => roundTitle(r) },
    { key: 'status', header: 'Status', width: '150px', render: (r) => <StatusChip tone={TONE[r.status]}>{STATUS_LABELS[r.status]}</StatusChip> },
    { key: 'stakes', header: 'Points', render: (r) => describeStakes(r, currency) },
    { key: 'when', header: 'Started', width: '170px', hideOnMobile: true, render: (r) => formatDateTime(r.created_at) },
  ];

  return (
    <div className="tw-games-stack">
      <div className="tw-games-toolbar">
        <Field label="Game">
          {(control) => (
            <select {...control} className="form-select" value={game} onChange={(event) => setGame(event.target.value as GameName | '')}>
              <option value="">All games</option>
              {GAME_NAMES.map((name) => <option key={name} value={name}>{GAME_LABELS[name]}</option>)}
            </select>
          )}
        </Field>
      </div>
      {list.isPending ? <LoadingSpinner /> : list.isError ? (
        <LoadFailed title="Recent rounds didn't load" message={`${twitchErrorMessage(list.error)} Nothing was changed.`} onRetry={() => list.refetch()} />
      ) : (
        <RecordTable rows={list.data.items} rowKey={(r) => r.id} caption="Recent game rounds" columns={columns}
          empty={<EmptyState title="No rounds yet" description="Duels, heists, raffles, trivia, bingo and contests show up here after they start." />} />
      )}
    </div>
  );
};
