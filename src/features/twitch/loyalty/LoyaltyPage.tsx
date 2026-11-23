/**
 * Loyalty (§11.4, §12.4): the viewer editor (search, sort, balance edits,
 * exclusions, recent ledger), the channel reset, and the loyalty settings.
 *
 * Balance edits never compute a new balance in the browser: "Set to" sends the
 * target and "Add or remove" a signed change; the API applies either one
 * atomically against concurrent accrual and records it in the ledger.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw, Search, UserX } from 'lucide-react';
import { FeatureToggle, NumberInput } from '@/components/ui';
import type { SectionProps } from '../types';
import {
  ConfirmTypeDialog,
  EditorDrawer,
  EmptyState,
  Field,
  ReadOnlyNotice,
  RecordTable,
  RoleGate,
  SectionPage,
  SettingsSaveBar,
  StatusChip,
  Switch,
  TabPanel,
  Tabs,
  UserLookupInput,
  combineQueries,
  formatDateTime,
  formatNumber,
  formatRelative,
  hasRole,
  isTwitchApiError,
  isValidLogin,
  normalizeLogin,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useChannelMutation,
  useSectionSettings,
  type Column,
  type SectionSettings,
} from '../shared/ui';
import { loyaltyApi } from './api';
import {
  LOYALTY_LIMITS,
  LOYALTY_NUMBER_BOUNDS,
  VIEWER_SORTS,
  balancePatch,
  fieldLabel,
  formatWatchMinutes,
  loyaltySettingsProblem,
  normalizeViewerSearch,
  previewBalance,
  reasonLabel,
  viewerQuery,
  type BalanceMode,
  type LoyaltySettings,
  type Viewer,
  type ViewerSort,
} from './model';
import './loyalty.css';

type Tab = 'viewers' | 'settings';

/* ── Viewer drawer ──────────────────────────────────────────────────────── */

