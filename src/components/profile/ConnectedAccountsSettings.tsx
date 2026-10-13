import React from 'react';
import { Link } from 'react-router-dom';
import { Music } from 'lucide-react';
import type { SpotifyStatus } from '@/api/spotify';

export const ConnectedAccountsSettings: React.FC<{
  spotify?: SpotifyStatus;
  loading?: boolean;
  optOutSaving?: boolean;
  onToggleOptOut: (optedOut: boolean) => void;
}> = ({ spotify, loading, optOutSaving, onToggleOptOut }) => (
  <section id="settings-spotify" className="settings-group connected-settings" aria-labelledby="settings-spotify-title">
    <header>
      <span><Music aria-hidden="true" /></span>
      <div>
        <h3 id="settings-spotify-title">Spotify listening</h3>
        <p>
          Acosmibot reads what you’re playing from your Discord “Listening to Spotify” status in servers
          where music is enabled. You never link a Spotify account. <Link to="/docs/music">How it works</Link>
        </p>
      </div>
    </header>
    <div className="settings-group__controls">
      {/* The API stores an opt-out, so the switch is its inverse: every switch
          on this page then reads the same way (on means shared or active). */}
      <label className={`member-toggle${loading || optOutSaving ? ' is-disabled' : ''}`}>
        <span>
          <strong>Track my Spotify listening</strong>
          <small>When on, Acosmibot tracks your plays and can share them through /music. Turn it off to stop both.</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={!spotify?.opted_out}
          disabled={loading || optOutSaving}
          onChange={(event) => onToggleOptOut(!event.target.checked)}
        />
        <i aria-hidden="true"><span /></i>
      </label>
    </div>
  </section>
);
