import React from 'react';
import { Link } from 'react-router-dom';
import { Link2, Music } from 'lucide-react';
import { InlineIcon } from '@/components/ui/InlineIcon';
import type { SpotifyStatus } from '@/api/spotify';

// SPOTIFY OAUTH DEFERRED — see SPOTIFY_OAUTH_DEFERRED.md. Account linking (OAuth) is
// disabled until we qualify for Spotify Extended Quota Mode, so this card no longer
// shows Link/Unlink. Scrobbling still works from Discord "Listening to Spotify"
// presence; the privacy opt-out below still applies.
export const ConnectedAccountsSettings: React.FC<{
  spotify?: SpotifyStatus;
  loading?: boolean;
  optOutSaving?: boolean;
  onToggleOptOut: (optedOut: boolean) => void;
}> = ({ spotify, loading, optOutSaving, onToggleOptOut }) => (
  <div style={{
    background: 'var(--bg-card)', border: '1px solid var(--border-cyan)',
    borderRadius: '16px', padding: '20px', marginBottom: '20px',
  }}>
    <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
      Connected Accounts <InlineIcon icon={Link2} color="var(--primary-color)" />
    </h2>

    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '12px', marginTop: '16px',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Music size={20} color="#1DB954" />
        <span>
          <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Spotify
          </span>
          <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>
            Tracked from your Discord “Listening to Spotify” status
          </span>
        </span>
      </span>
    </div>

    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '10px 0 0' }}>
      Your plays are recorded automatically from Discord presence in servers where Spotify
      tracking is on — no account linking needed. That powers WhoKnows leaderboards and your
      stats.{' '}
      <Link to="/docs/music">Learn how it works</Link>.
    </p>

    {/* Privacy opt-out — applies to presence-based tracking. */}
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)',
    }}>
      <span>
        <span style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Keep my listening private
        </span>
        <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>
          Don't track my Spotify plays or let others see them via <code>/music</code>.
        </span>
      </span>
      <div className="form-check form-switch mb-0">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          checked={!!spotify?.opted_out}
          disabled={loading || optOutSaving}
          onChange={(e) => onToggleOptOut(e.target.checked)}
          style={{ width: '3em', height: '1.5em', cursor: 'pointer' }}
        />
      </div>
    </div>
  </div>
);