const ViewerDrawer: React.FC<{
  channelId: string;
  viewer: Viewer;
  canEdit: boolean;
  currency: string;
  onClose: () => void;
}> = ({ channelId, viewer, canEdit, currency, onClose }) => {
  const [mode, setMode] = useState<BalanceMode>('add');
  const [amount, setAmount] = useState('');
  const [excluded, setExcluded] = useState(viewer.excluded);
  const [clientError, setClientError] = useState<string | null>(null);

  const fresh = useQuery({
    queryKey: tk(channelId, 'loyalty', 'viewer', viewer.user_id),
    queryFn: () => loyaltyApi.viewer(channelId, viewer.user_id),
    retry: twitchRetry,
  });
  const ledger = useQuery({
    queryKey: tk(channelId, 'loyalty', 'ledger', viewer.user_id),
    queryFn: () => loyaltyApi.transactions(channelId, viewer.user_id),
    retry: twitchRetry,
  });
  const current = fresh.data?.viewer ?? viewer;

  const save = useChannelMutation({
    mutationFn: (body: { points?: number; points_delta?: number; excluded?: boolean }) =>
      loyaltyApi.patchViewer(channelId, viewer.user_id, body),
    invalidate: [tk(channelId, 'loyalty')],
    successMessage: (result) => `${result.viewer.display_name || result.viewer.login} now has ${formatNumber(result.viewer.points)} ${currency}.`,
    errorMessage: false,
    onSuccess: () => onClose(),
  });

  const patch = amount.trim() ? balancePatch(mode, amount) : null;
  const dirty = Boolean(amount.trim()) || excluded !== current.excluded;

  const submit = () => {
    const body: { points?: number; points_delta?: number; excluded?: boolean } = {};
    if (patch) {
      if ('problem' in patch) {
        setClientError(patch.problem);
        return;
      }
      Object.assign(body, patch);
    }
    if (excluded !== current.excluded) body.excluded = excluded;
    if (!Object.keys(body).length) {
      setClientError('Nothing to change yet.');
      return;
    }
    setClientError(null);
    save.mutate(body);
  };

  return (
    <EditorDrawer
      open
      title={current.display_name || current.login}
      description={`twitch.tv/${current.login}`}
      onClose={onClose}
      onSubmit={submit}
      submitting={save.isPending}
      error={clientError ?? (save.error ? twitchErrorMessage(save.error) : null)}
      dirty={canEdit && dirty}
      submitLabel="Save changes"
      submitDisabled={!canEdit}
    >
      <dl className="tw-loyalty-facts">
        <div><dt>Balance</dt><dd>{formatNumber(current.points)} {currency}</dd></div>
        <div><dt>Watch time</dt><dd>{formatWatchMinutes(current.watch_minutes)}</dd></div>
        <div><dt>Messages</dt><dd>{formatNumber(current.message_count)}</dd></div>
        <div><dt>Last seen</dt><dd>{formatRelative(current.last_seen_at)}</dd></div>
      </dl>

      {canEdit ? (
        <>
          <fieldset className="tw-loyalty-balance">
            <legend className="form-label">Change the balance</legend>
            <div className="tw-loyalty-segment" role="radiogroup" aria-label="How to change the balance">
              {(['add', 'set'] as const).map((value) => (
                <label key={value} className={`tw-loyalty-segment__option${mode === value ? ' is-selected' : ''}`}>
                  <input type="radio" name={`tw-balance-mode-${viewer.user_id}`} value={value} checked={mode === value}
                    onChange={() => { setMode(value); setClientError(null); }} />
                  {value === 'add' ? 'Add or remove' : 'Set to'}
                </label>
              ))}
            </div>
            <Field
              label={mode === 'add' ? `Amount (use a minus sign to remove)` : `New balance`}
              help={patch && !('problem' in patch)
                ? `Leaves about ${formatNumber(previewBalance(current.points, patch))} ${currency}; accrual that lands at the same moment is kept.`
                : mode === 'add' ? 'For example 500 or -200. Balances never go below 0.' : 'A whole number, 0 or more.'}
            >
              {(control) => (
                <input {...control} className="form-control" inputMode="numeric" autoComplete="off" value={amount}
                  placeholder={mode === 'add' ? '+500' : String(current.points)}
                  onChange={(event) => { setAmount(event.target.value); setClientError(null); }} />
              )}
            </Field>
          </fieldset>
          <Switch
            label="Exclude from points"
            description="Excluded viewers keep their balance but earn nothing more, get no bonuses, cannot receive !give and never appear on leaderboards."
            checked={excluded}
            onChange={setExcluded}
          />
        </>
      ) : (
        <p className="tw-muted">Changing balances and exclusions needs the editor role.</p>
      )}

      <section aria-labelledby={`tw-ledger-${viewer.user_id}`} className="tw-loyalty-ledger">
        <h3 id={`tw-ledger-${viewer.user_id}`} className="tw-section-title">Recent changes</h3>
        {ledger.isPending ? (
          <p className="tw-muted">Loading…</p>
        ) : ledger.isError ? (
          <div className="tw-inline-failed" role="alert">
            <span>The history didn't load.</span>
            <button type="button" className="btn" onClick={() => void ledger.refetch()}>Retry</button>
          </div>
        ) : ledger.data.items.length === 0 ? (
          <p className="tw-muted">No changes in the last 30 days besides watch-time accrual.</p>
        ) : (
          <ul className="tw-loyalty-ledger__list">
            {ledger.data.items.map((row) => (
              <li key={row.id}>
                <span>{reasonLabel(row.reason)}</span>
                <span className={`tw-loyalty-delta${row.delta < 0 ? ' is-negative' : ''}`}>
                  {row.delta > 0 ? '+' : ''}{formatNumber(row.delta)}
                </span>
                <time dateTime={row.created_at ?? undefined}>{formatDateTime(row.created_at)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </EditorDrawer>
  );
};

/* ── Settings tab ───────────────────────────────────────────────────────── */

const NumberField: React.FC<{
  settings: SectionSettings<LoyaltySettings>;
  field: keyof LoyaltySettings;
  help?: string;
}> = ({ settings, field, help }) => {
  const bounds = LOYALTY_NUMBER_BOUNDS[field as string];
  const form = settings.form;
  if (!form || !bounds) return null;
  const issues = settings.issuesFor(`loyalty.${String(field)}`);
  return (
    <Field label={fieldLabel(String(field))} help={help} error={issues[0]}>
      {(control) => (
        <NumberInput {...control} className="form-control" min={bounds.min} max={bounds.max} step={bounds.step ?? 1}
          value={form[field] as number} disabled={!settings.canWrite}
          onValueChange={(value) => settings.setForm({ [field]: value } as Partial<LoyaltySettings>)} />
      )}
    </Field>
  );
};

const LoyaltySettingsForm: React.FC<{ settings: SectionSettings<LoyaltySettings>; role: SectionProps['role'] }> = ({ settings, role }) => {
  const form = settings.form;
  if (!form) return null;
  const set = (patch: Partial<LoyaltySettings>) => { if (settings.canWrite) settings.setForm(patch); };
  return (
    <div className="tw-loyalty-stack">
      {!settings.canWrite && <ReadOnlyNotice required={settings.writeRole} role={role} />}
      <FeatureToggle
        label="Loyalty points"
        description="Viewers earn points while you are live. Games, the store, giveaway tickets and command costs spend them."
        enabled={form.enabled}
        onChange={(enabled) => set({ enabled })}
      />
      <section className="tw-loyalty-card" aria-labelledby="tw-loyalty-earning">
        <h2 id="tw-loyalty-earning" className="tw-loyalty-card__title">Earning</h2>
        <Field label="Currency name" help="Shown in chat, for example “gems”." error={settings.issuesFor('loyalty.currency_name')[0]}>
          {(control) => (
            <input {...control} className="form-control" maxLength={20} value={form.currency_name} disabled={!settings.canWrite}
              onChange={(event) => set({ currency_name: event.target.value })} />
          )}
        </Field>
        <div className="tw-loyalty-grid">
          <NumberField settings={settings} field="interval_minutes" help="Minutes between payouts." />
          <NumberField settings={settings} field="points_per_interval" help="Every viewer present, including lurkers." />
          <NumberField settings={settings} field="active_bonus" help="Extra for viewers who chatted recently." />
          <NumberField settings={settings} field="active_window_minutes" help="Minutes a message counts as recent." />
          <NumberField settings={settings} field="subscriber_multiplier" help="Applied to subscribers, from their chat badge." />
          <NumberField settings={settings} field="vip_multiplier" help="Applied to VIPs; the higher multiplier wins." />
          <NumberField settings={settings} field="starting_points" help="Given once to each new viewer." />
        </div>
        <Switch label="Count lurkers" description="Viewers who never chat earn the base amount too. Uses Twitch's chatter list, which needs Acosmibot to be a moderator."
          checked={form.include_lurkers} onChange={(include_lurkers) => set({ include_lurkers })} disabled={!settings.canWrite} />
        <Switch label="Earn while offline" description="Pays the offline amount (plus the active bonus) when you are not live. Watch time only counts while live."
          checked={form.offline_accrual} onChange={(offline_accrual) => set({ offline_accrual })} disabled={!settings.canWrite} />
        {form.offline_accrual && <NumberField settings={settings} field="offline_points_per_interval" />}
      </section>
      <section className="tw-loyalty-card" aria-labelledby="tw-loyalty-bonuses">
        <h2 id="tw-loyalty-bonuses" className="tw-loyalty-card__title">Event bonuses</h2>
        <div className="tw-loyalty-grid">
          <NumberField settings={settings} field="bonus_follow" help="Once per viewer." />
          <NumberField settings={settings} field="bonus_sub" help="To a new subscriber, resubscriber or gift recipient." />
          <NumberField settings={settings} field="bonus_gift_per_sub" help="To the gifter, for each gifted sub." />
          <NumberField settings={settings} field="bonus_cheer_per_100_bits" help="Per 100 bits cheered." />
          <NumberField settings={settings} field="bonus_raid_per_viewer" help="To the raiding streamer, at most 10,000." />
        </div>
      </section>
      <section className="tw-loyalty-card" aria-labelledby="tw-loyalty-rules">
        <h2 id="tw-loyalty-rules" className="tw-loyalty-card__title">Who earns and sharing</h2>
        <Switch label="Exclude the broadcaster" checked={form.exclude_broadcaster}
          onChange={(exclude_broadcaster) => set({ exclude_broadcaster })} disabled={!settings.canWrite} />
        <Switch label="Exclude known bots" description="Nightbot, StreamElements and other common bots. Acosmibot itself never earns."
          checked={form.exclude_known_bots} onChange={(exclude_known_bots) => set({ exclude_known_bots })} disabled={!settings.canWrite} />
        <Switch label="Allow !give" description="Viewers can send points to each other."
          checked={form.give_enabled} onChange={(give_enabled) => set({ give_enabled })} disabled={!settings.canWrite} />
        {form.give_enabled && (
          <div className="tw-loyalty-grid">
            <NumberField settings={settings} field="give_min" />
            <NumberField settings={settings} field="give_tax_percent" help="Percent kept back from each gift." />
          </div>
        )}
        <NumberField settings={settings} field="auto_regular_watch_minutes"
          help="Make viewers regulars after this many minutes of watch time. 0 turns it off." />
        <Switch label="Public leaderboard" description="Shows the top viewers by points and watch time on your public channel page."
          checked={form.leaderboard_public} onChange={(leaderboard_public) => set({ leaderboard_public })} disabled={!settings.canWrite} />
      </section>
      <SettingsSaveBar settings={settings} validationMessage={loyaltySettingsProblem(form) ?? undefined} />
    </div>
  );
};

/* ── Page ───────────────────────────────────────────────────────────────── */

export const LoyaltyPage: React.FC<SectionProps> = ({ channelId, channel, role }) => {
  const settings = useSectionSettings<LoyaltySettings>(channelId, 'loyalty');
  const [tab, setTab] = useState<Tab>('viewers');
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ViewerSort>('points');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<Viewer | null>(null);
  const [excludeLogin, setExcludeLogin] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const isEditor = hasRole(role, 'editor');
  const currency = settings.value?.currency_name || 'points';

  const list = useQuery({
    queryKey: tk(channelId, 'loyalty', 'viewers', search, sort, page),
    queryFn: () => loyaltyApi.viewers(channelId, viewerQuery(search, sort, page)),
    retry: twitchRetry,
    placeholderData: (previous) => previous,
  });
  const viewers = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / LOYALTY_LIMITS.pageSize) - 1);

  const exclude = useChannelMutation({
    mutationFn: (login: string) => loyaltyApi.exclude(channelId, login, true),
    invalidate: [tk(channelId, 'loyalty')],
    successMessage: (result) => `${result.viewer.display_name || result.viewer.login} is excluded from points.`,
    errorMessage: false,
    onSuccess: () => setExcludeLogin(''),
  });
  const reset = useChannelMutation({
    mutationFn: () => loyaltyApi.reset(channelId),
    invalidate: [tk(channelId, 'loyalty')],
    successMessage: (result) => `Reset ${formatNumber(result.reset)} balances to 0.`,
    errorMessage: 'Could not reset the balances.',
    onSuccess: () => setConfirmReset(false),
    onError: () => setConfirmReset(false),
  });

  const searchProblem = searchText.trim() && normalizeViewerSearch(searchText) === null
    ? 'Search by Twitch username: letters, numbers and underscores.' : null;
  const excludeError = exclude.error
    ? (isTwitchApiError(exclude.error, 'not_found') ? 'No Twitch account has that username.' : twitchErrorMessage(exclude.error))
    : null;

  const columns: Column<Viewer>[] = [
    {
      key: 'viewer', header: 'Viewer', primary: true,
      render: (viewer) => (
        <span className="tw-loyalty-viewer">
          <span>{viewer.display_name || viewer.login}</span>
          {viewer.display_name && viewer.display_name.toLowerCase() !== viewer.login && <small className="tw-muted">{viewer.login}</small>}
        </span>
      ),
    },
    { key: 'points', header: currency.charAt(0).toUpperCase() + currency.slice(1), align: 'end',
      render: (viewer) => <span className="tw-loyalty-number">{formatNumber(viewer.points)}</span> },
    { key: 'watch', header: 'Watch time', align: 'end', render: (viewer) => formatWatchMinutes(viewer.watch_minutes) },
    { key: 'messages', header: 'Messages', align: 'end', hideOnMobile: true, render: (viewer) => formatNumber(viewer.message_count) },
    { key: 'seen', header: 'Last seen', hideOnMobile: true, render: (viewer) => formatRelative(viewer.last_seen_at) },
    { key: 'status', header: 'Status', hideHeader: true,
      render: (viewer) => (viewer.excluded ? <StatusChip tone="neutral">Excluded</StatusChip> : null) },
  ];

  return (
    <SectionPage
      title="Loyalty"
      description={`Points viewers earn in ${channel.display_name}'s chat. Viewers check them with !points and !top and send them with !give.`}
      query={combineQueries(list, settings.query)}
      actions={(
        <RoleGate min="broadcaster" role={role}>
          <button type="button" className="btn" onClick={() => setConfirmReset(true)} disabled={reset.isPending}>
            <RotateCcw size={16} aria-hidden="true" /> Reset all balances
          </button>
        </RoleGate>
      )}
    >
      <div className="tw-loyalty-stack">
        {settings.value && !settings.value.enabled && (
          <p className="tw-readonly" role="note">Loyalty points are turned off, so nobody is earning right now. Turn them on in Settings.</p>
        )}
        <Tabs
          label="Loyalty sections" idPrefix="tw-loyalty"
          tabs={[{ id: 'viewers', label: 'Viewers', count: total }, { id: 'settings', label: 'Settings' }]}
          active={tab} onChange={(id) => setTab(id as Tab)}
        />
        <TabPanel idPrefix="tw-loyalty" id="viewers" active={tab}>
          <RecordTable
            rows={viewers} columns={columns} rowKey={(viewer) => viewer.user_id} caption="Viewers"
            onRowClick={setOpen} rowLabel={(viewer) => `Open ${viewer.display_name || viewer.login}`}
            activeKey={open?.user_id ?? null}
            toolbar={(
              <div className="tw-loyalty-toolbar">
                <form
                  className="tw-loyalty-inline" role="search"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (searchProblem) return;
                    setSearch(normalizeViewerSearch(searchText) ?? '');
                    setPage(0);
                  }}
                >
                  <Field label="Search viewers" hideLabel error={searchProblem}>
                    {(control) => (
                      <input {...control} className="form-control" type="search" placeholder="Username starts with…"
                        maxLength={LOYALTY_LIMITS.searchMax + 1} value={searchText} onChange={(event) => setSearchText(event.target.value)} />
                    )}
                  </Field>
                  <button type="submit" className="btn"><Search size={16} aria-hidden="true" /> Search</button>
                  {search && <button type="button" className="btn" onClick={() => { setSearchText(''); setSearch(''); setPage(0); }}>Clear</button>}
                </form>
                <Field label="Sort viewers" hideLabel>
                  {(control) => (
                    <select {...control} className="form-select" value={sort}
                      onChange={(event) => { setSort(event.target.value as ViewerSort); setPage(0); }}>
                      {VIEWER_SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  )}
                </Field>
              </div>
            )}
            footer={total > LOYALTY_LIMITS.pageSize ? (
              <div className="tw-loyalty-pager">
                <span className="tw-muted">
                  {page * LOYALTY_LIMITS.pageSize + 1}–{page * LOYALTY_LIMITS.pageSize + viewers.length} of {formatNumber(total)}
                </span>
                <span className="tw-loyalty-actions">
                  <button type="button" className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                  <button type="button" className="btn" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>Next</button>
                </span>
              </div>
            ) : undefined}
            empty={search ? (
              <EmptyState title="No viewers match" description="No viewer of this channel has a username starting with that." />
            ) : (
              <EmptyState title="No viewers yet" description="Viewers appear here after their first payout or chat message while loyalty is on." />
            )}
          />
          <RoleGate min="editor" role={role}>
            <section className="tw-loyalty-card" aria-labelledby="tw-loyalty-exclude">
              <h2 id="tw-loyalty-exclude" className="tw-loyalty-card__title">Exclude someone</h2>
              <p className="tw-muted">Stop a bot or an alt account from earning points, even if it has never chatted here.</p>
              <form className="tw-loyalty-inline" onSubmit={(event) => {
                event.preventDefault();
                const login = normalizeLogin(excludeLogin);
                if (isValidLogin(login)) exclude.mutate(login);
              }}>
                <UserLookupInput value={excludeLogin} onChange={setExcludeLogin} label="Twitch username"
                  onSubmit={(login) => exclude.mutate(login)} disabled={exclude.isPending} />
                <button type="submit" className="btn" disabled={!isValidLogin(excludeLogin) || exclude.isPending} aria-busy={exclude.isPending}>
                  <UserX size={16} aria-hidden="true" /> Exclude
                </button>
              </form>
              {excludeError && <p className="tw-field__error" role="alert">{excludeError}</p>}
            </section>
          </RoleGate>
        </TabPanel>
        <TabPanel idPrefix="tw-loyalty" id="settings" active={tab}>
          <LoyaltySettingsForm settings={settings} role={role} />
        </TabPanel>
      </div>

      {open && (
        <ViewerDrawer key={open.user_id} channelId={channelId} viewer={open} canEdit={isEditor} currency={currency}
          onClose={() => setOpen(null)} />
      )}

      {confirmReset && (
        <ConfirmTypeDialog
          kicker="Reset loyalty"
          title={`Reset every ${currency} balance to 0?`}
          word="RESET"
          confirmLabel="Reset balances"
          pending={reset.isPending}
          onConfirm={() => reset.mutate()}
          onClose={() => setConfirmReset(false)}
        >
          <p>Every viewer of {channel.display_name} goes back to 0 {currency}. Watch time, exclusions and the store stay as they are. This cannot be undone.</p>
        </ConfirmTypeDialog>
      )}
    </SectionPage>
  );
};
