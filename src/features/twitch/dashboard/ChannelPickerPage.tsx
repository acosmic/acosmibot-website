/**
 * `/twitch/dashboard` channel picker (§11.1, §11.4): the channels this Twitch
 * user can manage, own channel first, and the add-own-channel flow with the
 * "make Acosmibot a moderator" choice (default on, §16 Q2).
 */
import React, { useEffect, useId, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, LogOut, Plus, RefreshCw } from 'lucide-react';
import { LoadFailed, LoadingSpinner } from '@/components/ui';
import { showToast } from '@/utils/toast';
import type { ChannelAccess } from '../types';
import { twitchApi, twitchRetry } from '../shared/api';
import { startAddChannel, takeTwitchReturnPath, twitchLogout } from '../shared/auth';
import { useTwitchAuthStore } from '../shared/authStore';
import { TWITCH_CHANNELS_KEY } from '../shared/queryKeys';
import { roleLabel, roleRank } from '../shared/roles';
import { ChannelAvatar, EmptyState, StatusChip } from '../shared/ui/basics';
import { channelStatusView } from '../shared/ui/channelStatus';
import { TwitchPageFrame } from '../shared/ui/PageFrame';

interface ChannelsResponse {
  success: true;
  channels: ChannelAccess[];
  can_add_own_channel: boolean;
}

export const ChannelPickerPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const me = useTwitchAuthStore((state) => state.me);
  const [autoMod, setAutoMod] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const autoModId = useId().replace(/:/g, '');

  const query = useQuery({
    queryKey: TWITCH_CHANNELS_KEY,
    queryFn: () => twitchApi.get<ChannelsResponse>('/api/twitch-bot/channels'),
    retry: twitchRetry,
  });

  // Fallback for the page a visitor was on when they started signing in.
  useEffect(() => {
    const destination = takeTwitchReturnPath();
    if (destination && destination !== '/twitch' && destination !== '/twitch/dashboard') {
      navigate(destination, { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (params.get('bot_connected') !== '1') return;
    showToast('The Acosmibot bot account is connected.', 'success');
    const next = new URLSearchParams(params);
    next.delete('bot_connected');
    setParams(next, { replace: true });
  }, [params, setParams]);

  const ownId = me?.user.twitch_user_id ?? null;
  const channels = useMemo(() => [...(query.data?.channels ?? [])].sort((a, b) => {
    if (a.broadcaster_id === ownId) return -1;
    if (b.broadcaster_id === ownId) return 1;
    return roleRank(b.role) - roleRank(a.role) || a.display_name.localeCompare(b.display_name);
  }), [query.data, ownId]);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await twitchLogout();
      queryClient.removeQueries({ queryKey: ['twitch'] });
      navigate('/twitch', { replace: true });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not sign out. Try again.', 'error');
      setSigningOut(false);
    }
  };

  let body: React.ReactNode;
  if (query.isPending) {
    body = <LoadingSpinner />;
  } else if (query.isError) {
    body = (
      <LoadFailed
        title="Your channels didn't load"
        message={`${query.error instanceof Error ? query.error.message : 'Something went wrong.'} Nothing was changed.`}
        onRetry={() => query.refetch()}
      />
    );
  } else {
    const canAdd = query.data.can_add_own_channel;
    body = (
      <>
        {canAdd && (
          <section className="tw-add-channel" aria-labelledby="tw-add-channel-title">
            <div className="tw-add-channel__copy">
              <h2 id="tw-add-channel-title">Add Acosmibot to your channel</h2>
              <p>
                Twitch will ask you, as the broadcaster, to approve the permissions Acosmibot needs to read chat,
                reply and moderate. You can remove it later from your Twitch connection settings.
              </p>
              <div className="tw-checkbox">
                <input
                  id={`tw-automod-${autoModId}`}
                  type="checkbox"
                  className="form-check-input"
                  checked={autoMod}
                  onChange={(event) => setAutoMod(event.target.checked)}
                  aria-describedby={`tw-automod-${autoModId}-help`}
                />
                <label htmlFor={`tw-automod-${autoModId}`}>Make Acosmibot a moderator in my channel</label>
              </div>
              <p id={`tw-automod-${autoModId}-help`} className="tw-field__help">
                Recommended. A moderator bot can send more messages and act on chat filters itself instead of through your account.
              </p>
            </div>
            <button type="button" className="btn primary tw-button-lg" onClick={() => startAddChannel(autoMod)}>
              <Plus aria-hidden="true" size={18} />
              Add Acosmibot to my channel
            </button>
          </section>
        )}

        {channels.length > 0 ? (
          <section aria-labelledby="tw-channel-list-title">
            <h2 id="tw-channel-list-title" className="tw-section-title">Channels you can manage</h2>
            <ul className="tw-channel-list">
              {channels.map((channel) => {
                const status = channelStatusView(channel.status);
                const isOwn = channel.broadcaster_id === ownId;
                return (
                  <li key={channel.broadcaster_id} className="tw-channel-card">
                    <Link className="tw-channel-card__main" to={`/twitch/c/${channel.broadcaster_id}/overview`}>
                      <ChannelAvatar src={channel.profile_image_url} name={channel.display_name} size={48} />
                      <span className="tw-channel-card__identity">
                        <strong>{channel.display_name}</strong>
                        <small>{isOwn ? 'Your channel' : `twitch.tv/${channel.login}`}</small>
                      </span>
                      <span className="tw-channel-card__chips">
                        <StatusChip tone="neutral">{roleLabel(channel.role)}</StatusChip>
                        <StatusChip tone={status.tone} title={status.detail}>{status.label}</StatusChip>
                      </span>
                      <ChevronRight className="tw-channel-card__arrow" aria-hidden="true" />
                    </Link>
                    {isOwn && channel.status === 'reauth_required' && (
                      <div className="tw-channel-card__action">
                        <p>Twitch no longer accepts this channel’s permission.</p>
                        <button type="button" className="btn" onClick={() => startAddChannel(true)}>
                          <RefreshCw aria-hidden="true" size={16} />
                          Reconnect
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : !canAdd ? (
          <EmptyState
            title="No channels yet"
            description="Acosmibot is not in any channel you manage. When a broadcaster adds Acosmibot and makes you an editor or moderator, their channel appears here."
          />
        ) : null}
      </>
    );
  }

  return (
    <TwitchPageFrame className="tw-picker" labelledBy="tw-picker-title">
      <header className="page-header tw-page-header tw-picker__header">
        <div className="tw-page-header__copy">
          <p className="tw-kicker">Acosmibot on Twitch</p>
          <h1 id="tw-picker-title">Your channels</h1>
          <p>Choose a channel to manage. You see your own channel and the channels where you are an editor or moderator.</p>
        </div>
        {me && (
          <div className="tw-page-header__actions tw-picker__account">
            <ChannelAvatar src={me.user.profile_image_url} name={me.user.display_name || me.user.login} size={36} />
            <span>Signed in as <strong>{me.user.display_name || me.user.login}</strong></span>
            <button type="button" className="btn" onClick={() => void signOut()} disabled={signingOut} aria-busy={signingOut}>
              <LogOut aria-hidden="true" size={16} />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        )}
      </header>
      {body}
    </TwitchPageFrame>
  );
};
