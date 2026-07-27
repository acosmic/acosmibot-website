import React from 'react';
import { Bell, Clock3, Eye, Palette, Server } from 'lucide-react';
import { TimezoneSelect, detectBrowserTimezone } from '@/components/ui/TimezoneSelect';
import type { PrivacySettings, PublicProfile } from '@/api/profile';

const fmt = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : value.toLocaleString();

const ordinal = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : `#${value.toLocaleString()}`;

export type BoolPrivacyKey = Exclude<keyof PrivacySettings, 'hidden_guilds'>;

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
}) => (
  <div className="settings-groups">
    <SettingsGroup
      icon={Eye}
      title="Public profile"
      description="Your name and global level always identify the member record. Route every other public signal here."
    >
      <Toggle label="Public profile" hint="Allow anyone to open your profile page" checked={privacy.profile_public} disabled={saving} onChange={(value) => onToggle('profile_public', value)} />
      <Toggle label="Avatar" hint="Show your Discord avatar instead of the anonymous identity" checked={privacy.show_avatar} disabled={saving} onChange={(value) => onToggle('show_avatar', value)} />
      <Toggle label="Public identity" hint="Show your name and avatar to people who do not share a server with you" checked={privacy.public_identity} disabled={saving} onChange={(value) => onToggle('public_identity', value)} />
    </SettingsGroup>

    <SettingsGroup
      icon={Palette}
      title="Activity & progression"
      description="Choose which earned stats become part of your public member dossier."
    >
      <Toggle label="XP & global rank" hint="Global XP and leaderboard position" checked={privacy.show_xp} disabled={saving} onChange={(value) => onToggle('show_xp', value)} />
      <Toggle label="Messages" hint="Total messages sent" checked={privacy.show_messages} disabled={saving} onChange={(value) => onToggle('show_messages', value)} />
      <Toggle label="Reactions" hint="Total reactions given" checked={privacy.show_reactions} disabled={saving} onChange={(value) => onToggle('show_reactions', value)} />
      <Toggle label="Commands" hint="Total commands used" checked={privacy.show_commands} disabled={saving} onChange={(value) => onToggle('show_commands', value)} />
      <Toggle label="Economy" hint="Net worth and economy leaderboard rank" checked={privacy.show_economy} disabled={saving} onChange={(value) => onToggle('show_economy', value)} />
      <Toggle label="Achievements" hint="Unlocked badge collection" checked={privacy.show_achievements} disabled={saving} onChange={(value) => onToggle('show_achievements', value)} />
    </SettingsGroup>

    <SettingsGroup
      icon={Server}
      title="Server identity"
      description="Expose per-server levels and ranks, then hide individual communities when needed."
    >
      <Toggle label="Show servers" hint="Display your visible server identities" checked={privacy.show_guilds} disabled={saving} onChange={(value) => onToggle('show_guilds', value)} />
      {privacy.show_guilds && guilds && guilds.length > 0 && (
        <div className="settings-server-list">
          {guilds.map((guild) => (
            <Toggle
              key={guild.guild_id}
              label={guild.guild_name || 'Unknown Server'}
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
      icon={Bell}
      title="Notifications"
      description="Choose whether achievement unlocks should reach you outside the website."
    >
      <Toggle label="Achievement DMs" hint="Receive a Discord DM when a reward is ready to claim" checked={privacy.dm_achievements} disabled={saving} onChange={(value) => onToggle('dm_achievements', value)} />
    </SettingsGroup>

    <SettingsGroup
      icon={Clock3}
      title="Personal timezone"
      description="The AI uses this clock for dates and times. No preference falls back to each server’s default."
    >
      <div className="settings-timezone">
        <label htmlFor="member-timezone">Timezone</label>
        <TimezoneSelect
          id="member-timezone"
          value={timezone}
          onChange={onTimezoneChange}
          allowEmpty
          emptyLabel="No preference (use server default)"
          disabled={timezoneSaving}
        />
        <button
          type="button"
          disabled={timezoneSaving}
          onClick={() => onTimezoneChange(detectBrowserTimezone())}
        >
          Use current timezone · {detectBrowserTimezone().replace(/_/g, ' ')}
        </button>
      </div>
    </SettingsGroup>
  </div>
);

const SettingsGroup: React.FC<{
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}> = ({ icon: Icon, title, description, children }) => (
  <section className="settings-group">
    <header>
      <span><Icon aria-hidden="true" /></span>
      <div><h3>{title}</h3><p>{description}</p></div>
    </header>
    <div className="settings-group__controls">{children}</div>
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
