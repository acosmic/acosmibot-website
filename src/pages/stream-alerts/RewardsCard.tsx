import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  streamAlertsApi,
  StreamAlertAccount,
  StreamEffectName,
  StreamReward,
  StreamRewardEffectOption,
  StreamRewardMapping,
  StreamRewards,
  StreamRewardTrigger,
} from '@/api/streamAlerts';
import {
  effectsWithoutReward,
  isTwitchNotConnected,
  PageNotice,
  plainError,
  rewardCost,
  rewardNote,
  rewardsQueryKey,
  twitchQueryKey,
  withRewardMapping,
} from '@/utils/streamAlertAccounts';

const TRIGGERS: { value: StreamRewardTrigger; label: string }[] = [
  { value: 'redeemed', label: 'When it is redeemed' },
  { value: 'fulfilled', label: 'When a mod marks it done' },
];

type RowPhase = { kind: 'idle' | 'saving' | 'saved' } | { kind: 'error'; text: string };

/**
 * One reward: what it does and, once it does something, when. A change is shown at once and
 * saved by itself; if the save fails the row goes back to what the API last confirmed.
 */
const RewardRow: React.FC<{
  accountId: number;
  reward: StreamReward;
  effects: StreamRewardEffectOption[];
  /** Puts a confirmed mapping into the loaded list. */
  onSaved: (rewardId: string, mapping: StreamRewardMapping | null) => Promise<void>;
}> = ({ accountId, reward, effects, onSaved }) => {
  /** The choice being saved. `undefined` means there is none and the row shows the loaded mapping. */
  const [draft, setDraft] = useState<StreamRewardMapping | null | undefined>(undefined);
  const [phase, setPhase] = useState<RowPhase>({ kind: 'idle' });
  /** Saves for one reward go out one at a time, and a newer choice replaces one still waiting. */
  const queue = useRef<{ waiting: boolean; next: StreamRewardMapping | null; running: boolean }>({ waiting: false, next: null, running: false });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const mapping = draft !== undefined ? draft : reward.mapping;
  const note = rewardNote(reward);

  const save = async (next: StreamRewardMapping | null) => {
    setDraft(next);
    setPhase({ kind: 'saving' });
    const line = queue.current;
    line.next = next;
    line.waiting = true;
    if (line.running) return;
    line.running = true;
    try {
      while (line.waiting) {
        const sending = line.next;
        line.waiting = false;
        const result = await streamAlertsApi.setRewardMapping(accountId, reward.id, sending ?? { effect: null });
        await onSaved(reward.id, result.mapping === undefined ? sending : result.mapping);
      }
      if (mounted.current) {
        setDraft(undefined);
        setPhase({ kind: 'saved' });
      }
    } catch (error) {
      line.waiting = false;
      if (mounted.current) {
        // Dropping the draft is the roll back: the row shows the last confirmed mapping again.
        setDraft(undefined);
        setPhase({ kind: 'error', text: `Could not save, so this reward is unchanged: ${plainError(error)}` });
      }
    } finally {
      line.running = false;
    }
  };

  const chooseEffect = (value: string) => {
    const effect = effects.find((item) => item.name === value);
    save(effect ? { effect: effect.name, on: mapping?.on ?? 'redeemed' } : null);
  };
  const chooseTrigger = (value: string) => {
    if (!mapping) return;
    save({ effect: mapping.effect, on: value === 'fulfilled' ? 'fulfilled' : 'redeemed' });
  };

  return (
    <li className="stream-rewards__row" aria-busy={phase.kind === 'saving'}>
      <div className="stream-rewards__name">
        <strong>{reward.title}</strong>
        <span>
          {rewardCost(reward.cost)}
          {note && <em>{note}</em>}
        </span>
      </div>
      <div className="stream-rewards__choices">
        <label>
          <span>What it does</span>
          <select
            className="form-control"
            aria-label={`What ${reward.title} does`}
            value={mapping?.effect ?? ''}
            onChange={(event) => chooseEffect(event.target.value)}
          >
            <option value="">Nothing</option>
            {effects.map((effect) => <option key={effect.name} value={effect.name}>{effect.label}</option>)}
            {/* A mapping to an effect this page was not told about still shows as what it is. */}
            {mapping && !effects.some((effect) => effect.name === mapping.effect) && (
              <option value={mapping.effect}>{mapping.effect}</option>
            )}
          </select>
        </label>
        {mapping && (
          <label>
            <span>When it plays</span>
            <select
              className="form-control"
              aria-label={`When ${reward.title} plays`}
              value={mapping.on === 'fulfilled' ? 'fulfilled' : 'redeemed'}
              onChange={(event) => chooseTrigger(event.target.value)}
            >
              {TRIGGERS.map((trigger) => <option key={trigger.value} value={trigger.value}>{trigger.label}</option>)}
            </select>
          </label>
        )}
      </div>
      {phase.kind !== 'idle' && (
        <p
          className={`stream-rewards__state is-${phase.kind}`}
          role={phase.kind === 'error' ? 'alert' : 'status'}
        >
          {phase.kind === 'saving' && 'Saving…'}
          {phase.kind === 'saved' && 'Saved'}
          {phase.kind === 'error' && phase.text}
        </p>
      )}
    </li>
  );
};

