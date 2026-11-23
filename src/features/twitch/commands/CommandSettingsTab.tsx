/** Settings tab: the `commands` settings section (§4.2 `CommandsSettings`). */
import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { FeatureToggle, LoadFailed, LoadingSpinner } from '@/components/ui';
import type { SectionProps } from '../types';
import { LevelSelect, ReadOnlyNotice, SettingsSaveBar, Switch, useLevelLabel, useSectionSettings } from '../shared/ui';
import type { CommandsSettings } from './model';

export const CommandSettingsTab: React.FC<SectionProps> = ({ channelId, channel, role }) => {
  const settings = useSectionSettings<CommandsSettings>(channelId, 'commands');
  const levelLabel = useLevelLabel();
  const form = settings.form;
  const disabled = !settings.canWrite;

  if (settings.query.isError) {
    return (
      <LoadFailed
        title="Command settings didn't load"
        message={`${settings.query.error instanceof Error ? settings.query.error.message : 'Something went wrong.'} Nothing was changed.`}
        onRetry={() => settings.query.refetch()}
      />
    );
  }
  if (!form) return <LoadingSpinner />;

  return (
    <div className="tw-cmd-stack">
      {!settings.canWrite && <ReadOnlyNotice required={settings.writeRole} role={role} />}
      <FeatureToggle
        label="Custom commands"
        description="When off, your custom commands stay saved but do not answer. Built-in commands keep working."
        enabled={form.enabled}
        onChange={(enabled) => { if (!disabled) settings.setForm({ enabled }); }}
      />
      <section className="tw-cmd-panel" aria-labelledby="tw-cmd-settings-chat">
        <h2 id="tw-cmd-settings-chat" className="tw-section-title">Chat</h2>
        <Switch checked={form.chat_editing_enabled} disabled={disabled} label="Edit commands from chat"
          description="Lets people who can use !command (moderators by default) add, edit and delete commands in chat."
          onChange={(chat_editing_enabled) => settings.setForm({ chat_editing_enabled })} />
        <Switch checked={form.reply_on_cooldown} disabled={disabled} label="Say when a command is on cooldown"
          onChange={(reply_on_cooldown) => settings.setForm({ reply_on_cooldown })} />
        <Switch checked={form.reply_on_level_denied} disabled={disabled} label="Say when someone may not use a command"
          onChange={(reply_on_level_denied) => settings.setForm({ reply_on_level_denied })} />
        <Switch checked={form.reply_on_insufficient_points} disabled={disabled} label="Say when someone cannot afford a command"
          onChange={(reply_on_insufficient_points) => settings.setForm({ reply_on_insufficient_points })} />
        <LevelSelect value={form.cooldown_bypass_level} disabled={disabled} label="Skip cooldowns from"
          help={`${levelLabel(form.cooldown_bypass_level)} and above never wait for a cooldown.`}
          onChange={(cooldown_bypass_level) => settings.setForm({ cooldown_bypass_level })} />
      </section>
      <section className="tw-cmd-panel" aria-labelledby="tw-cmd-settings-public">
        <h2 id="tw-cmd-settings-public" className="tw-section-title">Public command list</h2>
        <Switch checked={form.public_list_enabled} disabled={disabled} label="Publish the command list"
          description="!commands links to the list. When off, !commands names up to 15 commands in chat instead. Hidden commands are never listed, and custom API addresses are replaced by [custom API]."
          onChange={(public_list_enabled) => settings.setForm({ public_list_enabled })} />
        {settings.value?.public_list_enabled && settings.value?.enabled && (
          <Link className="btn" to={`/t/${channel.login}/commands`} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden="true" /> View the public list
          </Link>
        )}
      </section>
      <SettingsSaveBar settings={settings} />
    </div>
  );
};
