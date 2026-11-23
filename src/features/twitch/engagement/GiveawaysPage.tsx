/**
 * Giveaways (§11.4, §12.6): create giveaways, run one live (open, close, draw, reroll, cancel), watch the
 * entry count and the winner's claim countdown, and set the chat messages. Draws happen in the bot with
 * a secure random generator; this page only asks for them.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { ConfirmDialog, FeatureToggle, NumberInput } from '@/components/ui';
import type { SectionProps } from '../types';
import {
  EditorDrawer,
  EmptyState,
  Field,
  LevelSelect,
  ReadOnlyNotice,
  RecordTable,
  SectionPage,
  SettingsSaveBar,
  StatusChip,
  TabPanel,
  Tabs,
  TemplateField,
  formatDateTime,
  isTwitchApiError,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useChannelMutation,
  useFeedEvents,
  useLevelLabel,
  useSectionSettings,
  type Column,
} from '../shared/ui';
import { giveawaysApi } from './api';
import {
  ACTION_LABEL,
  ENTRY_MODES,
  GIVEAWAY_LIMITS,
  STATUS_LABEL,
  TEMPLATE_MAX,
  WINNER_LABEL,
  availableActions,
  canDelete,
  canEdit,
  clock,
  describeDrawOdds,
  describeEligibility,
  describeEntry,
  draftFromGiveaway,
  emptyGiveawayDraft,
  giveawayInput,
  giveawayProblem,
  isRunning,
  sameGiveawayDraft,
  secondsLeft,
  statusTone,
  type EntryMode,
  type Giveaway,
  type GiveawayAction,
  type GiveawayDraft,
  type GiveawaySettings,
  type GiveawayWinner,
} from './model';
import './engagement.css';

type Editing = { kind: 'new' } | { kind: 'edit'; giveaway: Giveaway } | null;
type Confirm = { kind: 'cancel' | 'delete'; giveaway: Giveaway } | null;

const SUCCESS: Record<GiveawayAction, string> = {
  open: 'Giveaway opened', close: 'Entries closed', draw: 'Winner drawn', reroll: 'Rerolled', cancel: 'Giveaway cancelled',
};

/** Ticks once a second while `active`, so claim countdowns stay current. */
const useNow = (active: boolean): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
};

