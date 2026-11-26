import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { streamAlertsApi, StreamAlertsMe } from '@/api/streamAlerts';
import {
  accountLabel,
  linkedAccountMissing,
  orderAccounts,
  ownerPossessive,
  pickAccount,
  plainError,
  readTwitchReturn,
  rewardsQueryKey,
  TwitchConnectResult,
  twitchQueryKey,
  withoutTwitchResult,
} from '@/utils/streamAlertAccounts';
import { VIEW_PARAM } from '@/utils/streamAlertBox';
import { AlertBoxShell } from './AlertBoxShell';
import './StreamAlertAccounts.css';

const ME_KEY = ['stream-alerts', 'me'];
const ACCOUNT_PARAM = 'account';

/**
 * Everything under the page header: whose stream alerts are shown (and setting up your own),
 * then the alert box of the selected account, which holds every page and card.
 */
export const StreamAlertsWorkspace: React.FC = () => {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const requested = params.get(ACCOUNT_PARAM);
  const me = useQuery({ queryKey: ME_KEY, queryFn: () => streamAlertsApi.getMe() });
  const [linkMissed, setLinkMissed] = useState(false);
  const [justSetUp, setJustSetUp] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  /** How the trip to Twitch ended, and for which account. Read from the address once, then the address is cleaned. */
  const [twitchArrival, setTwitchArrival] = useState<{ accountId: number; result: TwitchConnectResult } | null>(null);
  const linkChecked = useRef(false);
  /** The page with unsaved changes ("Follows"), or null. Switching account asks first while it is set. */
  const [unsaved, setUnsaved] = useState<string | null>(null);
  const [pendingAccount, setPendingAccount] = useState<number | null>(null);

  const accounts = useMemo(() => orderAccounts(me.data?.accounts ?? []), [me.data]);
  const selected = pickAccount(accounts, requested, me.data?.own_account_id ?? null);

  const writeAccountParam = (id: number | null) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (id === null) next.delete(ACCOUNT_PARAM);
    else next.set(ACCOUNT_PARAM, String(id));
    return next;
  }, { replace: true });

  // The address is read once, when the accounts are known.
  //
  // A link to an account this person cannot open: show another one, say so, and take the dead
  // id out of the address so the page is not shared on with it.
  //
  // Back from Twitch (`?account=<id>&twitch=<result>`): keep the result for the Twitch card of
  // that account, ask the API again how Twitch stands, open the Connections page, and take
  // only `twitch` out of the address so a reload or a shared link does not repeat the message. The result is shown only
  // to the owner of the account it names; anyone else arriving with it just has it removed.
  useEffect(() => {
    if (!me.data || linkChecked.current) return;
    linkChecked.current = true;
    const missed = linkedAccountMissing(me.data.accounts, requested);
    const back = readTwitchReturn(params);
    if (!missed && !back.present) return;
    if (missed) setLinkMissed(true);
    const account = me.data.accounts.find((item) => item.id === back.accountId);
    if (back.result && account?.role === 'owner') {
      setTwitchArrival({ accountId: account.id, result: back.result });
      for (const queryKey of [twitchQueryKey(account.id), rewardsQueryKey(account.id), ['stream-alerts', account.id, 'status']]) {
        // The cards have only just asked, so this joins a read already on its way instead of starting a second one.
        queryClient.invalidateQueries({ queryKey }, { cancelRefetch: false });
      }
    }
    // One write for both changes: two in a row would each start from the address as it was.
    const next = withoutTwitchResult(params);
    if (missed) next.delete(ACCOUNT_PARAM);
    if (back.result && account?.role === 'owner') next.set(VIEW_PARAM, 'connections');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data]);

  const selectAccount = (id: number) => {
    if (unsaved && id !== selected?.id) {
      setPendingAccount(id);
      return;
    }
    switchAccount(id);
  };
  const switchAccount = (id: number) => {
    setPendingAccount(null);
    setUnsaved(null);
    setLinkMissed(false);
    // The message from Twitch belongs to the account it was about, and to that visit only.
    setTwitchArrival(null);
    writeAccountParam(id);
  };

  const setUp = useMutation({
    mutationFn: () => streamAlertsApi.createAccount(),
    onMutate: () => setSetupError(null),
    onSuccess: ({ account }) => {
      queryClient.setQueryData<StreamAlertsMe>(ME_KEY, (old) => (old ? {
        ...old,
        own_account_id: account.id,
        accounts: [...old.accounts.filter((item) => item.id !== account.id), account],
      } : old));
      setJustSetUp(true);
      selectAccount(account.id);
    },
    onError: (error) => setSetupError(plainError(error)),
    // Also after a failure: "You already have stream alerts set up" means the list here is out of date.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ME_KEY }),
  });

  if (me.isLoading) {
    return <p className="stream-accounts__state" role="status">Loading your stream alerts…</p>;
  }
  if (!me.data) {
    return (
      <div className="stream-accounts stream-accounts__state" role="alert">
        <strong>Could not load your stream alerts.</strong>
        <p>{plainError(me.error)}</p>
        <div className="stream-accounts__buttons">
          <button type="button" disabled={me.isFetching} onClick={() => me.refetch()}>
            {me.isFetching ? 'Trying again…' : 'Try again'}
          </button>
        </div>
      </div>
    );
  }

  const canSetUp = me.data.can_create && me.data.own_account_id === null;
  const setUpButton = (
    <button type="button" className="is-primary" disabled={setUp.isPending} onClick={() => setUp.mutate()}>
      {setUp.isPending ? 'Setting up…' : 'Set up stream alerts'}
    </button>
  );
  const setUpFailed = setupError && (
    <p className="stream-accounts__notice is-error" role="alert">Could not set up stream alerts: {setupError}</p>
  );

  if (!selected) {
    if (!canSetUp) {
      return (
        <div className="stream-accounts stream-accounts__state">
          <strong>You do not have stream alerts yet.</strong>
          <p>
            {me.data.can_open
              ? 'Nobody has added you as an editor of their stream alerts, and you cannot set up your own from this account.'
              : 'Stream alerts are not open to your account yet.'}
          </p>
        </div>
      );
    }
    return (
      <div className="stream-accounts">
        <section className="stream-accounts__card stream-accounts__setup" aria-labelledby="stream-setup-title">
          <div className="stream-accounts__card-head">
            <h3 id="stream-setup-title">Set up stream alerts</h3>
            <p>
              You get your own alerts for OBS: a private link to add as a Browser source, a preview, test alerts and live controls. You can add editors afterwards.
            </p>
          </div>
          <div className="stream-accounts__buttons">{setUpButton}</div>
          {setUpFailed}
        </section>
      </div>
    );
  }

  const isOwner = selected.role === 'owner';
  const pendingTarget = accounts.find((item) => item.id === pendingAccount) ?? null;

  const switcher = accounts.length > 1 && (
    <div className="stream-accounts__switch stream-box__switch" role="group" aria-label="Whose stream alerts to control">
      <span>Whose alerts</span>
      {accounts.map((account) => (
        <button
          key={account.id}
          type="button"
          className={account.id === selected.id ? 'is-current' : ''}
          aria-pressed={account.id === selected.id}
          onClick={() => selectAccount(account.id)}
        >
          {accountLabel(account)}
        </button>
      ))}
    </div>
  );

  return (
    <div className="stream-alerts-workspace stream-accounts">
      {linkMissed && (
        <p className="stream-accounts__note" role="status">
          You do not have access to the stream alerts in that link, so this page shows {selected.is_own ? 'yours' : ownerPossessive(selected.owner_username)} instead.
        </p>
      )}

      {pendingAccount !== null && (
        <div className="stream-accounts__confirm" role="group" aria-label="Unsaved changes">
          <strong>You have unsaved changes on {unsaved}.</strong>
          <p>
            Switching to {pendingTarget?.is_own ? 'your alerts' : `${ownerPossessive(pendingTarget?.owner_username ?? '')} alerts`} throws them away. Keep editing to save them first.
          </p>
          <div className="stream-accounts__buttons">
            <button type="button" className="is-danger" onClick={() => switchAccount(pendingAccount)}>Discard changes and switch</button>
            <button type="button" autoFocus onClick={() => setPendingAccount(null)}>Keep editing</button>
          </div>
        </div>
      )}

      {!isOwner && (
        <p className="stream-accounts__who">
          <strong>You are controlling {ownerPossessive(selected.owner_username)} stream alerts.</strong>{' '}
          You are an editor, so what you send or change here plays on their stream. Only {selected.owner_username} can see the OBS link, change the editors, or connect and disconnect Twitch.
        </p>
      )}

      {isOwner && justSetUp && (
        <p className="stream-accounts__notice is-ok" role="status">
          Your stream alerts are set up. Next, copy your OBS link at the top and add it to OBS.
        </p>
      )}

      {canSetUp && (
        <section className="stream-accounts__card stream-accounts__setup is-compact" aria-labelledby="stream-setup-title">
          <div className="stream-accounts__card-head">
            <h3 id="stream-setup-title">Set up stream alerts</h3>
            <p>You do not have stream alerts of your own yet. Setting them up does not change the ones you edit.</p>
          </div>
          <div className="stream-accounts__buttons">{setUpButton}</div>
          {setUpFailed}
        </section>
      )}

      <AlertBoxShell
        key={selected.id}
        account={selected}
        switcher={switcher}
        twitchArrival={twitchArrival?.accountId === selected.id ? twitchArrival.result : null}
        onDirtyChange={setUnsaved}
      />
    </div>
  );
};
