import React from 'react';
import { Link } from 'react-router-dom';
import { Link2, Music, Unlink } from 'lucide-react';
import { InlineIcon } from '@/components/ui/InlineIcon';
import type { SpotifyStatus } from '@/api/spotify';

export const ConnectedAccountsSettings: React.FC<{
  spotify?: SpotifyStatus;
  loading?: boolean;
  saving?: boolean;
  optOutSaving?: boolean;
  onLink: () => void;
  onUnlink: () => void;
  onToggleOptOut: (optedOut: boolean) => void;
}> = ({ spotify, loading, saving, optOutSaving, onLink, onUnlink, onToggleOptOut }) => (
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
            {loading
              ? 'Checking connection...'
              : spotify?.linked
                ? `${spotify.display_name || 'Linked'}${spotify.product ? ` · ${spotify.product}` : ''}`
                : 'Not connected'}
          </span>
        </span>
      </span>

      {spotify?.linked ? (
        <button type="button" className="btn btn-sm" disabled={saving} onClick={onUnlink}>
          <InlineIcon icon={Unlink} /> Unlink
        </button>
      ) : (
        <button type="button" className="btn btn-sm btn-primary" disabled={saving || loading} onClick={onLink}>
          <InlineIcon icon={Link2} /> Link
        </button>
      )}
    </div>

    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '10px 0 0' }}>
      Linking lets you use richer <code>/spotify</code> features (top artists, now-playing off Discord,
      playback). You don't have to link to appear on server WhoKnows leaderboards.{' '}
      <Link to="/docs/spotify">Learn how it works</Link>.
    </p>

    {/* Privacy opt-out — applies whether or not you've linked. */}
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)',
    }}>
      <span>
        <span style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Keep my listening private
        </span>
        <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>
          Don't track my Spotify plays or let others see them via <code>/spotify</code>.
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
