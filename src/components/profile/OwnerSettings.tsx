import React from 'react';
import type { PublicProfile, PrivacySettings } from '@/api/profile';

/**
 * Owner-only profile settings panel (privacy toggles + per-server visibility).
 *
 * Deliberately self-contained and **props-only** — it does no data fetching of
 * its own. Today it renders inline on the owner's profile page; when a dedicated
 * `/settings` route lands (alongside per-user premium / billing / rank-card
 * customization) it can be rendered there against the same `/api/profile/me`
 * payload with no changes.
 */

const fmt = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : n.toLocaleString();

const ordinal = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : `#${n.toLocaleString()}`;

/** Boolean privacy keys (everything except the hidden_guilds list). */
export type BoolPrivacyKey = Exclude<keyof PrivacySettings, 'hidden_guilds'>;

export const OwnerSettings: React.FC<{
  privacy: PrivacySettings;
  guilds: PublicProfile['guilds'];
  saving: boolean;
  onToggle: (key: BoolPrivacyKey, value: boolean) => void;
  onToggleGuild: (guildId: string, hidden: boolean) => void;
}> = ({ privacy, guilds, saving, onToggle, onToggleGuild }) => (
  <div style={{
    background: 'var(--bg-card)', border: '1px solid var(--border-cyan)',
    borderRadius: '16px', padding: '20px', marginBottom: '20px',
  }}>
    <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
      This is you ✨
    </h2>
    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
      Your profile is public so others can find you. Your name &amp; global level always
      show — toggle everything else below.
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Toggle label="Public profile" hint="Anyone can view this page"
        checked={privacy.profile_public} disabled={saving}
        onChange={(v) => onToggle('profile_public', v)} />
      <Toggle label="Avatar" hint="Show your Discord avatar (vs anonymous)"
        checked={privacy.show_avatar} disabled={saving}
        onChange={(v) => onToggle('show_avatar', v)} />
      <Toggle label="XP & global rank" hint="Your global XP and leaderboard rank"
        checked={privacy.show_xp} disabled={saving}
        onChange={(v) => onToggle('show_xp', v)} />
      <Toggle label="Messages" hint="Total messages sent"
        checked={privacy.show_messages} disabled={saving}
        onChange={(v) => onToggle('show_messages', v)} />
      <Toggle label="Reactions" hint="Total reactions given"
        checked={privacy.show_reactions} disabled={saving}
        onChange={(v) => onToggle('show_reactions', v)} />
      <Toggle label="Commands" hint="Total commands used"
        checked={privacy.show_commands} disabled={saving}
        onChange={(v) => onToggle('show_commands', v)} />
      <Toggle label="Economy" hint="Currency, bank balance & ranks"
        checked={privacy.show_economy} disabled={saving}
        onChange={(v) => onToggle('show_economy', v)} />
      <Toggle label="Show servers" hint="Your per-server levels & ranks"
        checked={privacy.show_guilds} disabled={saving}
        onChange={(v) => onToggle('show_guilds', v)} />
      <Toggle label="Achievements" hint="Your unlocked-achievements trophy case"
        checked={privacy.show_achievements} disabled={saving}
        onChange={(v) => onToggle('show_achievements', v)} />
      <Toggle label="Public identity" hint="Show your name & avatar to people who don’t share a server with you (leaderboards & profile). Off = they see you masked."
        checked={privacy.public_identity} disabled={saving}
        onChange={(v) => onToggle('public_identity', v)} />

      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '8px 0 -2px' }}>
        Notifications
      </div>
      <Toggle label="Achievement DMs" hint="Get a direct message when you unlock an achievement, so you can claim your reward"
        checked={privacy.dm_achievements} disabled={saving}
        onChange={(v) => onToggle('dm_achievements', v)} />
    </div>

    {/* Per-server visibility: choose exactly which servers appear. */}
    {privacy.show_guilds && guilds && guilds.length > 0 && (
      <div style={{ marginTop: '18px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Which servers show
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Hide individual servers while keeping the rest visible.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {guilds.map((gu) => (
            <Toggle
              key={gu.guild_id}
              label={gu.guild_name || 'Unknown Server'}
              hint={`Lvl ${fmt(gu.level)} · ${ordinal(gu.rank)}`}
              checked={!gu.hidden}
              disabled={saving}
              onChange={(visible) => onToggleGuild(gu.guild_id, !visible)}
            />
          ))}
        </div>
      </div>
    )}

    <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
      🎨 Rank card customization coming soon.
    </div>
  </div>
);

const Toggle: React.FC<{
  label: string; hint: string; checked: boolean; disabled?: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, hint, checked, disabled, onChange }) => (
  <label style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '12px', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
  }}>
    <span>
      <span style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
      <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>{hint}</span>
    </span>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      style={{ width: '18px', height: '18px', accentColor: 'var(--primary-color)', cursor: disabled ? 'default' : 'pointer' }}
    />
  </label>
);
