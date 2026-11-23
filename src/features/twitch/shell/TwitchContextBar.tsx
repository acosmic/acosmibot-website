import React from 'react';
import { ChevronRight, ExternalLink, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { ChannelAccess, ChannelSummary } from '../types';
import { ChannelAvatar, StatusChip } from '../shared/ui/basics';
import { channelHealthView, liveView } from '../shared/ui/channelStatus';

interface TwitchContextBarProps {
  channelId: string;
  /** Loaded summary, or undefined while loading / after a failure. */
  channel?: ChannelSummary;
  /** `/auth/twitch/me` entry, used for identity until the summary arrives. */
  access?: ChannelAccess;
  /** Channels for the switcher (from `/auth/twitch/me`). */
  channels: ChannelAccess[];
  sectionId: string;
  sectionLabel: string;
  onMenuClick: () => void;
  menuOpen: boolean;
  menuButtonRef?: React.Ref<HTMLButtonElement>;
}

/**
 * Persistent channel context under the site header (§11.3): channel identity,
 * live and bot state, channel switcher and the public page link. Reuses the
 * server context bar geometry so the Twitch dashboard sits in the same frame.
 */
export const TwitchContextBar: React.FC<TwitchContextBarProps> = ({
  channelId,
  channel,
  access,
  channels,
  sectionId,
  sectionLabel,
  onMenuClick,
  menuOpen,
  menuButtonRef,
}) => {
  const navigate = useNavigate();
  const name = channel?.display_name ?? access?.display_name ?? 'Channel';
  const login = channel?.login ?? access?.login ?? null;
  const image = channel?.profile_image_url ?? access?.profile_image_url ?? null;
  const live = channel ? liveView(channel) : null;
  const health = channel ? channelHealthView(channel) : null;
  const switchable = channels.filter((entry) => entry.status !== 'removing');

  return (
    <header className="server-context-bar tw-context-bar">
      <div className="server-context-bar__content">
        <button
          ref={menuButtonRef}
          type="button"
          className="server-context-bar__menu"
          onClick={onMenuClick}
          aria-label={menuOpen ? 'Close channel navigation' : 'Open channel navigation'}
          aria-expanded={menuOpen}
          aria-controls="twitch-channel-navigation"
        >
          {menuOpen ? <PanelLeftClose size={20} aria-hidden="true" /> : <PanelLeftOpen size={20} aria-hidden="true" />}
        </button>

        <nav className="server-breadcrumb" aria-label="Channel breadcrumb">
          <span className="server-breadcrumb__eyebrow">Channel control</span>
          <Link className="server-breadcrumb__guild" to={`/twitch/c/${channelId}/overview`}>
            <ChannelAvatar src={image} name={name} size={32} />
            <span>{name}</span>
          </Link>
          <ChevronRight className="server-breadcrumb__separator" size={16} aria-hidden="true" />
          <span className="server-breadcrumb__section" aria-current="page">{sectionLabel}</span>
        </nav>

        <div className="tw-context-bar__status">
          {live && <StatusChip tone={live.tone}>{live.label}</StatusChip>}
          {health && <StatusChip tone={health.tone} title={health.detail}>{health.label}</StatusChip>}
        </div>

        {switchable.length > 1 && (
          <label className="server-context-bar__switcher">
            <span className="visually-hidden">Switch channel</span>
            <select
              aria-label="Switch channel"
              value={channelId}
              onChange={(event) => {
                if (event.target.value && event.target.value !== channelId) {
                  // Stay on the same section; the shell shows the role panel if this channel's role is lower.
                  navigate(`/twitch/c/${event.target.value}/${sectionId}`);
                }
              }}
            >
              {!switchable.some((entry) => entry.broadcaster_id === channelId) && <option value={channelId}>{name}</option>}
              {switchable.map((entry) => (
                <option key={entry.broadcaster_id} value={entry.broadcaster_id}>{entry.display_name}</option>
              ))}
            </select>
          </label>
        )}

        {login && (
          <Link className="tw-context-bar__public" to={`/t/${login}`} target="_blank" rel="noopener">
            <ExternalLink aria-hidden="true" size={16} />
            <span className="tw-context-bar__public-label">View public page</span>
            <span className="visually-hidden"> (opens in a new tab)</span>
          </Link>
        )}
      </div>
    </header>
  );
};
