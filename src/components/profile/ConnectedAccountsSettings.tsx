import React from 'react';
import { Link } from 'react-router-dom';
import { Link2, Music } from 'lucide-react';
import type { SpotifyStatus } from '@/api/spotify';

export const ConnectedAccountsSettings: React.FC<{
  spotify?: SpotifyStatus;
  loading?: boolean;
  optOutSaving?: boolean;
  onToggleOptOut: (optedOut: boolean) => void;
}> = ({ spotify, loading, optOutSaving, onToggleOptOut }) => (
  <section className="settings-group connected-settings">
    <header>
      <span><Link2 aria-hidden="true" /></span>
      <div>
        <h3>Connected signals</h3>
        <p>Presence-based services that contribute personal activity to Acosmibot.</p>
      </div>
    </header>
    <div className="connected-settings__source">
      <span className="connected-settings__icon"><Music aria-hidden="true" /></span>
      <div>
        <strong>Spotify presence</strong>
        <p>
          Plays are read from Discord’s “Listening to Spotify” status in enabled servers.
          No Spotify account link is required. <Link to="/docs/music">Learn how it works</Link>.
        </p>
      </div>
      <label className={`member-toggle is-compact${loading || optOutSaving ? ' is-disabled' : ''}`}>
        <span><strong>Keep listening private</strong><small>Stop tracking and sharing plays through /music</small></span>
        <input
          type="checkbox"
          role="switch"
          checked={!!spotify?.opted_out}
          disabled={loading || optOutSaving}
          onChange={(event) => onToggleOptOut(event.target.checked)}
        />
        <i aria-hidden="true"><span /></i>
      </label>
    </div>
  </section>
);
