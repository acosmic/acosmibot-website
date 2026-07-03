import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Music, Users, Eye, Shield, type LucideIcon } from 'lucide-react';
import { FeatureToggle, SaveBar, LoadingSpinner } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import { useSpotifyGuildConfig, type SpotifyGuildConfig } from './useSpotifyGuildConfig';

/**
 * Server-owner Spotify configuration.
 *
 * The one setting that matters at the guild level is the master opt-in: whether
 * members' "Listening to Spotify" presence is recorded here at all. Everything
 * else (per-user linking, opt-out) is a personal choice made elsewhere.
 */
export const SpotifyPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { data, isLoading, save, isSaving, saveError } = useSpotifyGuildConfig(guildId!);
  const { form, setForm, isDirty, resetForm } = useDirtyState<SpotifyGuildConfig>(data);

  if (isLoading) return <LoadingSpinner />;
  if (!form) return <div>No data found.</div>;

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>Spotify</h1>
        <p>Turn your server into a music leaderboard — track what members listen to and power WhoKnows.</p>
      </div>

      <FeatureToggle
        label="Scrobble tracking"
        enabled={form.scrobble_enabled}
        onChange={(v) => setForm({ scrobble_enabled: v })}
        description="Record members' Spotify listening (from Discord presence) for WhoKnows leaderboards and stats."
      />

      <div className="card p-4 mb-4">
        <h3 className="mb-3">How it works</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <InfoRow
            icon={Music}
            title="Presence-based"
            text='When enabled, members with "Listening to Spotify" showing on Discord have their plays recorded — no Spotify login required.'
          />
          <InfoRow
            icon={Users}
            title="WhoKnows & stats"
            text="Members can run /spotify whoknows, /spotify top and /spotify recent to compare listening across your server."
          />
          <InfoRow
            icon={Eye}
            title="Off by default"
            text="Nothing is recorded until you enable it here. Turning it off keeps existing history but stops recording new plays."
          />
          <InfoRow
            icon={Shield}
            title="Members stay in control"
            text="Any member can opt out at any time with /spotify optout (or from their account settings), and linked users are tracked via their own Spotify account instead."
          />
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '16px 0 0' }}>
          Members connect their own Spotify and manage privacy on their{' '}
          <Link to="/settings">account settings</Link> page. See the{' '}
          <Link to="/docs/spotify">Spotify docs</Link> for the full command list.
        </p>
      </div>

      <SaveBar
        isDirty={isDirty}
        onSave={() => save(form)}
        onDiscard={resetForm}
        isSaving={isSaving}
        saveError={saveError}
      />
    </div>
  );
};

const InfoRow: React.FC<{ icon: LucideIcon; title: string; text: string }> = ({
  icon: Icon,
  title,
  text,
}) => (
  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
    <Icon size={18} color="#1DB954" />
    <div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{text}</div>
    </div>
  </div>
);
