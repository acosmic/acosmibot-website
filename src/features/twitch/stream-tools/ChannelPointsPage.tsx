/**
 * Channel points (§11.4, §12.8): the channel's custom rewards and what Acosmibot
 * does when one is redeemed.
 *
 * Twitch lets only the app that created a reward change it, so rewards created
 * here ("managed") can be edited, deleted, fulfilled and refunded by Acosmibot;
 * rewards created anywhere else are read-only here, but can still run an action.
 * A redemption of an unmanaged reward is never marked complete or refunded.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { ConfirmDialog, FeatureToggle, NumberInput } from '@/components/ui';
import type { SectionProps } from '../types';
import {
  EditorDrawer,
  EmptyState,
  Field,
  ReadOnlyNotice,
  RecordTable,
  SectionPage,
  SettingsSaveBar,
  StatusChip,
  Switch,
  TemplateField,
  formatNumber,
  isTwitchApiError,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useChannelMutation,
  useSectionSettings,
  type Column,
} from '../shared/ui';
import { rewardsApi } from './api';
import {
  BINDING_ACTIONS,
  EMPTY_BINDING_DRAFT,
  EMPTY_REWARD_DRAFT,
  REWARD_LIMITS,
  TEMPLATE_MAX,
  bindingActionLabel,
  bindingInput,
  bindingProblem,
  describeBinding,
  draftFromBinding,
  draftFromReward,
  rewardCreateInput,
  rewardItemKey,
  rewardItemTitle,
  rewardPatch,
  rewardProblem,
  type BindingAction,
  type BindingDraft,
  type ChannelPointsSettings,
  type RewardDraft,
  type RewardItem,
} from './model';
import './stream-tools.css';

type RewardEditing = { kind: 'new' } | { kind: 'edit'; item: RewardItem } | null;

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export const ChannelPointsPage: React.FC<SectionProps> = ({ channelId, role }) => {
  const list = useQuery({
    queryKey: tk(channelId, 'rewards'),
    queryFn: () => rewardsApi.list(channelId),
    retry: twitchRetry,
  });
  const settings = useSectionSettings<ChannelPointsSettings>(channelId, 'channel_points');
  const items = list.data?.items ?? [];
  const invalidate = [tk(channelId, 'rewards')];

  // Reward (Twitch) drawer
  const [rewardEditing, setRewardEditing] = useState<RewardEditing>(null);
  const [rewardDraft, setRewardDraft] = useState<RewardDraft>(EMPTY_REWARD_DRAFT);
  const [rewardBase, setRewardBase] = useState<RewardDraft>(EMPTY_REWARD_DRAFT);
  const [rewardError, setRewardError] = useState<string | null>(null);
  const [confirmDeleteReward, setConfirmDeleteReward] = useState<RewardItem | null>(null);

  // Binding drawer
  const [bindingFor, setBindingFor] = useState<RewardItem | null>(null);
  const [bindingDraft, setBindingDraft] = useState<BindingDraft>(EMPTY_BINDING_DRAFT);
  const [bindingBase, setBindingBase] = useState<BindingDraft>(EMPTY_BINDING_DRAFT);
  const [bindingError, setBindingError] = useState<string | null>(null);

  const openReward = (item: RewardItem | null) => {
    const draft = item?.reward ? draftFromReward(item.reward) : EMPTY_REWARD_DRAFT;
    setRewardDraft(draft);
    setRewardBase(draft);
    setRewardError(null);
    saveReward.reset();
    setRewardEditing(item ? { kind: 'edit', item } : { kind: 'new' });
  };
  const openBinding = (item: RewardItem) => {
    const draft = draftFromBinding(item.binding);
    setBindingDraft(draft);
    setBindingBase(draft);
    setBindingError(null);
    saveBinding.reset();
    setBindingFor(item);
  };

  const saveReward = useChannelMutation({
    mutationFn: (draft: RewardDraft) => rewardEditing?.kind === 'edit' && rewardEditing.item.reward
      ? rewardsApi.update(channelId, rewardEditing.item.reward.id, rewardPatch(draft, rewardBase))
      : rewardsApi.create(channelId, rewardCreateInput(draft)),
    invalidate,
    successMessage: 'Reward saved on Twitch',
    errorMessage: false,
    onSuccess: () => setRewardEditing(null),
  });
  const removeReward = useChannelMutation({
    mutationFn: (item: RewardItem) => rewardsApi.remove(channelId, rewardItemKey(item)),
    invalidate,
    successMessage: 'Reward deleted',
    errorMessage: 'Could not delete the reward.',
    onSuccess: () => { setConfirmDeleteReward(null); setRewardEditing(null); },
    onError: () => setConfirmDeleteReward(null),
  });
  const saveBinding = useChannelMutation({
    mutationFn: (draft: BindingDraft) => rewardsApi.putBinding(
      channelId, rewardItemKey(bindingFor as RewardItem), bindingInput(draft, bindingFor?.manageable ?? false)),
    invalidate,
    successMessage: 'Action saved',
    errorMessage: false,
    onSuccess: () => setBindingFor(null),
  });
  const removeBinding = useChannelMutation({
    mutationFn: (item: RewardItem) => rewardsApi.removeBinding(channelId, rewardItemKey(item)),
    invalidate,
    successMessage: 'Action removed',
    errorMessage: 'Could not remove the action.',
    onSuccess: () => setBindingFor(null),
  });

  const submitReward = () => {
    const problem = rewardProblem(rewardDraft);
    setRewardError(problem);
    if (!problem) saveReward.mutate(rewardDraft);
  };
  const submitBinding = () => {
    const problem = bindingProblem(bindingDraft);
    setBindingError(problem);
    if (!problem) saveBinding.mutate(bindingDraft);
  };

  const serverMessage = (error: unknown): string | null => {
    if (!error) return null;
    if (isTwitchApiError(error, 'limit_reached')) return 'This channel has reached its limit of reward actions.';
    if (isTwitchApiError(error, 'missing_grant')) return 'Reconnect Acosmibot on the Overview page to allow channel point rewards.';
    if (isTwitchApiError(error, 'invalid_state')) return 'Twitch only lets Acosmibot change rewards that Acosmibot created.';
    return twitchErrorMessage(error);
  };

  const columns: Column<RewardItem>[] = [
    {
      key: 'title', header: 'Reward', primary: true,
      render: (item) => (
        <>
          {item.reward?.background_color && <span className="tw-st-swatch" style={{ background: item.reward.background_color }} aria-hidden="true" />}
          {rewardItemTitle(item)}
        </>
      ),
    },
    { key: 'cost', header: 'Cost', align: 'end', width: '110px', render: (item) => (item.reward ? formatNumber(item.reward.cost) : '') },
    {
      key: 'source', header: 'Created by', width: '150px',
      render: (item) => (item.reward === null
        ? <StatusChip tone="warning">Deleted on Twitch</StatusChip>
        : item.manageable
          ? <StatusChip tone="active">Acosmibot</StatusChip>
          : <StatusChip tone="neutral">Read only</StatusChip>),
    },
    { key: 'state', header: 'On Twitch', hideOnMobile: true, width: '120px', render: (item) => (item.reward ? (item.reward.is_enabled ? (item.reward.is_paused ? 'Paused' : 'On') : 'Off') : '') },
    { key: 'action', header: 'When redeemed', render: (item) => describeBinding(item.binding) },
  ];

  const editingReward = rewardEditing?.kind === 'edit' ? rewardEditing.item : null;
  const numberField = (label: string, field: 'max_per_stream' | 'max_per_user_per_stream' | 'global_cooldown_seconds', help: string, max: number) => (
    <Field label={label} optional help={help}>
      {(control) => (
        <input {...control} className="form-control" type="text" inputMode="numeric" maxLength={String(max).length + 3} value={rewardDraft[field]}
          onChange={(event) => setRewardDraft({ ...rewardDraft, [field]: event.target.value })} />
      )}
    </Field>
  );

  const form = settings.form;

  return (
    <SectionPage
      title="Channel points"
      description="Rewards viewers can redeem with channel points. Acosmibot can create and manage rewards, and run an action when any reward is redeemed."
      query={list}
      actions={(
        <button type="button" className="btn primary" onClick={() => openReward(null)}>
          <Plus size={16} aria-hidden="true" /> New reward
        </button>
      )}
    >
      <div className="tw-st-stack">
        {form && (
          <section className="tw-st-card" aria-labelledby="tw-cp-settings">
            <h2 id="tw-cp-settings" className="tw-st-card__title">Redemption actions</h2>
            {!settings.canWrite && <ReadOnlyNotice required={settings.writeRole} role={role} />}
            <FeatureToggle
              label="Run actions when rewards are redeemed"
              description="Turn this off to pause every action below without changing them."
              enabled={form.enabled} onChange={(enabled) => settings.canWrite && settings.setForm({ enabled })}
            />
          </section>
        )}
        <RecordTable
          rows={items} columns={columns} rowKey={rewardItemKey} caption="Channel point rewards"
          onRowClick={openBinding} rowLabel={(item) => `Set the action for ${rewardItemTitle(item)}`}
          activeKey={bindingFor ? rewardItemKey(bindingFor) : null}
          rowActions={(item) => (item.manageable && item.reward ? (
            <div className="tw-st-row-actions">
              <button type="button" className="btn" aria-label={`Edit ${item.reward.title} on Twitch`} onClick={() => openReward(item)}>
                <Pencil size={16} aria-hidden="true" /> Edit reward
              </button>
            </div>
          ) : null)}
          footer={<p className="tw-muted">{items.filter((item) => item.binding).length} of {list.data?.binding_limit ?? 50} reward actions used. Rewards marked Read only were created outside Acosmibot: Twitch only lets their creator change them or mark their redemptions done.</p>}
          empty={(
            <EmptyState title="No rewards yet"
              description="Create a reward here, or create one on Twitch and come back to attach an action to it."
              action={<button type="button" className="btn primary" onClick={() => openReward(null)}>New reward</button>} />
          )}
        />
      </div>
      <SettingsSaveBar settings={settings} />

      <EditorDrawer
        open={rewardEditing !== null}
        title={editingReward ? `Edit ${rewardItemTitle(editingReward)}` : 'New reward'}
        description="Saved on Twitch right away. Acosmibot can fulfil or refund redemptions of rewards it creates."
        onClose={() => setRewardEditing(null)}
        onSubmit={submitReward}
        submitting={saveReward.isPending}
        error={rewardError ?? serverMessage(saveReward.error)}
        dirty={!sameJson(rewardDraft, rewardBase)}
        submitLabel={editingReward ? 'Save reward' : 'Create reward'}
        secondaryAction={editingReward ? (
          <button type="button" className="btn" onClick={() => setConfirmDeleteReward(editingReward)}>Delete reward</button>
        ) : undefined}
      >
        <Field label="Title" help={`At most ${REWARD_LIMITS.titleMax} characters. Twitch requires a different title for each reward.`}>
          {(control) => (
            <input {...control} className="form-control" type="text" maxLength={REWARD_LIMITS.titleMax} value={rewardDraft.title}
              onChange={(event) => setRewardDraft({ ...rewardDraft, title: event.target.value })} />
          )}
        </Field>
        <Field label="Cost in channel points">
          {(control) => (
            <NumberInput {...control} className="form-control" min={REWARD_LIMITS.costMin} max={REWARD_LIMITS.costMax}
              value={rewardDraft.cost === '' ? null : Number(rewardDraft.cost)}
              onValueChange={(cost) => setRewardDraft({ ...rewardDraft, cost: String(cost) })}
              onEmpty={() => setRewardDraft({ ...rewardDraft, cost: '' })} />
          )}
        </Field>
        <Switch label="Viewers can redeem it" checked={rewardDraft.is_enabled} onChange={(is_enabled) => setRewardDraft({ ...rewardDraft, is_enabled })} />
        <Switch label="Ask the viewer for text" description="The text is available to the action as $(input), and is the song request text for a song request."
          checked={rewardDraft.is_user_input_required} onChange={(is_user_input_required) => setRewardDraft({ ...rewardDraft, is_user_input_required })} />
        {rewardDraft.is_user_input_required && (
          <Field label="Prompt" optional help={`What the viewer sees when asked. At most ${REWARD_LIMITS.promptMax} characters.`}>
            {(control) => (
              <textarea {...control} className="form-control" rows={2} maxLength={REWARD_LIMITS.promptMax} value={rewardDraft.prompt}
                onChange={(event) => setRewardDraft({ ...rewardDraft, prompt: event.target.value })} />
            )}
          </Field>
        )}
        <Switch label="Skip the request queue"
          description="Twitch marks each redemption done immediately. Acosmibot can then no longer refund a redemption whose action fails."
          checked={rewardDraft.should_redemptions_skip_request_queue}
          onChange={(should_redemptions_skip_request_queue) => setRewardDraft({ ...rewardDraft, should_redemptions_skip_request_queue })} />
        <Field label="Colour" optional help="A hex code like #9147FF. Empty lets Twitch pick one.">
          {(control) => (
            <input {...control} className="form-control" type="text" maxLength={7} value={rewardDraft.background_color}
              onChange={(event) => setRewardDraft({ ...rewardDraft, background_color: event.target.value })} />
          )}
        </Field>
        {numberField('Redemptions per stream', 'max_per_stream', 'Empty for no limit.', REWARD_LIMITS.perStreamMax)}
        {numberField('Redemptions per viewer per stream', 'max_per_user_per_stream', 'Empty for no limit.', REWARD_LIMITS.perStreamMax)}
        {numberField('Cooldown in seconds', 'global_cooldown_seconds', 'Empty for no cooldown. Twitch shows cooldowns of 60 seconds or more.', REWARD_LIMITS.cooldownMax)}
      </EditorDrawer>

      <EditorDrawer
        open={bindingFor !== null}
        title={bindingFor ? `Action for ${rewardItemTitle(bindingFor)}` : 'Action'}
        description="What Acosmibot does each time a viewer redeems this reward."
        onClose={() => setBindingFor(null)}
        onSubmit={submitBinding}
        submitting={saveBinding.isPending}
        submitDisabled={bindingFor?.reward === null}
        error={bindingError ?? serverMessage(saveBinding.error)}
        dirty={!sameJson(bindingDraft, bindingBase)}
        submitLabel="Save action"
        secondaryAction={bindingFor?.binding ? (
          <button type="button" className="btn" disabled={removeBinding.isPending} onClick={() => removeBinding.mutate(bindingFor)}>Remove action</button>
        ) : undefined}
      >
        {bindingFor?.reward === null && (
          <p className="tw-muted" role="status">This reward no longer exists on Twitch. Remove its action to tidy up.</p>
        )}
        <Field label="When redeemed">
          {(control) => (
            <select {...control} className="form-select" value={bindingDraft.action}
              onChange={(event) => setBindingDraft({ ...bindingDraft, action: event.target.value as BindingAction })}>
              {BINDING_ACTIONS.map((action) => <option key={action.value} value={action.value}>{action.label}</option>)}
            </select>
          )}
        </Field>
        <p className="tw-muted">{BINDING_ACTIONS.find((action) => action.value === bindingDraft.action)?.description}</p>
        {bindingDraft.action === 'chat_message' && (
          <TemplateField
            label="Message" value={bindingDraft.template} maxLength={TEMPLATE_MAX} context="alert"
            contextVars={['user', 'reward', 'input']}
            issues={bindingError === null && saveBinding.error && isTwitchApiError(saveBinding.error, 'validation_failed')
              ? ['This message has a problem. Check the variables and the length.'] : []}
            rows={3} onChange={(template) => setBindingDraft({ ...bindingDraft, template })}
          />
        )}
        {bindingDraft.action === 'add_points' && (
          <Field label="Points to give" help="A whole number from 1 to 1,000,000.">
            {(control) => (
              <NumberInput {...control} className="form-control" min={1} max={REWARD_LIMITS.pointsMax}
                value={bindingDraft.amount === '' ? null : Number(bindingDraft.amount)}
                onValueChange={(amount) => setBindingDraft({ ...bindingDraft, amount: String(amount) })}
                onEmpty={() => setBindingDraft({ ...bindingDraft, amount: '' })} />
            )}
          </Field>
        )}
        {bindingDraft.action === 'counter' && (
          <>
            <Field label="Counter name" help="Letters, numbers, - and _. A new counter is created the first time.">
              {(control) => (
                <input {...control} className="form-control" type="text" maxLength={40} value={bindingDraft.counter_name}
                  onChange={(event) => setBindingDraft({ ...bindingDraft, counter_name: event.target.value })} />
              )}
            </Field>
            <Field label="Change" help="+1 adds one, -1 subtracts one, =10 sets it to 10, reset sets it to 0.">
              {(control) => (
                <input {...control} className="form-control" type="text" maxLength={20} value={bindingDraft.counter_op}
                  onChange={(event) => setBindingDraft({ ...bindingDraft, counter_op: event.target.value })} />
              )}
            </Field>
          </>
        )}
        {bindingDraft.action === 'sound' && (
          <Field label="Sound link" help="A direct https:// link to an audio file that can play in OBS.">
            {(control) => (
              <input {...control} className="form-control" type="url" maxLength={REWARD_LIMITS.soundUrlMax} value={bindingDraft.sound_url}
                onChange={(event) => setBindingDraft({ ...bindingDraft, sound_url: event.target.value })} />
            )}
          </Field>
        )}
        {bindingFor?.manageable ? (
          <Switch label="Mark redemptions done automatically"
            description="Done when the action works. If it fails, the redemption is canceled and Twitch gives the points back."
            checked={bindingDraft.auto_fulfill} onChange={(auto_fulfill) => setBindingDraft({ ...bindingDraft, auto_fulfill })} />
        ) : (
          <p className="tw-muted">
            This reward was not created by Acosmibot, so Twitch does not let Acosmibot mark its redemptions done or give points back. The action still runs.
          </p>
        )}
        <Switch label="Action is on" checked={bindingDraft.enabled} onChange={(enabled) => setBindingDraft({ ...bindingDraft, enabled })} />
        <p className="tw-muted">Action in use: {bindingActionLabel(bindingDraft.action)}.</p>
      </EditorDrawer>

      {confirmDeleteReward && (
        <ConfirmDialog
          kicker="Delete reward" title={`Delete ${rewardItemTitle(confirmDeleteReward)}?`} confirmLabel="Delete reward"
          pending={removeReward.isPending}
          onConfirm={() => removeReward.mutate(confirmDeleteReward)} onClose={() => setConfirmDeleteReward(null)}
        >
          <p>The reward is removed from Twitch and its action is removed too.</p>
        </ConfirmDialog>
      )}
    </SectionPage>
  );
};
