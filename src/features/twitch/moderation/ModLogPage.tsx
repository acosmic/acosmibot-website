/**
 * Moderation log (§11.4): every action the bot's filters, protections and
 * moderators on this dashboard took, newest first, filterable by action and
 * user. A row opens the user drawer. Entries are kept for 90 days.
 */
import React, { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { SectionProps } from '../types';
import {
  EmptyState,
  Field,
  RecordTable,
  SectionPage,
  formatDateTime,
  tk,
  twitchRetry,
  useFeedEvents,
  type Column,
} from '../shared/ui';
import { moderationApi } from './api';
import { LOG_ACTIONS, describeLogAction, modLogQuery, ruleLabel, type ModLogEntry } from './model';
import { UserDrawer } from './UserDrawer';
import './moderation.css';

export const ModLogPage: React.FC<SectionProps> = ({ channelId }) => {
  const [action, setAction] = useState('');
  const [userFilter, setUserFilter] = useState<{ id: string; name: string } | null>(null);
  const [openUser, setOpenUser] = useState<string | null>(null);

  const log = useInfiniteQuery({
    queryKey: tk(channelId, 'moderation', 'log', action, userFilter?.id ?? ''),
    queryFn: ({ pageParam }) => moderationApi.modLog(channelId, modLogQuery({ action, userId: userFilter?.id ?? null, beforeId: pageParam })),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.next_before_id ?? undefined,
    retry: twitchRetry,
  });
  useFeedEvents(['moderation.action'], () => { void log.refetch(); });

  const rows = log.data?.pages.flatMap((page) => page.items) ?? [];
  const columns: Column<ModLogEntry>[] = [
    { key: 'time', header: 'When', render: (row) => formatDateTime(row.created_at), width: '180px' },
    { key: 'user', header: 'User', primary: true, render: (row) => row.target_login ?? (row.target_user_id ? `User ${row.target_user_id}` : 'Channel') },
    { key: 'action', header: 'Action', render: (row) => describeLogAction(row), width: '200px' },
    { key: 'rule', header: 'Why', render: (row) => `${ruleLabel(row.rule)}${row.actor_type === 'user' ? '' : ' (bot)'}`, width: '200px' },
    {
      key: 'excerpt', header: 'Message', hideOnMobile: true,
      render: (row) => row.message_excerpt ? <span className="tw-mod-message">{row.message_excerpt}</span> : '—',
    },
  ];

  return (
    <SectionPage
      title="Moderation log"
      description="Actions taken by the filters, raid and follow-bot protection, and moderators using this dashboard. Kept for 90 days."
      query={log}
    >
      <RecordTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Moderation log"
        onRowClick={(row) => row.target_user_id && setOpenUser(row.target_user_id)}
        rowLabel={(row) => `Open ${row.target_login ?? 'user'}`}
        toolbar={(
          <div className="tw-mod-toolbar">
            <Field label="Action">
              {(control) => (
                <select {...control} className="form-select" value={action} onChange={(event) => setAction(event.target.value)}>
                  <option value="">All actions</option>
                  {LOG_ACTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              )}
            </Field>
            {userFilter ? (
              <button type="button" className="btn" onClick={() => setUserFilter(null)}>Show every user (now: {userFilter.name})</button>
            ) : null}
          </div>
        )}
        rowActions={(row) => row.target_user_id && !userFilter ? (
          <button type="button" className="btn" onClick={(event) => {
            event.stopPropagation();
            setUserFilter({ id: row.target_user_id as string, name: row.target_login ?? row.target_user_id as string });
          }}>Only this user</button>
        ) : null}
        empty={<EmptyState title="Nothing logged yet" description="Filter actions and dashboard actions appear here as they happen." />}
        footer={log.hasNextPage ? (
          <div className="tw-mod-more">
            <button type="button" className="btn" disabled={log.isFetchingNextPage} aria-busy={log.isFetchingNextPage}
              onClick={() => log.fetchNextPage()}>Load older entries</button>
          </div>
        ) : undefined}
      />
      <UserDrawer channelId={channelId} userId={openUser} onClose={() => setOpenUser(null)} />
    </SectionPage>
  );
};