export const GiveawaysPage: React.FC<SectionProps> = ({ channelId, role }) => {
  const queryClient = useQueryClient();
  const levelName = useLevelLabel();
  const settings = useSectionSettings<GiveawaySettings>(channelId, 'giveaways');
  const [tab, setTab] = useState<'giveaways' | 'settings'>('giveaways');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [entriesPage, setEntriesPage] = useState(0);
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState<GiveawayDraft>(emptyGiveawayDraft());
  const [base, setBase] = useState<GiveawayDraft>(emptyGiveawayDraft());
  const [clientError, setClientError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const list = useQuery({
    queryKey: tk(channelId, 'giveaways'),
    queryFn: () => giveawaysApi.list(channelId),
    retry: twitchRetry,
  });
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const fallback = items.find((item) => item.status === 'open' || item.status === 'closed') ?? items[0] ?? null;
  const selected = items.find((item) => item.id === selectedId) ?? fallback;

  const winners = useQuery({
    queryKey: tk(channelId, 'giveaways', selected?.id ?? 0, 'winners'),
    queryFn: () => giveawaysApi.winners(channelId, selected?.id ?? 0),
    enabled: selected !== null && selected.status !== 'draft',
    retry: twitchRetry,
  });
  const entries = useQuery({
    queryKey: tk(channelId, 'giveaways', selected?.id ?? 0, 'entries', entriesPage),
    queryFn: () => giveawaysApi.entries(channelId, selected?.id ?? 0, entriesPage * GIVEAWAY_LIMITS.entriesPageSize, GIVEAWAY_LIMITS.entriesPageSize),
    enabled: selected !== null && selected.status !== 'draft' && selected.status !== 'cancelled',
    retry: twitchRetry,
    placeholderData: (previous) => previous,
  });
  const winnerRows = winners.data?.items ?? [];
  const pending = winnerRows.filter((winner) => winner.status === 'pending');
  const now = useNow(pending.length > 0);

  // Live updates: entry counts, status changes and claims arrive through the feed.
  useFeedEvents(['giveaway.'], () => { void queryClient.invalidateQueries({ queryKey: tk(channelId, 'giveaways') }); });

  const open = (giveaway: Giveaway | null) => {
    const next = giveaway
      ? draftFromGiveaway(giveaway)
      : emptyGiveawayDraft({ keyword: settings.value?.default_keyword, claim_seconds: settings.value?.default_claim_seconds });
    setDraft(next);
    setBase(next);
    setClientError(null);
    save.reset();
    setEditing(giveaway ? { kind: 'edit', giveaway } : { kind: 'new' });
  };

  const save = useChannelMutation({
    mutationFn: (value: GiveawayDraft) => {
      const input = giveawayInput(value);
      return editing?.kind === 'edit'
        ? giveawaysApi.update(channelId, editing.giveaway.id, input)
        : giveawaysApi.create(channelId, input);
    },
    invalidate: [tk(channelId, 'giveaways')],
    successMessage: 'Giveaway saved',
    errorMessage: false,
    onSuccess: (data) => { setEditing(null); setSelectedId(data.giveaway.id); },
  });
  const run = useChannelMutation({
    mutationFn: (vars: { giveaway: Giveaway; action: GiveawayAction }) =>
      giveawaysApi.action(channelId, vars.giveaway.id, vars.action),
    invalidate: [tk(channelId, 'giveaways')],
    successMessage: (_data, vars) => SUCCESS[vars.action],
    errorMessage: false,
    onSuccess: (_data, vars) => { if (vars.action === 'open') setSelectedId(vars.giveaway.id); setConfirm(null); },
    onError: () => setConfirm(null),
  });
  const remove = useChannelMutation({
    mutationFn: (giveaway: Giveaway) => giveawaysApi.remove(channelId, giveaway.id),
    invalidate: [tk(channelId, 'giveaways')],
    successMessage: 'Giveaway deleted',
    errorMessage: 'Could not delete the giveaway.',
    onSuccess: () => { setConfirm(null); setEditing(null); setSelectedId(null); },
    onError: () => setConfirm(null),
  });
  const removeEntry = useChannelMutation({
    mutationFn: (vars: { giveaway: Giveaway; userId: string }) => giveawaysApi.removeEntry(channelId, vars.giveaway.id, vars.userId),
    invalidate: [tk(channelId, 'giveaways')],
    successMessage: (data) => (Number((data as { refunded?: number }).refunded) > 0 ? 'Entry removed and tickets refunded' : 'Entry removed'),
    errorMessage: 'Could not remove the entry.',
  });

  const submit = () => {
    const problem = giveawayProblem(draft);
    setClientError(problem);
    if (!problem) save.mutate(draft);
  };
  const serverError = save.error
    ? (isTwitchApiError(save.error, 'locked_field')
      ? 'The entry mode and ticket cost cannot change once a giveaway is open.'
      : isTwitchApiError(save.error, 'limit_reached')
        ? 'There are too many unused draft giveaways. Delete some first.'
        : twitchErrorMessage(save.error))
    : null;

  const columns: Column<Giveaway>[] = [
    { key: 'title', header: 'Giveaway', primary: true, render: (giveaway) => <span className="tw-en-name">{giveaway.title}</span> },
    { key: 'status', header: 'Status', render: (giveaway) => <StatusChip tone={statusTone(giveaway.status)}>{STATUS_LABEL[giveaway.status]}</StatusChip> },
    { key: 'mode', header: 'Entry', hideOnMobile: true, render: (giveaway) => describeEntry(giveaway) },
    { key: 'entries', header: 'Entries', align: 'end', hideOnMobile: true, render: (giveaway) => <span className="tw-en-value">{giveaway.entry_count.toLocaleString('en-US')}</span> },
    { key: 'when', header: 'Created', hideOnMobile: true, render: (giveaway) => (giveaway.created_at ? formatDateTime(giveaway.created_at) : '') },
  ];

  const busy = run.isPending;
  const askAction = (giveaway: Giveaway, action: GiveawayAction) => {
    if (action === 'cancel') setConfirm({ kind: 'cancel', giveaway });
    else run.mutate({ giveaway, action });
  };
  const runningHere = selected !== null && isRunning(selected, winnerRows);

  return (
    <SectionPage
      title="Giveaways"
      description="Run a giveaway in chat. Viewers type a keyword, buy tickets with points, or are drawn from whoever is active. Winners get a short time to claim the prize by chatting."
      query={list}
      actions={(
        <button type="button" className="btn primary" onClick={() => open(null)}>
          <Plus size={16} aria-hidden="true" /> New giveaway
        </button>
      )}
    >
      <div className="tw-en-stack">
        <Tabs
          label="Giveaways sections" idPrefix="tw-giveaways"
          tabs={[{ id: 'giveaways', label: 'Giveaways', count: items.length }, { id: 'settings', label: 'Chat settings' }]}
          active={tab} onChange={(id) => setTab(id as 'giveaways' | 'settings')}
        />
        <TabPanel idPrefix="tw-giveaways" id="giveaways" active={tab}>
          <div className="tw-en-stack">
            {settings.value && !settings.value.enabled && (
              <p className="tw-muted" role="status">Giveaways are turned off in the chat settings, so a giveaway cannot be opened until you turn them on.</p>
            )}
            {selected && (
              <section className={`tw-en-card${runningHere ? ' tw-en-card--live' : ''}`} aria-labelledby="tw-giveaway-live">
                <div className="tw-en-card__header">
                  <div>
                    <h2 id="tw-giveaway-live" className="tw-en-card__title">{selected.title}</h2>
                    <p className="tw-en-card__lead">
                      <StatusChip tone={statusTone(selected.status)}>{STATUS_LABEL[selected.status]}</StatusChip>
                      {' '}{describeEntry(selected)}
                    </p>
                  </div>
                  <div className="tw-en-actions">
                    {availableActions(selected.status).map((action) => (
                      <button
                        key={action} type="button" className={`btn${action === 'draw' || action === 'open' ? ' primary' : ''}`}
                        disabled={busy || (action === 'reroll' && pending.length === 0 && winnerRows.length === 0)}
                        onClick={() => askAction(selected, action)}
                      >
                        {ACTION_LABEL[action]}
                      </button>
                    ))}
                    {canEdit(selected.status) && <button type="button" className="btn" onClick={() => open(selected)}>Edit</button>}
                    {canDelete(selected.status) && pending.length === 0 && (
                      <button type="button" className="btn" onClick={() => setConfirm({ kind: 'delete', giveaway: selected })}>Delete</button>
                    )}
                  </div>
                </div>
                {Boolean(run.error) && <p className="tw-field__error" role="alert">{twitchErrorMessage(run.error)}</p>}
                <ul className="tw-en-facts">
                  <li><strong className="tw-en-value">{(entries.data?.total ?? selected.entry_count).toLocaleString('en-US')}</strong> {selected.entry_mode === 'active' ? 'in the draw' : 'entries'}</li>
                  <li>{selected.winner_count} winner{selected.winner_count === 1 ? '' : 's'}</li>
                  <li>{selected.claim_seconds > 0 ? `${selected.claim_seconds} seconds to claim` : 'No claim step'}</li>
                  {selected.subscriber_luck > 1 && <li>Subscribers have {selected.subscriber_luck}x luck</li>}
                  {selected.auto_close_at && <li>Closes {formatDateTime(selected.auto_close_at)}</li>}
                  {describeEligibility(selected.eligibility_json, levelName).map((rule) => <li key={rule}>{rule}</li>)}
                </ul>
                <WinnersList winners={winnerRows} now={now} />
                {selected.status !== 'draft' && selected.status !== 'cancelled' && (
                  <>
                    <h3 className="tw-en-subhead">Entries</h3>
                    <RecordTable
                      rows={entries.data?.items ?? []}
                      rowKey={(entry) => entry.user_id}
                      caption="Giveaway entries"
                      columns={[
                        { key: 'name', header: 'Viewer', primary: true, render: (entry) => <span className="tw-en-name">{entry.display_name}</span> },
                        ...(selected.entry_mode === 'tickets'
                          ? [{ key: 'tickets', header: 'Tickets', align: 'end' as const, render: (entry: { tickets: number }) => <span className="tw-en-value">{entry.tickets}</span> }]
                          : []),
                        { key: 'sub', header: 'Subscriber', hideOnMobile: true, render: (entry) => (entry.is_subscriber ? 'Yes' : '') },
                        {
                          key: 'remove', header: 'Remove', hideHeader: true, align: 'end',
                          render: (entry) => (selected.status === 'open' || selected.status === 'closed' ? (
                            <button
                              type="button" className="btn" disabled={removeEntry.isPending}
                              aria-label={`Remove ${entry.display_name}`}
                              onClick={() => removeEntry.mutate({ giveaway: selected, userId: entry.user_id })}
                            >
                              Remove
                            </button>
                          ) : null),
                        },
                      ]}
                      empty={(
                        <EmptyState
                          title={selected.entry_mode === 'active' ? 'Drawn from active chatters' : 'No entries yet'}
                          description={selected.entry_mode === 'active'
                            ? 'Nobody enters. When you draw, the pool is whoever chatted inside the active window and is eligible.'
                            : 'Entries show up here a couple of seconds after viewers enter in chat.'}
                        />
                      )}
                      footer={(entries.data?.total ?? 0) > GIVEAWAY_LIMITS.entriesPageSize ? (
                        <div className="tw-en-pager">
                          <span className="tw-muted">Page {entriesPage + 1} of {Math.ceil((entries.data?.total ?? 0) / GIVEAWAY_LIMITS.entriesPageSize)}</span>
                          <span className="tw-en-actions">
                            <button type="button" className="btn" disabled={entriesPage === 0} onClick={() => setEntriesPage(entriesPage - 1)}>Previous</button>
                            <button
                              type="button" className="btn"
                              disabled={(entriesPage + 1) * GIVEAWAY_LIMITS.entriesPageSize >= (entries.data?.total ?? 0)}
                              onClick={() => setEntriesPage(entriesPage + 1)}
                            >
                              Next
                            </button>
                          </span>
                        </div>
                      ) : undefined}
                    />
                  </>
                )}
              </section>
            )}
            <RecordTable
              rows={items}
              rowKey={(giveaway) => giveaway.id}
              caption="All giveaways"
              columns={columns}
              onRowClick={(giveaway) => { setSelectedId(giveaway.id); setEntriesPage(0); }}
              rowLabel={(giveaway) => `Show ${giveaway.title}`}
              activeKey={selected?.id ?? null}
              empty={(
                <EmptyState
                  title="No giveaways yet"
                  description="Create one, open it, and viewers can start entering right away."
                  action={<button type="button" className="btn primary" onClick={() => open(null)}>New giveaway</button>}
                />
              )}
            />
          </div>
        </TabPanel>
        <TabPanel idPrefix="tw-giveaways" id="settings" active={tab}>
          {settings.form && (
            <section className="tw-en-card" aria-labelledby="tw-giveaway-settings">
              <h2 id="tw-giveaway-settings" className="tw-en-card__title">Chat settings</h2>
              {!settings.canWrite && <ReadOnlyNotice required={settings.writeRole} role={role} />}
              <FeatureToggle
                label="Giveaways" description="Turns the giveaway commands and chat entry on or off."
                enabled={settings.form.enabled}
                onChange={(enabled) => settings.canWrite && settings.setForm({ enabled })}
              />
              <FeatureToggle
                label="Draw again when a winner does not claim" description="After the claim time runs out, draw someone else automatically."
                enabled={settings.form.auto_reroll}
                onChange={(auto_reroll) => settings.canWrite && settings.setForm({ auto_reroll })}
              />
              <div className="tw-en-grid">
                <Field label="Default keyword" help="Used by !giveaway open and by drafts without a keyword.">
                  {(control) => (
                    <input {...control} className="form-control" type="text" maxLength={GIVEAWAY_LIMITS.keywordMax}
                      value={settings.form?.default_keyword ?? ''} disabled={!settings.canWrite}
                      onChange={(event) => settings.setForm({ default_keyword: event.target.value.trim() })} />
                  )}
                </Field>
                <Field label="Default claim time (seconds)" help="0 means winners are claimed straight away.">
                  {(control) => (
                    <NumberInput {...control} className="form-control" min={0} max={GIVEAWAY_LIMITS.claimMax}
                      value={settings.form?.default_claim_seconds} disabled={!settings.canWrite}
                      onValueChange={(default_claim_seconds) => settings.setForm({ default_claim_seconds })} />
                  )}
                </Field>
              </div>
              {([
                ['open_template', 'When a giveaway opens'],
                ['close_template', 'When entries close'],
                ['winner_template', 'When a winner is drawn'],
                ['claimed_template', 'When the prize is claimed'],
                ['expired_template', 'When a winner does not claim'],
              ] as const).map(([key, label]) => (
                <TemplateField
                  key={key} label={label} value={settings.form?.[key] ?? ''} maxLength={TEMPLATE_MAX} context="other"
                  contextVars={['title', 'keyword', 'entries', 'winner', 'seconds']} field={`giveaways.${key}`}
                  issues={settings.issuesFor(`giveaways.${key}`)} disabled={!settings.canWrite} rows={2}
                  onChange={(value) => settings.setForm({ [key]: value })}
                />
              ))}
            </section>
          )}
          <SettingsSaveBar settings={settings} />
        </TabPanel>
      </div>

      <EditorDrawer
        open={editing !== null}
        title={editing?.kind === 'edit' ? 'Edit giveaway' : 'New giveaway'}
        description={editing?.kind === 'edit' && editing.giveaway.status === 'open'
          ? 'This giveaway is open. The entry mode and ticket cost are locked so tickets can be refunded exactly.'
          : 'A new giveaway starts as a draft. Open it when you are ready for entries.'}
        onClose={() => setEditing(null)}
        onSubmit={submit}
        submitting={save.isPending}
        error={clientError ?? serverError}
        dirty={!sameGiveawayDraft(draft, base)}
        submitLabel={editing?.kind === 'edit' ? 'Save giveaway' : 'Create draft'}
      >
        <GiveawayForm draft={draft} onChange={setDraft} locked={editing?.kind === 'edit' && editing.giveaway.status === 'open'} />
      </EditorDrawer>

      {confirm && (
        <ConfirmDialog
          kicker={confirm.kind === 'cancel' ? 'Cancel giveaway' : 'Delete giveaway'}
          title={confirm.kind === 'cancel' ? `Cancel ${confirm.giveaway.title}?` : `Delete ${confirm.giveaway.title}?`}
          confirmLabel={confirm.kind === 'cancel' ? 'Cancel giveaway' : 'Delete giveaway'}
          pending={run.isPending || remove.isPending}
          onConfirm={() => (confirm.kind === 'cancel'
            ? run.mutate({ giveaway: confirm.giveaway, action: 'cancel' })
            : remove.mutate(confirm.giveaway))}
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm.kind === 'cancel'
              ? (confirm.giveaway.entry_mode === 'tickets'
                ? 'The giveaway ends without a winner and every ticket is refunded in full.'
                : 'The giveaway ends without a winner.')
              : 'The giveaway, its entries and its winners are removed for good.'}
          </p>
        </ConfirmDialog>
      )}
    </SectionPage>
  );
};

