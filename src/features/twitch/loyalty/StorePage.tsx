/**
 * Store (§11.4, §12.4): the redemption queue (fulfil, refund, reject), the item
 * editor, and the store settings. Refunds and rejections return the points and
 * the stock exactly once; a second click answers "already handled".
 */
import React, { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ExternalLink, Plus, RefreshCw } from 'lucide-react';
import { ConfirmDialog, FeatureToggle, NumberInput } from '@/components/ui';
import type { SectionProps, SettingsSectionResponse } from '../types';
import {
  DurationInput,
  EditorDrawer,
  EmptyState,
  Field,
  LevelSelect,
  ReadOnlyNotice,
  RecordTable,
  RoleGate,
  SectionPage,
  SettingsSaveBar,
  StatusChip,
  Switch,
  TabPanel,
  Tabs,
  TemplateField,
  combineQueries,
  formatNumber,
  formatRelative,
  hasRole,
  isTwitchApiError,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useChannelMutation,
  useLevelLabel,
  useSectionSettings,
  twitchApi,
  channelPath,
  type Column,
} from '../shared/ui';
import { storeApi } from './api';
import {
  ACTION_LABELS,
  EMPTY_ITEM_DRAFT,
  ITEM_KINDS,
  STATUS_VIEW,
  STORE_LIMITS,
  describeStock,
  draftFromItem,
  itemInputFromDraft,
  itemProblem,
  kindLabel,
  redemptionActions,
  redemptionQuery,
  sameItemDraft,
  type Redemption,
  type RedemptionAction,
  type RedemptionStatus,
  type StoreItem,
  type StoreItemDraft,
  type StoreItemKind,
  type StoreSettings,
} from './model';
import './loyalty.css';

type Tab = 'redemptions' | 'items' | 'settings';
type Editing = { kind: 'new' } | { kind: 'edit'; item: StoreItem } | null;
const STATUS_FILTERS: Array<{ value: RedemptionStatus | 'all'; label: string }> = [
  { value: 'pending', label: 'Pending' }, { value: 'fulfilled', label: 'Fulfilled' }, { value: 'refunded', label: 'Refunded' },
  { value: 'rejected', label: 'Rejected' }, { value: 'all', label: 'All' },
];

