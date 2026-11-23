/**
 * Chat log (§11.4, §12.3.5, §14.1): search this channel's recent chat by user
 * and text, open a user's history and act on it. The log is on by default,
 * kept for 7 days (at most 30) and can be turned off; turning it off stops new
 * messages from being stored, and stored ones expire with the retention.
 */
import React, { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { FeatureToggle, NumberInput } from '@/components/ui';
import type { SectionProps } from '../types';
import {
  EmptyState,
  Field,
  ReadOnlyNotice,
  RecordTable,
  SectionPage,
  SettingsSaveBar,
  StatusChip,
  formatDateTime,
  isTwitchApiError,
  tk,
  twitchRetry,
  useSectionSettings,
  type Column,
} from '../shared/ui';
import { moderationApi } from './api';
import { LIMITS, badgeNames, chatLogQuery, type ChatLogEntry, type ChatLogSettings } from './model';
import { UserDrawer } from './UserDrawer';
import './moderation.css';

export const ChatLogPage: React.FC<SectionProps> = ({ channelId, role }) => {
  const settings = useSectionSettings<ChatLogSettings>(channelId, 'chat_log');
  const [userText, setUserText] = useState('');
  const [text, setText] = useState('');
  const [search, setSearch] = useState({ user: '', text: '' });
  const [problem, setProblem] = useState<string | null>(null);
  const [openUser, setOpenUser] = useState<string | null>(null);
  const enabled = settings.value?.enabled ?? false;

  const log = useInfiniteQuery({
    queryKey: tk(channelId, 'moderation', 'chat-log', search.user, search.text),
    queryFn: ({ pageParam }) => moderationApi.chatLog(channelId, chatLogQuery({ ...search, beforeId: pageParam }).query),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.next_before_id ?? undefined,
    enabled: enabled,
    retry: twitchRetry,
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next = { user: userText, text };
    const checked = chatLogQuery(next);
    setProblem(checked.problem);
    if (!checked.problem) setSearch(next);
  };

  const rows = log.data?.pages.flatMap((page) => page.items) ?? [];
  const columns: Column<ChatLogEntry>[] = [
    { key: 'time', header: 'When', render: (row) => formatDateTime(row.created_at), width: '180px' },
    {
      key: 'user', header: 'User', width: '190px',
      render: (row) => {
        const badges = badgeNames(row.badges);
        return (
          <>
            {row.display_name || row.login}
            {badges.shared && <> <StatusChip tone="neutral">Shared chat</StatusChip></>}
          </>
        );
      },
    },
    {
      key: 'text', header: 'Message', primary: true,
      render: (row) => (
        <>
          <span className={`tw-mod-message${row.is_deleted ? ' is-deleted' : ''}`}>{row.text}</span>
          {row.is_deleted && <StatusChip tone="neutral">Deleted</StatusChip>}
        </>
      ),
    },
  ];

  const turnedOff = isTwitchApiError(log.error, 'invalid_state');
  const form = settings.form;

  return (
    <SectionPage
      title="Chat log"
      description="Recent chat in this channel, for looking up what a user said. Only moderators and above can see it."
      query={settings.query}
    >
      {form && (
        <div className="tw-mod-stack">
          {!settings.canWrite && <ReadOnlyNotice required={settings.writeRole} role={role} what="chat log settings" />}
          <FeatureToggle
            label="Keep a chat log"
            description="Stores each chat message for the days below so moderators can look users up. Off stores nothing new."
            enabled={form.enabled}
            onChange={(on) => settings.canWrite && settings.setForm({ enabled: on })}
          />
          <section className="tw-mod-card" aria-labelledby="tw-chat-retention">
            <h2 id="tw-chat-retention" className="tw-mod-card__title">Retention</h2>
            <Field label="Keep messages for (days)" help="Between 1 and 30 days. Older messages are deleted every night.">
              {(control) => (
                <NumberInput {...control} className="form-control" min={1} max={30} value={form.retention_days}
                  disabled={!settings.canWrite}
                  onValueChange={(next) => settings.setForm({ retention_days: Math.min(30, Math.max(1, Math.round(next))) })} />
              )}
            </Field>
          </section>

          {!enabled || turnedOff ? (
            <EmptyState title="The chat log is off" description="Turn it on above to start storing messages. Nothing is stored while it is off." />
          ) : (
            <>
              <form className="tw-mod-toolbar" onSubmit={submit} role="search" aria-label="Search the chat log">
                <Field label="User" help="Username or user id" error={problem}>
                  {(control) => (
                    <input {...control} className="form-control" value={userText} maxLength={32} placeholder="username"
                      onChange={(event) => setUserText(event.target.value)} />
                  )}
                </Field>
                <Field label="Text">
                  {(control) => (
                    <input {...control} className="form-control" value={text} maxLength={LIMITS.searchChars}
                      onChange={(event) => setText(event.target.value)} />
                  )}
                </Field>
                <div className="tw-field">
                  <button type="submit" className="btn primary"><Search size={16} aria-hidden="true" /> Search</button>
                </div>
              </form>
              {log.isError ? (
                <div className="tw-inline-failed">
                  <span>The chat log didn't load. Nothing was changed.</span>
                  <button type="button" className="btn" onClick={() => log.refetch()}>Retry</button>
                </div>
              ) : (
                <RecordTable
                  rows={rows}
                  columns={columns}
                  rowKey={(row) => row.id}
                  caption="Chat log"
                  onRowClick={(row) => setOpenUser(row.user_id)}
                  rowLabel={(row) => `Open ${row.display_name || row.login}`}
                  empty={log.isPending
                    ? <p className="tw-muted">Loading…</p>
                    : <EmptyState title="No messages found" description={search.user || search.text ? 'Try another user or fewer words.' : 'Messages appear here a few seconds after they are sent.'} />}
                  footer={log.hasNextPage ? (
                    <div className="tw-mod-more">
                      <button type="button" className="btn" disabled={log.isFetchingNextPage} aria-busy={log.isFetchingNextPage}
                        onClick={() => log.fetchNextPage()}>Load older messages</button>
                    </div>
                  ) : undefined}
                />
              )}
            </>
          )}
        </div>
      )}
      <UserDrawer channelId={channelId} userId={openUser} onClose={() => setOpenUser(null)} />
      <SettingsSaveBar settings={settings} />
    </SectionPage>
  );
};
