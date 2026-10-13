import React from 'react';
import { BarChart3, Bell, Clock3, Eye, Server } from 'lucide-react';
import { TimezoneSelect, detectBrowserTimezone } from '@/components/ui/TimezoneSelect';
import type { PrivacySettings, PublicProfile } from '@/api/profile';

const fmt = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : value.toLocaleString();

const ordinal = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : `#${value.toLocaleString()}`;

export type BoolPrivacyKey = Exclude<keyof PrivacySettings, 'hidden_guilds'>;

/** Anchor ids for the settings groups, shared with the page's jump index. */
export const SETTINGS_SECTIONS = [
  { id: 'settings-visibility', label: 'Who can see you' },
  { id: 'settings-profile-details', label: 'What your profile shows' },
  { id: 'settings-servers', label: 'Servers' },
  { id: 'settings-notifications', label: 'Notifications' },
  { id: 'settings-timezone', label: 'Timezone' },
  { id: 'settings-spotify', label: 'Spotify listening' },
] as const;

export const OwnerSettings: React.FC<{
  privacy: PrivacySettings;
  guilds: PublicProfile['guilds'];
  timezone: string;
  saving: boolean;
  timezoneSaving: boolean;
  onToggle: (key: BoolPrivacyKey, value: boolean) => void;
  onToggleGuild: (guildId: string, hidden: boolean) => void;
  onTimezoneChange: (timezone: string) => void;
}> = ({
  privacy,
  guilds,
  timezone,
  saving,
  timezoneSaving,
  onToggle,
  onToggleGuild,
  onTimezoneChange,
}) => {
  // The API returns no profile at all to other people while this is off, so
  // the profile-content groups below have no visible effect until it is on.
  const profileHidden = !privacy.profile_public;
  const deviceTimezone = detectBrowserTimezone();

  return (
    <div className="settings-groups">
      <SettingsGroup
        id="settings-visibility"
        icon={Eye}
        title="Who can see you"
        description="Decide who can open your profile page and who sees your real name and avatar."
      >
        <Toggle label="Public profile page" hint="Anyone with the link can open your profile. Turn this off and only you can see it." checked={privacy.profile_public} disabled={saving} onChange={(value) => onToggle('profile_public', value)} />
        <Toggle label="Show my name and avatar to everyone" hint="When off, people who don’t share a server with you see a masked name and a blurred avatar on leaderboards and your profile." checked={privacy.public_identity} disabled={saving} onChange={(value) => onToggle('public_identity', value)} />
        <Toggle label="Use my Discord avatar" hint="When off, your profile shows a default avatar instead." checked={privacy.show_avatar} disabled={saving} onChange={(value) => onToggle('show_avatar', value)} />
      </SettingsGroup>

      <SettingsGroup
        id="settings-profile-details"
        icon={BarChart3}
        title="What your profile shows"
        description="Pick the stats that appear on your profile page. Your global level is always shown."
        notice={profileHidden ? PROFILE_HIDDEN_NOTICE : undefined}
      >
        <Toggle label="XP and global rank" hint="Your total XP and your position on the global leaderboard" checked={privacy.show_xp} disabled={saving} onChange={(value) => onToggle('show_xp', value)} />
        <Toggle label="Messages" hint="Total messages sent" checked={privacy.show_messages} disabled={saving} onChange={(value) => onToggle('show_messages', value)} />
        <Toggle label="Reactions" hint="Total reactions given and your most-used emoji" checked={privacy.show_reactions} disabled={saving} onChange={(value) => onToggle('show_reactions', value)} />
        <Toggle label="Commands" hint="Total commands used and your most-used commands" checked={privacy.show_commands} disabled={saving} onChange={(value) => onToggle('show_commands', value)} />
        <Toggle label="Economy" hint="Acosmicoin and bank balances, plus your economy rank" checked={privacy.show_economy} disabled={saving} onChange={(value) => onToggle('show_economy', value)} />
        <Toggle label="Achievements" hint="The achievements you’ve unlocked" checked={privacy.show_achievements} disabled={saving} onChange={(value) => onToggle('show_achievements', value)} />
      </SettingsGroup>

      <SettingsGroup
        id="settings-servers"
        icon={Server}
        title="Servers on your profile"
        description="Show your level and rank in each server, or hide the ones you’d rather keep private."
        notice={profileHidden ? PROFILE_HIDDEN_NOTICE : undefined}
      >
        <Toggle label="Show my servers" hint="List your servers with your level and rank in each" checked={privacy.show_guilds} disabled={saving} onChange={(value) => onToggle('show_guilds', value)} />
        {privacy.show_guilds && guilds && guilds.length > 0 && (
          <div className="settings-server-list" role="group" aria-label="Servers shown on your profile">
            <p className="settings-server-list__caption">Switch off any server you don’t want listed.</p>
            {guilds.map((guild) => (
              <Toggle
                key={guild.guild_id}
                label={guild.guild_name || 'Unknown server'}
                hint={`Level ${fmt(guild.level)} · rank ${ordinal(guild.rank)}`}
                checked={!guild.hidden}
                disabled={saving}
                onChange={(visible) => onToggleGuild(guild.guild_id, !visible)}
                compact
              />
            ))}
          </div>
        )}
      </SettingsGroup>

      <SettingsGroup
        id="settings-notifications"
        icon={Bell}
        title="Notifications"
        description="Choose when Acosmibot messages you directly."
      >
        <Toggle label="DM me when I unlock an achievement" hint="Acosmibot sends a Discord DM when a reward is ready to claim." checked={privacy.dm_achievements} disabled={saving} onChange={(value) => onToggle('dm_achievements', value)} />
      </SettingsGroup>

      <SettingsGroup
        id="settings-timezone"
        icon={Clock3}
        title="Timezone"
        description="Acosmibot’s AI uses this for dates and times. Leave it unset to use each server’s default."
      >
        <div className="settings-timezone">
          <label htmlFor="member-timezone">Your timezone</label>
          <TimezoneSelect
            id="member-timezone"
            value={timezone}
            onChange={onTimezoneChange}
            allowEmpty
            emptyLabel="Not set (use each server’s default)"
            disabled={timezoneSaving}
          />
          {timezone === deviceTimezone ? (
            <p className="settings-timezone__match">Matches this device’s timezone.</p>
          ) : (
            <button type="button" disabled={timezoneSaving} onClick={() => onTimezoneChange(deviceTimezone)}>
              Use this device’s timezone ({deviceTimezone.replace(/_/g, ' ')})
            </button>
          )}
        </div>
      </SettingsGroup>
    </div>
  );
};

const PROFILE_HIDDEN_NOTICE = 'Your profile page is private right now, so nobody else sees these. They apply again when you make it public.';

const SettingsGroup: React.FC<{
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  notice?: string;
  children: React.ReactNode;
}> = ({ id, icon: Icon, title, description, notice, children }) => (
  <section id={id} className={`settings-group${notice ? ' is-inactive' : ''}`} aria-labelledby={`${id}-title`}>
    <header>
      <span><Icon aria-hidden="true" /></span>
      <div><h3 id={`${id}-title`}>{title}</h3><p>{description}</p></div>
    </header>
    <div className="settings-group__controls">
      {notice && <p className="settings-group__notice">{notice}</p>}
      {children}
    </div>
  </section>
);

const Toggle: React.FC<{
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  compact?: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, hint, checked, disabled, compact, onChange }) => (
  <label className={`member-toggle${compact ? ' is-compact' : ''}${disabled ? ' is-disabled' : ''}`}>
    <span><strong>{label}</strong><small>{hint}</small></span>
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
    />
    <i aria-hidden="true"><span /></i>
  </label>
);
