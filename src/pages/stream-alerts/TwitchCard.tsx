import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { streamAlertsApi, StreamAlertAccount, StreamAlertTwitchState } from '@/api/streamAlerts';
import {
  listWords,
  mergeSubscriptions,
  PageNotice,
  plainError,
  twitchConnectHref,
  TwitchConnectResult,
  twitchListening,
  twitchQueryKey,
  twitchReturnNotice,
} from '@/utils/streamAlertAccounts';

/** Said before every Connect or Reconnect link, so the owner knows what Twitch is about to show. */
const WHAT_TWITCH_ASKS = 'Twitch will ask you to approve Acosmibot reading follows, subs, bits and hype trains, and managing channel point rewards. Acosmibot only listens. It does not post in chat. You come back to this page afterwards.';

/**
 * The account's Twitch connection: connect (owner), what is being listened for, fix, disconnect.
 * An editor sees the same state without the buttons.
 *
 * Connecting is a page visit, not a request from here: the link goes to the API, which sends
 * the owner to Twitch and back to this page with `?twitch=<result>`. `arrival` is that result.
 */
export const TwitchCard: React.FC<{ account: StreamAlertAccount; arrival: TwitchConnectResult | null }> = ({ account, arrival }) => {
  const queryClient = useQueryClient();
  const accountId = account.id;
  const twitchKey = twitchQueryKey(accountId);
  const statusKey = ['stream-alerts', accountId, 'status'];
  const isOwner = account.role === 'owner';
  const owner = account.owner_username.trim() || 'the owner';
  const [notice, setNotice] = useState<PageNotice | null>(null);
  /** The message for the trip back from Twitch stays until the next thing done in this card. */
  const [arrivalShown, setArrivalShown] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const card = useRef<HTMLElement>(null);
  const disconnectButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const focusCard = useRef(false);

  const state = useQuery({
    queryKey: twitchKey,
    queryFn: () => streamAlertsApi.getTwitch(accountId),
    // Twitch confirms each new event a few seconds after it is asked for: keep looking until none is left waiting.
    refetchInterval: (query) => (twitchListening(query.state.data?.twitch?.subscriptions ?? []).settingUp.length > 0
      && query.state.data?.twitch?.status === 'connected' ? 4_000 : false),
  });

  const linked = Boolean(state.data?.connected && state.data.twitch);

  // Leaving the confirm step puts the keyboard back on the button that opened it.
  useEffect(() => {
    if (!confirming && returnFocus.current) {
      returnFocus.current = false;
      disconnectButton.current?.focus();
    }
  }, [confirming]);
  // After a disconnect that button is gone, so the keyboard goes to the card instead of being dropped.
  useEffect(() => {
    if (!linked && focusCard.current) {
      focusCard.current = false;
      card.current?.focus();
    }
  }, [linked]);

  const startAction = () => {
    setNotice(null);
    setArrivalShown(false);
  };
  const closeConfirm = () => {
    returnFocus.current = true;
    setConfirming(false);
  };

  const fix = useMutation({
    mutationFn: () => streamAlertsApi.resubscribeTwitch(accountId),
    onMutate: startAction,
    onSuccess: (result) => {
      const before = queryClient.getQueryData<StreamAlertTwitchState>(twitchKey)?.twitch?.subscriptions ?? [];
      const subscriptions = mergeSubscriptions(before, result.subscriptions ?? []);
      queryClient.setQueryData<StreamAlertTwitchState>(twitchKey, (old) => (
        old?.twitch ? { ...old, twitch: { ...old.twitch, subscriptions } } : old
      ));
      const after = twitchListening(subscriptions);
      setNotice(after.failed.length === 0
        ? { tone: 'ok', text: 'Fixed. Twitch is sending those alerts again.' }
        : { tone: 'error', text: `Twitch still refused ${listWords(after.failed)}. Wait a few minutes and press Fix again.` });
    },
    onError: (error) => setNotice({ tone: 'error', text: `Could not fix it: ${plainError(error)}` }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: twitchKey }),
  });

  const disconnect = useMutation({
    mutationFn: () => streamAlertsApi.disconnectTwitch(accountId),
    onMutate: startAction,
    onSuccess: () => {
      focusCard.current = true;
      queryClient.setQueryData<StreamAlertTwitchState>(twitchKey, (old) => (old ? { ...old, connected: false, twitch: null } : old));
      setNotice({ tone: 'ok', text: 'Twitch is disconnected. Real Twitch alerts and channel point rewards no longer play on your overlay.' });
    },
    onError: (error) => setNotice({ tone: 'error', text: `Could not disconnect Twitch: ${plainError(error)}` }),
    onSettled: () => {
      closeConfirm();
      queryClient.invalidateQueries({ queryKey: twitchKey });
      queryClient.invalidateQueries({ queryKey: statusKey });
    },
  });

  const data = state.data;
  const link = data?.connected ? data.twitch : null;
  const needsReconnect = Boolean(link && (link.status !== 'connected' || (link.missing_scopes ?? []).length > 0));
  const connectHref = isOwner ? twitchConnectHref(data?.connect_url, accountId) : null;
  const events = twitchListening(link?.subscriptions ?? []);
  const working = fix.isPending || disconnect.isPending;
  const shownNotice = notice ?? (arrivalShown ? twitchReturnNotice(arrival, data ? Boolean(link) && !needsReconnect : null) : null);

  const connectLink = (label: string) => (connectHref ? (
    <>
      <p className="stream-twitch__ask">{WHAT_TWITCH_ASKS}</p>
      <div className="stream-accounts__buttons">
        <a className="stream-accounts__link-button is-primary" href={connectHref}>{label}</a>
      </div>
    </>
  ) : (
    <p className="stream-accounts__notice is-error">Connecting is not available right now. Refresh the page and try again.</p>
  ));

  return (
    <section ref={card} tabIndex={-1} className="stream-accounts__card stream-twitch" aria-labelledby="stream-twitch-title">
      <div className="stream-accounts__card-head">
        <h3 id="stream-twitch-title">Twitch</h3>
        <p>
          Connect a Twitch channel once, and its real follows, subs, bits, raids, hype trains and channel point rewards play on {isOwner ? 'your' : `${owner}'s`} overlay.
        </p>
      </div>

      {state.isLoading && <p className="stream-accounts__empty" role="status">Checking Twitch…</p>}
      {state.error && !data && (
        <div className="stream-accounts__load-error" role="alert">
          <p className="stream-accounts__notice is-error">Could not check Twitch: {plainError(state.error)}</p>
          <button type="button" disabled={state.isFetching} onClick={() => state.refetch()}>Try again</button>
        </div>
      )}

      {data && !link && (
        <>
          <p className="stream-twitch__channel">
            <span className="stream-twitch__light" aria-hidden="true" />
            <span><strong>Twitch is not connected.</strong>{!isOwner && ` Only ${owner} can connect it.`}</span>
          </p>
          {isOwner && connectLink('Connect Twitch')}
          {isOwner && account.legacy_overlay && (
            <p className="stream-accounts__aside">
              The overlay already installed in your OBS listens to Twitch by itself and keeps working as it is. Connecting here does not make alerts play twice.
            </p>
          )}
        </>
      )}

      {link && (
        <>
          <p className="stream-twitch__channel">
            <span className={`stream-twitch__light ${needsReconnect ? 'is-warn' : 'is-on'}`} aria-hidden="true" />
            <span>
              {needsReconnect ? 'Was connected to ' : 'Connected to '}<strong>{link.display_name || link.login}</strong>{' '}
              <span className="stream-twitch__login">twitch.tv/{link.login}</span>
            </span>
          </p>

          {needsReconnect ? (
            <div className="stream-twitch__problem">
              <strong>Reconnect Twitch</strong>
              <p>
                {link.status !== 'connected'
                  ? 'Twitch stopped letting Acosmibot listen to this channel, so real Twitch alerts and channel point rewards are not playing. This happens after a Twitch password change, or when Acosmibot is removed from the channel\'s Twitch connections.'
                  : 'Acosmibot needs a Twitch permission this connection does not have, so some real Twitch alerts may not play.'}
                {!isOwner && ` Only ${owner} can reconnect it.`}
              </p>
              {isOwner && connectLink('Reconnect Twitch')}
            </div>
          ) : (
            <>
              {events.listening.length > 0 && (
                <p className="stream-twitch__events">
                  {events.failed.length > 0 ? 'Still listening for ' : 'Listening for '}{listWords(events.listening)}.
                </p>
              )}
              {events.settingUp.length > 0 && (
                <p className="stream-twitch__events" role="status">
                  Twitch is still setting up {listWords(events.settingUp)}. This takes a few seconds.
                </p>
              )}
              {events.failed.length > 0 && (
                <div className="stream-twitch__problem">
                  <strong>Not listening for {listWords(events.failed)}.</strong>
                  <p>
                    {isOwner
                      ? 'Twitch did not accept these, so they will not play on your overlay. Fix asks Twitch again.'
                      : `Twitch did not accept these, so they will not play on the overlay. Only ${owner} can fix this.`}
                  </p>
                  {isOwner && (
                    <div className="stream-accounts__buttons">
                      <button type="button" className="is-primary" disabled={working} onClick={() => fix.mutate()}>
                        {fix.isPending ? 'Fixing…' : 'Fix'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {isOwner && !confirming && (
            <div className="stream-accounts__buttons">
              <button
                ref={disconnectButton}
                type="button"
                disabled={working}
                onClick={() => { startAction(); setConfirming(true); }}
              >
                Disconnect Twitch
              </button>
            </div>
          )}
          {isOwner && confirming && (
            <div className="stream-accounts__confirm" role="group" aria-label="Confirm disconnecting Twitch">
              <strong>Disconnect Twitch?</strong>
              <p>
                Real Twitch alerts and channel point rewards stop playing on your overlay right away, and what each reward was set to do is forgotten. The rewards themselves stay on your Twitch channel.
              </p>
              <div className="stream-accounts__buttons">
                <button type="button" className="is-danger" disabled={working} onClick={() => disconnect.mutate()}>
                  {disconnect.isPending ? 'Disconnecting…' : 'Yes, disconnect'}
                </button>
                <button type="button" autoFocus disabled={working} onClick={closeConfirm}>Cancel</button>
              </div>
            </div>
          )}
        </>
      )}

      {shownNotice && (
        <p className={`stream-accounts__notice is-${shownNotice.tone}`} role={shownNotice.tone === 'error' ? 'alert' : 'status'}>
          {shownNotice.text}
        </p>
      )}
    </section>
  );
};