const WinnersList: React.FC<{ winners: GiveawayWinner[]; now: number }> = ({ winners, now }) => {
  if (winners.length === 0) return null;
  return (
    <>
      <h3 className="tw-en-subhead">Winners</h3>
      <RecordTable
        rows={winners}
        rowKey={(winner) => winner.id}
        caption="Winners"
        columns={[
          { key: 'name', header: 'Winner', primary: true, render: (winner) => <span className="tw-en-name">{winner.display_name}</span> },
          {
            key: 'status', header: 'Status',
            render: (winner) => {
              const left = winner.status === 'pending' ? secondsLeft(winner.claim_deadline, now) : null;
              return (
                <StatusChip tone={winner.status === 'claimed' ? 'active' : winner.status === 'pending' ? 'warning' : 'neutral'}>
                  {WINNER_LABEL[winner.status]}{left !== null ? ` ${clock(left)}` : ''}
                </StatusChip>
              );
            },
          },
          { key: 'odds', header: 'Draw', hideOnMobile: true, render: (winner) => describeDrawOdds(winner) },
          { key: 'draw', header: 'Round', align: 'end', hideOnMobile: true, render: (winner) => winner.draw_number },
        ]}
        empty={null}
      />
    </>
  );
};

const GiveawayForm: React.FC<{ draft: GiveawayDraft; onChange: (draft: GiveawayDraft) => void; locked: boolean }> = ({ draft, onChange, locked }) => {
  const set = (patch: Partial<GiveawayDraft>) => onChange({ ...draft, ...patch });
  const L = GIVEAWAY_LIMITS;
  const mode = ENTRY_MODES.find((item) => item.value === draft.entry_mode);
  return (
    <>
      <Field label="Title" help="Shown in chat and on the overlay.">
        {(control) => (
          <input {...control} className="form-control" type="text" maxLength={L.titleMax} value={draft.title}
            onChange={(event) => set({ title: event.target.value })} />
        )}
      </Field>
      <Field label="How viewers enter" help={mode?.help}>
        {(control) => (
          <select {...control} className="form-select" value={draft.entry_mode} disabled={locked}
            onChange={(event) => set({ entry_mode: event.target.value as EntryMode })}>
            {ENTRY_MODES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        )}
      </Field>
      {draft.entry_mode === 'keyword' && (
        <Field label="Keyword" optional help="One word. Viewers must type exactly this. Empty uses the default keyword.">
          {(control) => (
            <input {...control} className="form-control" type="text" maxLength={L.keywordMax} value={draft.keyword}
              onChange={(event) => set({ keyword: event.target.value })} />
          )}
        </Field>
      )}
      {draft.entry_mode === 'tickets' && (
        <div className="tw-en-grid">
          <Field label="Points per ticket">
            {(control) => (
              <NumberInput {...control} className="form-control" min={1} max={L.ticketCostMax} value={draft.ticket_cost} disabled={locked}
                onValueChange={(ticket_cost) => set({ ticket_cost })} />
            )}
          </Field>
          <Field label="Most tickets per viewer">
            {(control) => (
              <NumberInput {...control} className="form-control" min={1} max={L.maxTicketsMax} value={draft.max_tickets}
                onValueChange={(max_tickets) => set({ max_tickets })} />
            )}
          </Field>
        </div>
      )}
      {draft.entry_mode === 'active' && (
        <Field label="Active window (minutes)" help="Viewers who chatted within this many minutes are in the draw.">
          {(control) => (
            <NumberInput {...control} className="form-control" min={L.windowMin} max={L.windowMax} value={draft.active_window_minutes}
              onValueChange={(active_window_minutes) => set({ active_window_minutes })} />
          )}
        </Field>
      )}
      <div className="tw-en-grid">
        <Field label="Winners">
          {(control) => (
            <NumberInput {...control} className="form-control" min={1} max={L.winnerCountMax} value={draft.winner_count}
              onValueChange={(winner_count) => set({ winner_count })} />
          )}
        </Field>
        <Field label="Claim time (seconds)" help="0 claims winners straight away.">
          {(control) => (
            <NumberInput {...control} className="form-control" min={0} max={L.claimMax} value={draft.claim_seconds}
              onValueChange={(claim_seconds) => set({ claim_seconds })} />
          )}
        </Field>
        <Field label="Subscriber luck" help="2 means a subscriber counts twice. 1 is no bonus.">
          {(control) => (
            <NumberInput {...control} className="form-control" min={L.luckMin} max={L.luckMax} step={0.5} value={draft.subscriber_luck}
              onValueChange={(subscriber_luck) => set({ subscriber_luck })} />
          )}
        </Field>
      </div>
      <Field label="Close entries automatically" optional help="Leave empty to close entries yourself. Within 7 days.">
        {(control) => (
          <input {...control} className="form-control" type="datetime-local" value={draft.auto_close_at}
            onChange={(event) => set({ auto_close_at: event.target.value })} />
        )}
      </Field>
      <h3 className="tw-en-subhead">Who can win</h3>
      <FeatureToggle
        label="Subscribers only" description="Only subscribers can enter."
        enabled={draft.subscriber_only} onChange={(subscriber_only) => set({ subscriber_only })}
      />
      <LevelSelect label="At least this chat level" value={draft.min_level} onChange={(min_level) => set({ min_level })}
        help="Followers need the follower level; it is checked with Twitch when someone enters." />
      <div className="tw-en-grid">
        <Field label="Following for at least (minutes)" help="0 for no requirement.">
          {(control) => (
            <NumberInput {...control} className="form-control" min={0} max={L.followMinutesMax} value={draft.min_follow_minutes}
              onValueChange={(min_follow_minutes) => set({ min_follow_minutes })} />
          )}
        </Field>
        <Field label="Account at least (days old)" help="0 for no requirement.">
          {(control) => (
            <NumberInput {...control} className="form-control" min={0} max={L.accountAgeDaysMax} value={draft.min_account_age_days}
              onValueChange={(min_account_age_days) => set({ min_account_age_days })} />
          )}
        </Field>
        <Field label="No win in the last (days)" help="0 lets past winners enter again.">
          {(control) => (
            <NumberInput {...control} className="form-control" min={0} max={L.excludeWinnersDaysMax} value={draft.exclude_winners_days}
              onValueChange={(exclude_winners_days) => set({ exclude_winners_days })} />
          )}
        </Field>
      </div>
    </>
  );
};