/** The rewards of the connected channel. Mounted only while Twitch is connected and working. */
const RewardsList: React.FC<{ account: StreamAlertAccount }> = ({ account }) => {
  const queryClient = useQueryClient();
  const accountId = account.id;
  const twitchKey = twitchQueryKey(accountId);
  const rewardsKey = rewardsQueryKey(accountId);
  const isOwner = account.role === 'owner';
  const owner = account.owner_username.trim() || 'the owner';
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const [createErrors, setCreateErrors] = useState<Partial<Record<StreamEffectName, string>>>({});

  const list = useQuery({
    queryKey: rewardsKey,
    queryFn: () => streamAlertsApi.getRewards(accountId),
    // Read from Twitch each time the card appears, and forgotten when it goes (after a disconnect
    // the mappings are gone, so an old copy must not be shown on the next connect).
    gcTime: 0,
    staleTime: 30_000,
    retry: (failures, error) => !isTwitchNotConnected(error) && failures < 1,
  });

  // A failed read can mean the connection itself has gone, so have the Twitch card look again.
  const failedAt = list.isError ? list.errorUpdatedAt : 0;
  useEffect(() => {
    if (failedAt) queryClient.invalidateQueries({ queryKey: twitchKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failedAt]);

  const applyMapping = async (rewardId: string, mapping: StreamRewardMapping | null) => {
    // A read of the list that began before the save would put the old choice back, so stop it first.
    await queryClient.cancelQueries({ queryKey: rewardsKey });
    queryClient.setQueryData<StreamRewards>(rewardsKey, (old) => (
      old ? { ...old, rewards: withRewardMapping(old.rewards, rewardId, mapping) } : old
    ));
  };

  const create = useMutation({
    mutationFn: (effect: StreamRewardEffectOption) => streamAlertsApi.createReward(accountId, effect.name),
    onMutate: (effect) => {
      setNotice(null);
      setCreateErrors((old) => ({ ...old, [effect.name]: undefined }));
    },
    onSuccess: async ({ reward }) => {
      await queryClient.cancelQueries({ queryKey: rewardsKey });
      queryClient.setQueryData<StreamRewards>(rewardsKey, (old) => (
        old ? { ...old, rewards: [...old.rewards.filter((item) => item.id !== reward.id), reward] } : old
      ));
      setNotice({ tone: 'ok', text: `Created "${reward.title}" for ${rewardCost(reward.cost)} on your Twitch channel.` });
    },
    // Beside the button that was pressed. "A reward with that name already exists. Map it instead." lands here.
    onError: (error, effect) => setCreateErrors((old) => ({ ...old, [effect.name]: plainError(error) })),
    // Also after a refusal: a reward with that name may have been made on Twitch since the list was read.
    onSettled: () => queryClient.invalidateQueries({ queryKey: rewardsKey }),
  });

  const effects = list.data?.effects ?? [];
  const rewards = list.data?.rewards ?? [];
  const unused = isOwner ? effectsWithoutReward(effects, rewards) : [];

  return (
    <section className="stream-accounts__card stream-rewards" aria-labelledby="stream-rewards-title">
      <div className="stream-accounts__card-head">
        <h3 id="stream-rewards-title">Channel point rewards</h3>
        <p>
          Choose what each reward on {isOwner ? 'your' : `${owner}'s`} Twitch channel does on the overlay. A change is saved as soon as you make it.
        </p>
      </div>

      {list.isLoading && <p className="stream-accounts__empty" role="status">Loading the rewards from Twitch…</p>}
      {list.error && !list.data && (
        <div className="stream-accounts__load-error" role="alert">
          <p className="stream-accounts__notice is-error">
            {isTwitchNotConnected(list.error)
              ? 'Twitch is not connected any more, so the rewards cannot be shown.'
              : `Could not load the rewards: ${plainError(list.error)}`}
          </p>
          <button type="button" disabled={list.isFetching} onClick={() => list.refetch()}>
            {list.isFetching ? 'Trying again…' : 'Try again'}
          </button>
        </div>
      )}

      {list.data && (
        <>
          {rewards.length === 0 ? (
            <p className="stream-accounts__empty">
              No channel point rewards yet.{' '}
              {isOwner
                ? 'Create one below, or make your own on Twitch and it will show up here.'
                : `${owner} can create them here or on Twitch.`}
            </p>
          ) : (
            <ul className="stream-rewards__list">
              {rewards.map((reward) => (
                <RewardRow key={reward.id} accountId={accountId} reward={reward} effects={effects} onSaved={applyMapping} />
              ))}
            </ul>
          )}

          {unused.length > 0 && (
            <div className="stream-rewards__create">
              <strong>Effects with no reward</strong>
              <p>
                Create reward adds a new reward to your Twitch channel at a standard cost and sets it to play the effect. You can rename it or change its cost on Twitch afterwards.
              </p>
              <ul>
                {unused.map((effect) => (
                  <li key={effect.name}>
                    <span>{effect.label}</span>
                    <button
                      type="button"
                      aria-label={`Create a reward for ${effect.label}`}
                      disabled={create.isPending}
                      onClick={() => create.mutate(effect)}
                    >
                      {create.isPending && create.variables?.name === effect.name ? 'Creating…' : 'Create reward'}
                    </button>
                    {createErrors[effect.name] && (
                      <p className="stream-accounts__notice is-error" role="alert">{createErrors[effect.name]}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {list.error && (
            <p className="stream-accounts__notice is-error" role="alert">
              Could not refresh the rewards: {plainError(list.error)}
            </p>
          )}
          <div className="stream-accounts__buttons">
            <button type="button" disabled={list.isFetching} onClick={() => list.refetch()}>
              {list.isFetching ? 'Refreshing…' : 'Refresh from Twitch'}
            </button>
          </div>
        </>
      )}

      {notice && (
        <p className={`stream-accounts__notice is-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </p>
      )}
    </section>
  );
};

/**
 * Channel point rewards for the account's Twitch channel. Shows nothing until Twitch is
 * connected and working; the Twitch card beside it says why.
 */
export const RewardsCard: React.FC<{ account: StreamAlertAccount }> = ({ account }) => {
  const accountId = account.id;
  const twitchKey = twitchQueryKey(accountId);
  const twitch = useQuery({ queryKey: twitchKey, queryFn: () => streamAlertsApi.getTwitch(accountId) });
  const link = twitch.data?.connected ? twitch.data.twitch : null;
  if (!link || link.status !== 'connected') return null;
  return <RewardsList account={account} />;
};
