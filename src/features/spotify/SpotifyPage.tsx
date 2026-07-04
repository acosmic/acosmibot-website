import React from 'react';
import { useParams, Link } from 'react-router-dom';
// SPOTIFY OAUTH DEFERRED — Check/Minus were only used by the commented-out TierCard comparison.
import { Music, Users, Eye, Shield, type LucideIcon } from 'lucide-react';
import { FeatureToggle, SaveBar, LoadingSpinner } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import { useSpotifyGuildConfig, type SpotifyGuildConfig } from './useSpotifyGuildConfig';

/**
 * Server-owner Spotify configuration.
 *
 * The one setting that matters at the guild level is whether members' "Listening to
 * Spotify" presence is recorded here at all — on by default, and an admin can turn it
 * off. Per-member privacy (opt-out) is a personal choice made elsewhere.
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
            title="On by default"
            text="Tracking is enabled out of the box. Turn it off here to stop recording new plays — existing history is kept."
          />
          <InfoRow
            icon={Shield}
            title="Members stay in control"
            text="Any member can opt out at any time with /spotify optout (or from their account settings)."
          />
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '16px 0 0' }}>
          Members manage their listening privacy on their{' '}
          <Link to="/settings">account settings</Link> page. See the{' '}
          <Link to="/docs/spotify">Spotify docs</Link> for the full command list.
        </p>
      </div>

      {/*
        SPOTIFY OAUTH DEFERRED — see SPOTIFY_OAUTH_DEFERRED.md. This "Without vs. with a
        Spotify login" comparison advertised linked-account (OAuth) features that are
        disabled until we qualify for Spotify Extended Quota Mode. Restore when linking is back.

      <div className="card p-4 mb-4">
        <h3 className="mb-1">Without vs. with a Spotify login</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
          Every member is covered by presence tracking automatically. Linking a Spotify account
          is optional and only unlocks extra, personal features for that member.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <TierCard
            title="No Spotify login"
            subtitle="Automatic, from Discord presence"
            accent="var(--text-secondary)"
            rows={[
              { on: true, text: 'Plays recorded while "Listening to Spotify" shows on Discord' },
              { on: true, text: 'Appears on /spotify whoknows server leaderboards' },
              { on: true, text: '/spotify now, top, recent from recorded plays' },
              { on: false, text: 'Mobile / off-Discord listening (only what Discord broadcasts)' },
              { on: false, text: 'Playback control, playlists, genre taste' },
            ]}
          />
          <TierCard
            title="Linked account"
            subtitle="Member connects Spotify — everything on the left, plus:"
            accent="#1DB954"
            rows={[
              { on: true, text: 'Fuller coverage — plays pulled from Spotify itself (incl. mobile)' },
              { on: true, text: '/spotify now works even when Discord isn’t showing it' },
              { on: true, text: '/spotify top with real ranges (4 weeks / 6 months / all time)' },
              { on: true, text: '/spotify taste (top genres) and /spotify playlist' },
              { on: true, text: '/spotify player — pause / resume / skip (Spotify Premium)' },
            ]}
          />
        </div>
      </div>
      */}

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

// SPOTIFY OAUTH DEFERRED — see SPOTIFY_OAUTH_DEFERRED.md. Used only by the commented-out
// "Without vs. with a Spotify login" comparison above. Restore alongside it.
// const TierCard: React.FC<{
//   title: string;
//   subtitle: string;
//   accent: string;
//   rows: { on: boolean; text: string }[];
// }> = ({ title, subtitle, accent, rows }) => (
//   <div style={{
//     flex: '1 1 260px', minWidth: '260px',
//     background: 'var(--bg-overlay)', border: `1px solid ${accent === '#1DB954' ? 'var(--border-cyan)' : 'var(--border-light)'}`,
//     borderRadius: '12px', padding: '16px',
//   }}>
//     <div style={{ fontSize: '15px', fontWeight: 700, color: accent }}>{title}</div>
//     <div style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 12px' }}>{subtitle}</div>
//     <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
//       {rows.map((r, i) => (
//         <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
//           {r.on
//             ? <Check size={16} color="#1DB954" style={{ flexShrink: 0, marginTop: '2px' }} />
//             : <Minus size={16} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />}
//           <span style={{ fontSize: '13px', color: r.on ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{r.text}</span>
//         </div>
//       ))}
//     </div>
//   </div>
// );