export const StorePage: React.FC<SectionProps> = ({ channelId, channel, role }) => {
  const settings = useSectionSettings<StoreSettings>(channelId, 'store');
  const loyaltyOn = useQuery({
    queryKey: tk(channelId, 'settings', 'loyalty'),
    queryFn: () => twitchApi.get<SettingsSectionResponse<{ enabled: boolean; currency_name: string }>>(
      channelPath(channelId, '/settings/loyalty')),
    retry: twitchRetry,
  });
  const currency = loyaltyOn.data?.value.currency_name || 'points';
  const levelLabel = useLevelLabel();
  const isEditor = hasRole(role, 'editor');
  const [tab, setTab] = useState<Tab>('redemptions');
  const [status, setStatus] = useState<RedemptionStatus | 'all'>('pending');
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState<StoreItemDraft>(EMPTY_ITEM_DRAFT);
  const [base, setBase] = useState<StoreItemDraft>(EMPTY_ITEM_DRAFT);
  const [clientError, setClientError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StoreItem | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ redemption: Redemption; action: RedemptionAction } | null>(null);

  const items = useQuery({
    queryKey: tk(channelId, 'store', 'items'),
    queryFn: () => storeApi.items(channelId),
    retry: twitchRetry,
  });
  const redemptions = useInfiniteQuery({
    queryKey: tk(channelId, 'store', 'redemptions', status),
    queryFn: ({ pageParam }) => storeApi.redemptions(channelId, redemptionQuery(status, pageParam)),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.next_before_id,
    retry: twitchRetry,
    refetchInterval: 30_000,
  });
  const queue = redemptions.data?.pages.flatMap((pageData) => pageData.items) ?? [];
  const itemRows = items.data?.items ?? [];
  const itemLimit = items.data?.limit ?? 100;

  const open = (item: StoreItem | null) => {
    const next = item ? draftFromItem(item) : EMPTY_ITEM_DRAFT;
    setDraft(next);
    setBase(next);
    setClientError(null);
    save.reset();
    setEditing(item ? { kind: 'edit', item } : { kind: 'new' });
  };

  const save = useChannelMutation({
    mutationFn: (value: StoreItemDraft) => {
      const input = itemInputFromDraft(value);
      return editing?.kind === 'edit' ? storeApi.update(channelId, editing.item.id, input) : storeApi.create(channelId, input);
    },
    invalidate: [tk(channelId, 'store', 'items')],
    successMessage: 'Store item saved',
    errorMessage: false,
    onSuccess: () => setEditing(null),
  });
  const remove = useChannelMutation({
    mutationFn: (item: StoreItem) => storeApi.remove(channelId, item.id),
    invalidate: [tk(channelId, 'store', 'items')],
    successMessage: (_data, item) => `${item.name} deleted`,
    errorMessage: 'Could not delete the item.',
    onSuccess: () => { setConfirmDelete(null); setEditing(null); },
    onError: () => setConfirmDelete(null),
  });
  const act = useChannelMutation({
    mutationFn: ({ redemption, action }: { redemption: Redemption; action: RedemptionAction }) =>
      storeApi.setStatus(channelId, redemption.id, action),
    invalidate: [tk(channelId, 'store'), tk(channelId, 'loyalty')],
    successMessage: (result, { action }) => (action === 'fulfilled'
      ? `${result.redemption.item_name} marked fulfilled.`
      : `${result.redemption.login} got ${formatNumber(result.redemption.cost)} ${currency} back.`),
    errorMessage: false,
    onSuccess: () => setConfirmAction(null),
    onError: () => {
      setConfirmAction(null);
      void redemptions.refetch();
    },
  });

  const submit = () => {
    const problem = itemProblem(draft);
    setClientError(problem);
    if (!problem) save.mutate(draft);
  };
  const saveError = save.error
    ? isTwitchApiError(save.error, 'name_taken') ? 'Another item already has that name.'
      : isTwitchApiError(save.error, 'limit_reached') ? `A channel can have at most ${itemLimit} store items.`
        : twitchErrorMessage(save.error)
    : null;
  const actError = act.error
    ? isTwitchApiError(act.error, 'invalid_state') ? 'Someone already handled that redemption; the list is up to date now.'
      : twitchErrorMessage(act.error)
    : null;
  const templateIssues = isTwitchApiError(save.error, 'validation_failed')
    ? ((save.error.details as { templates?: Array<{ issues?: Array<{ message?: string }> }> } | undefined)?.templates?.[0]?.issues ?? [])
      .map((issue) => issue.message ?? 'This message has a problem.')
    : [];

  const queueColumns: Column<Redemption>[] = [
    { key: 'item', header: 'Item', primary: true, render: (row) => row.item_name },
    { key: 'viewer', header: 'Viewer', render: (row) => row.login },
    { key: 'input', header: 'Message', hideOnMobile: true,
      render: (row) => (row.user_input ? <span className="tw-loyalty-text" title={row.user_input}>{row.user_input}</span> : <span className="tw-muted">—</span>) },
    { key: 'cost', header: 'Cost', align: 'end', render: (row) => <span className="tw-loyalty-number">{formatNumber(row.cost)}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusChip tone={STATUS_VIEW[row.status].tone}>{STATUS_VIEW[row.status].label}</StatusChip> },
    { key: 'when', header: 'When', hideOnMobile: true, render: (row) => formatRelative(row.created_at) },
  ];
  const itemColumns: Column<StoreItem>[] = [
    { key: 'name', header: 'Item', primary: true, render: (item) => item.name },
    { key: 'kind', header: 'Type', hideOnMobile: true, render: (item) => kindLabel(item.kind) },
    { key: 'cost', header: 'Cost', align: 'end', render: (item) => <span className="tw-loyalty-number">{formatNumber(item.cost)}</span> },
    { key: 'stock', header: 'Stock', hideOnMobile: true, render: (item) => describeStock(item.stock) },
    { key: 'level', header: 'Who can redeem', hideOnMobile: true, render: (item) => levelLabel(item.level) },
    { key: 'enabled', header: 'Status', render: (item) => (item.enabled
      ? <StatusChip tone="active">On sale</StatusChip> : <StatusChip tone="neutral">Hidden</StatusChip>) },
  ];

  const kind = ITEM_KINDS.find((entry) => entry.value === draft.kind);
  const storeOn = Boolean(settings.value?.enabled);
  const publicUrl = `/t/${channel.login}/store`;

  return (
    <SectionPage
      title="Store"
      description={`Viewers spend their ${currency} on these items with !redeem <item> in chat. !store links the list.`}
      query={combineQueries(items, settings.query)}
      actions={(
        <RoleGate min="editor" role={role}>
          <button type="button" className="btn primary" onClick={() => { setTab('items'); open(null); }} disabled={itemRows.length >= itemLimit}>
            <Plus size={16} aria-hidden="true" /> Add item
          </button>
        </RoleGate>
      )}
    >
      <div className="tw-loyalty-stack">
        {settings.value && !storeOn && (
          <p className="tw-readonly" role="note">The store is closed: !redeem does nothing until you open it in Settings.</p>
        )}
        {storeOn && loyaltyOn.data && !loyaltyOn.data.value.enabled && (
          <p className="tw-readonly" role="note">Loyalty points are turned off, so nothing can be redeemed until they are on again.</p>
        )}
        <Tabs
          label="Store sections" idPrefix="tw-store"
          tabs={[
            { id: 'redemptions', label: 'Redemptions' },
            { id: 'items', label: 'Items', count: itemRows.length },
            { id: 'settings', label: 'Settings' },
          ]}
          active={tab} onChange={(id) => setTab(id as Tab)}
        />

        <TabPanel idPrefix="tw-store" id="redemptions" active={tab}>
          {redemptions.isError ? (
            <div className="tw-inline-failed" role="alert">
              <span>The redemption queue didn't load.</span>
              <button type="button" className="btn" onClick={() => void redemptions.refetch()}>
                <RefreshCw size={16} aria-hidden="true" /> Retry
              </button>
            </div>
          ) : (
            <RecordTable
              rows={queue} columns={queueColumns} rowKey={(row) => row.id} caption="Redemptions"
              toolbar={(
                <div className="tw-loyalty-toolbar">
                  <Field label="Show" hideLabel>
                    {(control) => (
                      <select {...control} className="form-select" value={status}
                        onChange={(event) => setStatus(event.target.value as RedemptionStatus | 'all')}>
                        {STATUS_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    )}
                  </Field>
                  <button type="button" className="btn" onClick={() => void redemptions.refetch()} disabled={redemptions.isFetching}>
                    <RefreshCw size={16} aria-hidden="true" /> Refresh
                  </button>
                </div>
              )}
              rowActions={(row) => (
                <span className="tw-loyalty-actions">
                  {redemptionActions(row.status).map((action) => (
                    <button key={action} type="button" className={`btn${action === 'fulfilled' ? ' primary' : ''}`}
                      disabled={act.isPending}
                      onClick={() => (action === 'fulfilled' ? act.mutate({ redemption: row, action }) : setConfirmAction({ redemption: row, action }))}>
                      {ACTION_LABELS[action]}
                    </button>
                  ))}
                </span>
              )}
              footer={(
                <>
                  {actError && <p className="tw-field__error" role="alert">{actError}</p>}
                  {redemptions.hasNextPage && (
                    <button type="button" className="btn" onClick={() => void redemptions.fetchNextPage()} disabled={redemptions.isFetchingNextPage}>
                      {redemptions.isFetchingNextPage ? 'Loading…' : 'Load more'}
                    </button>
                  )}
                </>
              )}
              empty={redemptions.isPending ? <p className="tw-muted">Loading…</p> : (
                <EmptyState
                  title={status === 'pending' ? 'Nothing waiting' : 'No redemptions here'}
                  description={status === 'pending'
                    ? 'Manual rewards that viewers redeem show up here for you to fulfil. Sounds and chat messages fulfil themselves.'
                    : 'Redemptions with this status appear here.'}
                />
              )}
            />
          )}
        </TabPanel>

        <TabPanel idPrefix="tw-store" id="items" active={tab}>
          {!isEditor && <ReadOnlyNotice required="editor" role={role} what="the store items" />}
          <RecordTable
            rows={itemRows} columns={itemColumns} rowKey={(item) => item.id} caption="Store items"
            onRowClick={isEditor ? open : undefined} rowLabel={(item) => `Edit ${item.name}`}
            activeKey={editing?.kind === 'edit' ? editing.item.id : null}
            footer={<p className="tw-muted">{itemRows.length} of {itemLimit} items.</p>}
            empty={(
              <EmptyState title="No items yet"
                description="Add a reward such as “Hydrate”, a sound effect for the alerts overlay, or a chat message."
                action={isEditor ? <button type="button" className="btn primary" onClick={() => open(null)}>Add item</button> : undefined} />
            )}
          />
        </TabPanel>

        <TabPanel idPrefix="tw-store" id="settings" active={tab}>
          {settings.form && (
            <section className="tw-loyalty-card" aria-labelledby="tw-store-settings">
              <h2 id="tw-store-settings" className="tw-loyalty-card__title">Store settings</h2>
              {!settings.canWrite && <ReadOnlyNotice required={settings.writeRole} role={role} />}
              <FeatureToggle label="Store open" description="Viewers can use !store and !redeem. Needs loyalty points to be on."
                enabled={settings.form.enabled} onChange={(enabled) => settings.canWrite && settings.setForm({ enabled })} />
              <TemplateField
                label="Message after a redemption" value={settings.form.redeem_template} maxLength={STORE_LIMITS.templateMax}
                context="other" contextVars={['user', 'item', 'cost']} field="store.redeem_template"
                issues={settings.issuesFor('store.redeem_template')} disabled={!settings.canWrite} rows={2}
                onChange={(redeem_template) => settings.setForm({ redeem_template })}
                help="Leave it empty to redeem silently."
              />
              <Switch label="Public store page" description="Lists the items on your public channel page."
                checked={settings.form.public_page} disabled={!settings.canWrite}
                onChange={(public_page) => settings.setForm({ public_page })} />
              {storeOn && settings.value?.public_page && (
                <a className="btn" href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={16} aria-hidden="true" /> Open the public store<span className="visually-hidden"> (opens in a new tab)</span>
                </a>
              )}
            </section>
          )}
          <SettingsSaveBar settings={settings} />
        </TabPanel>
      </div>

      <EditorDrawer
        open={editing !== null}
        title={editing?.kind === 'edit' ? `Edit ${editing.item.name}` : 'New store item'}
        onClose={() => setEditing(null)}
        onSubmit={submit}
        submitting={save.isPending}
        error={clientError ?? saveError}
        dirty={!sameItemDraft(draft, base)}
        submitLabel={editing?.kind === 'edit' ? 'Save item' : 'Create item'}
        secondaryAction={editing?.kind === 'edit' ? (
          <button type="button" className="btn" onClick={() => setConfirmDelete(editing.item)}>Delete</button>
        ) : undefined}
      >
        <Field label="Name" help="Viewers type this after !redeem.">
          {(control) => (
            <input {...control} className="form-control" maxLength={STORE_LIMITS.nameMax} value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          )}
        </Field>
        <Field label="Description" optional>
          {(control) => (
            <input {...control} className="form-control" maxLength={STORE_LIMITS.descriptionMax} value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          )}
        </Field>
        <Field label="Type" help={kind?.description}>
          {(control) => (
            <select {...control} className="form-select" value={draft.kind}
              onChange={(event) => setDraft({ ...draft, kind: event.target.value as StoreItemKind })}>
              {ITEM_KINDS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          )}
        </Field>
        {draft.kind === 'sound' && (
          <Field label="Sound file link" help="An https link to an .mp3, .ogg or .wav file. The alerts overlay plays it.">
            {(control) => (
              <input {...control} className="form-control" type="url" inputMode="url" maxLength={STORE_LIMITS.soundUrlMax}
                placeholder="https://…/sound.mp3" value={draft.sound_url}
                onChange={(event) => setDraft({ ...draft, sound_url: event.target.value })} />
            )}
          </Field>
        )}
        {draft.kind === 'message' && (
          <TemplateField
            label="Message to post" value={draft.message_template} maxLength={STORE_LIMITS.templateMax} context="other"
            contextVars={['user', 'item', 'cost']} field="store.redeem_template" issues={templateIssues} rows={2}
            onChange={(message_template) => setDraft({ ...draft, message_template })}
          />
        )}
        <Field label={`Cost in ${currency}`}>
          {(control) => (
            <NumberInput {...control} className="form-control" min={STORE_LIMITS.costMin} max={STORE_LIMITS.costMax} value={draft.cost}
              onValueChange={(cost) => setDraft({ ...draft, cost })} />
          )}
        </Field>
        <LevelSelect value={draft.level} onChange={(level) => setDraft({ ...draft, level })} label="Who can redeem it" />
        <div className="tw-loyalty-grid">
          <Field label="Stock" optional help="Empty means unlimited.">
            {(control) => (
              <input {...control} className="form-control" inputMode="numeric" value={draft.stock}
                onChange={(event) => setDraft({ ...draft, stock: event.target.value })} />
            )}
          </Field>
          <Field label="Per-viewer limit" optional help="Open or fulfilled redemptions per viewer.">
            {(control) => (
              <input {...control} className="form-control" inputMode="numeric" value={draft.per_user_limit}
                onChange={(event) => setDraft({ ...draft, per_user_limit: event.target.value })} />
            )}
          </Field>
        </div>
        <DurationInput label="Cooldown per viewer" seconds={draft.user_cooldown_s} min={0} max={STORE_LIMITS.cooldownMax}
          onChange={(user_cooldown_s) => setDraft({ ...draft, user_cooldown_s })} />
        <DurationInput label="Cooldown for everyone" seconds={draft.global_cooldown_s} min={0} max={STORE_LIMITS.cooldownMax}
          onChange={(global_cooldown_s) => setDraft({ ...draft, global_cooldown_s })} />
        {draft.kind !== 'song' && (
          <Switch label="Ask the viewer for a message" description="Viewers add up to 200 characters after the item name; it shows in the queue."
            checked={draft.requires_input} onChange={(requires_input) => setDraft({ ...draft, requires_input })} />
        )}
        <Switch label="On sale" checked={draft.enabled} onChange={(enabled) => setDraft({ ...draft, enabled })} />
        <Field label="Sort order" help="Lower numbers come first.">
          {(control) => (
            <NumberInput {...control} className="form-control" min={-1_000_000} max={1_000_000} value={draft.sort_order}
              onValueChange={(sort_order) => setDraft({ ...draft, sort_order })} />
          )}
        </Field>
      </EditorDrawer>

      {confirmDelete && (
        <ConfirmDialog
          kicker="Delete item" title={`Delete ${confirmDelete.name}?`} confirmLabel="Delete"
          pending={remove.isPending} onConfirm={() => remove.mutate(confirmDelete)} onClose={() => setConfirmDelete(null)}
        >
          <p>Viewers can no longer redeem it. Past redemptions stay in the queue.</p>
        </ConfirmDialog>
      )}
      {confirmAction && (
        <ConfirmDialog
          kicker={confirmAction.action === 'refunded' ? 'Refund' : 'Reject'}
          title={`${ACTION_LABELS[confirmAction.action]} ${confirmAction.redemption.item_name} for ${confirmAction.redemption.login}?`}
          confirmLabel={ACTION_LABELS[confirmAction.action]}
          pending={act.isPending}
          onConfirm={() => act.mutate(confirmAction)}
          onClose={() => setConfirmAction(null)}
        >
          <p>{formatNumber(confirmAction.redemption.cost)} {currency} go back to {confirmAction.redemption.login}, and limited stock is put back. This happens only once.</p>
        </ConfirmDialog>
      )}
    </SectionPage>
  );
};
