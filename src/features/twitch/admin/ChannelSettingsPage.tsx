/**
 * Channel settings (§11.4, §12.10): the `general` settings section, the custom
 * bot account (connect through Twitch / disconnect), pause and resume, removing
 * Acosmibot and its data from the channel (type the login to confirm), and
 * "Delete my viewer data everywhere" for the signed-in person.
 *
 * Editors can change the general settings; the bot account, pause/resume and
 * channel removal are the broadcaster's. The API re-checks the role on every
 * request and runs deletions through the bot's deletion worker.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Pause, Play, Trash2 } from 'lucide-react';
import { ConfirmDialog, TimezoneSelect } from '@/components/ui';
import { showToast } from '@/utils/toast';
import type { SectionProps } from '../types';
import { startCustomBotLogin } from '../shared/auth';
import { useTwitchAuthStore } from '../shared/authStore';
import {
  ConfirmTypeDialog,
  Field,
  ReadOnlyNotice,
  RoleGate,
  SectionPage,
  SettingsSaveBar,
  StatusChip,
  Switch,
  TWITCH_CHANNELS_KEY,
  UserLookupInput,
  hasRole,
  summaryKey,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useChannel,
  useChannelMutation,
  useSectionSettings,
  type SectionSettings,
} from '../shared/ui';
import { channelAdminApi } from './api';
import {
  DELETION_COPY,
  PREFIX_CHOICES,
  REPLY_STYLES,
  customBotLoginProblem,
  deletionView,
  generalSettingsProblem,
  normalizeLogin,
  parseLoginList,
  type GeneralSettings,
} from './model';
import './admin.css';

const GeneralForm: React.FC<{ settings: SectionSettings<GeneralSettings>; role: SectionProps['role'] }> = ({ settings, role }) => {
  const form = settings.form;
  const [ignoredText, setIgnoredText] = useState('');
  const savedIgnored = (settings.value?.ignored_logins ?? []).join(', ');

  // Show the saved list whenever the form is clean (load, save, discard, reload).
  useEffect(() => {
    if (!settings.isDirty) setIgnoredText(savedIgnored);
  }, [savedIgnored, settings.isDirty]);

  if (!form) return null;
  const disabled = !settings.canWrite;
  const set = (patch: Partial<GeneralSettings>) => { if (settings.canWrite) settings.setForm(patch); };
  const issue = (field: string) => settings.issuesFor(`general.${field}`)[0];

  return (
    <section className="tw-admin-card" aria-labelledby="tw-settings-general">
      <h2 id="tw-settings-general" className="tw-admin-card__title">General</h2>
      {!settings.canWrite && <ReadOnlyNotice required={settings.writeRole} role={role} />}
      <div className="tw-admin-grid">
        <Field label="Built-in command prefix" help="The character before built-in commands such as !uptime. Custom commands keep their own names."
          error={issue('command_prefix')}>
          {(control) => (
            <select {...control} className="form-select" value={form.command_prefix} disabled={disabled}
              onChange={(event) => set({ command_prefix: event.target.value })}>
              {PREFIX_CHOICES.map((prefix) => <option key={prefix} value={prefix}>{prefix}</option>)}
            </select>
          )}
        </Field>
        <Field label="Time zone" help="Used by $(time), quote dates and other times shown in chat." error={issue('timezone')}>
          {(control) => <TimezoneSelect id={control.id} value={form.timezone} disabled={disabled} onChange={(timezone) => set({ timezone })} />}
        </Field>
        <Field label="How replies address viewers" help={REPLY_STYLES.find((style) => style.id === form.reply_style)?.example}>
          {(control) => (
            <select {...control} className="form-select" value={form.reply_style} disabled={disabled}
              onChange={(event) => set({ reply_style: event.target.value as GeneralSettings['reply_style'] })}>
              {REPLY_STYLES.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}
            </select>
          )}
        </Field>
        <Field label="Longest response" help="Responses longer than one chat message are split into at most this many messages.">
          {(control) => (
            <select {...control} className="form-select" value={form.max_messages_per_response} disabled={disabled}
              onChange={(event) => set({ max_messages_per_response: Number(event.target.value) })}>
              {[1, 2, 3].map((count) => <option key={count} value={count}>{count} message{count === 1 ? '' : 's'}</option>)}
            </select>
          )}
        </Field>
        <Field label="Shared chat" help="When your chat is shared with another channel during a stream together.">
          {(control) => (
            <select {...control} className="form-select" value={form.shared_chat_mode} disabled={disabled}
              onChange={(event) => set({ shared_chat_mode: event.target.value as GeneralSettings['shared_chat_mode'] })}>
              <option value="ignore">Ignore the other channel’s viewers</option>
              <option value="commands">Let them use commands (no points or costs)</option>
            </select>
          )}
        </Field>
      </div>
      <Switch label="Silent mode" description="Acosmibot sends nothing in chat except moderation warnings. Moderation and points keep working."
        checked={form.silent} onChange={(silent) => set({ silent })} disabled={disabled} />
      <Switch label="Ignore known bots" description="Messages from Nightbot, StreamElements and other common bots never trigger commands."
        checked={form.ignore_known_bots} onChange={(ignore_known_bots) => set({ ignore_known_bots })} disabled={disabled} />
      <Field label="Ignored users" optional help="Twitch usernames, separated by commas or spaces. Acosmibot ignores their messages (up to 100)."
        error={issue('ignored_logins')}>
        {(control) => (
          <textarea {...control} className="form-control" rows={2} spellCheck={false} value={ignoredText} disabled={disabled}
            onChange={(event) => {
              setIgnoredText(event.target.value);
              set({ ignored_logins: parseLoginList(event.target.value).logins });
            }} />
        )}
      </Field>
      <SettingsSaveBar settings={settings} validationMessage={generalSettingsProblem(form, ignoredText) ?? undefined} />
    </section>
  );
};

export const ChannelSettingsPage: React.FC<SectionProps> = ({ channelId, channel, role }) => {
  const settings = useSectionSettings<GeneralSettings>(channelId, 'general');
  const { refetch } = useChannel();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const isBroadcaster = hasRole(role, 'broadcaster');

  const [botLogin, setBotLogin] = useState('');
  const [botProblem, setBotProblem] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'pause' | 'disconnect_bot' | 'delete_channel' | 'delete_me' | null>(null);
  const [removalStarted, setRemovalStarted] = useState(false);

  useEffect(() => {
    if (params.get('custom_bot') !== 'connected') return;
    showToast('Your custom bot account is connected.', 'success');
    const next = new URLSearchParams(params);
    next.delete('custom_bot');
    setParams(next, { replace: true });
    void refetch();
  }, [params, setParams, refetch]);

  const deletion = useQuery({
    queryKey: tk(channelId, 'settings-page', 'deletion'),
    queryFn: () => channelAdminApi.deletion(channelId),
    enabled: isBroadcaster,
    retry: twitchRetry,
    refetchInterval: (query) => (removalStarted && deletionView(query.state.data ?? null) !== 'completed' ? 10_000 : false),
  });
  const removal = deletionView(deletion.data ?? null);
  const showRemoval = removalStarted || (removal !== 'none' && removal !== 'completed');

  const afterChange = { invalidate: [summaryKey(channelId)], onSuccess: () => { void refetch(); } };
  const pause = useChannelMutation({
    mutationFn: () => channelAdminApi.pause(channelId), successMessage: 'Acosmibot is paused in this channel.',
    errorMessage: 'Could not pause.', ...afterChange,
    onSuccess: () => { setConfirm(null); void refetch(); }, onError: () => setConfirm(null),
  });
  const resume = useChannelMutation({
    mutationFn: () => channelAdminApi.resume(channelId), successMessage: 'Acosmibot is running in this channel again.',
    errorMessage: 'Could not resume.', ...afterChange,
  });
  const disconnectBot = useChannelMutation({
    mutationFn: () => channelAdminApi.removeCustomBot(channelId), successMessage: 'Custom bot disconnected. Acosmibot chats as itself again.',
    errorMessage: 'Could not disconnect the custom bot.', ...afterChange,
    onSuccess: () => { setConfirm(null); void refetch(); }, onError: () => setConfirm(null),
  });
  const deleteChannel = useChannelMutation({
    mutationFn: () => channelAdminApi.deleteChannel(channelId, channel.login),
    errorMessage: 'Could not start the removal.',
    onSuccess: () => {
      setConfirm(null);
      setRemovalStarted(true);
      void queryClient.invalidateQueries({ queryKey: TWITCH_CHANNELS_KEY });
      void deletion.refetch();
    },
    onError: () => setConfirm(null),
  });
  const deleteMe = useChannelMutation({
    mutationFn: () => channelAdminApi.deleteMyData(),
    errorMessage: 'Could not request the deletion.',
    onSuccess: () => {
      setConfirm(null);
      showToast('Your viewer data will be deleted from every channel within 15 minutes. You have been signed out.', 'success');
      useTwitchAuthStore.getState().setAnonymous();
      navigate('/twitch', { replace: true });
    },
    onError: () => setConfirm(null),
  });

  const bot = channel.bot;
  const sharedBotLogin = bot && !bot.is_custom ? bot.login : null;
  const connectBot = () => {
    const problem = customBotLoginProblem(botLogin, channel.login, sharedBotLogin);
    setBotProblem(problem);
    if (!problem) startCustomBotLogin(channelId, normalizeLogin(botLogin));
  };

  if (showRemoval) {
    return (
      <SectionPage title="Channel settings" description="Removing Acosmibot from this channel.">
        <section className="tw-admin-card tw-admin-card--danger" aria-live="polite">
          <h2 className="tw-admin-card__title">Removal</h2>
          <p>{DELETION_COPY[removal === 'none' ? 'queued' : removal]}</p>
          <p className="tw-muted">You can add Acosmibot to your channel again later; it starts from the default settings.</p>
          <div className="tw-admin-actions">
            <button type="button" className="btn primary" onClick={() => navigate('/twitch/dashboard')}>Back to your channels</button>
          </div>
        </section>
      </SectionPage>
    );
  }

  return (
    <SectionPage title="Channel settings" description={`How Acosmibot behaves in ${channel.display_name}’s chat.`} query={settings.query}>
      <GeneralForm settings={settings} role={role} />

      <section className="tw-admin-card" aria-labelledby="tw-settings-bot">
        <h2 id="tw-settings-bot" className="tw-admin-card__title">Bot account</h2>
        <p className="tw-admin-card__lead">
          {bot?.is_custom
            ? `Acosmibot chats in your channel as your own account ${bot.login ?? ''}.`
            : bot?.login
              ? `Acosmibot chats as ${bot.login}. You can have it use your own bot account instead.`
              : 'No bot account is connected yet. You can connect your own bot account.'}
        </p>
        {bot?.is_custom && <StatusChip tone="active" icon={<Bot size={14} aria-hidden="true" />}>Custom bot</StatusChip>}
        <RoleGate min="broadcaster" role={role} fallback={<p className="tw-muted">Only the broadcaster can change the bot account.</p>}>
          {bot?.is_custom ? (
            <div className="tw-admin-actions">
              <button type="button" className="btn" onClick={() => setConfirm('disconnect_bot')} disabled={disconnectBot.isPending}>
                Disconnect custom bot
              </button>
            </div>
          ) : (
            <form className="tw-admin-inline" onSubmit={(event) => { event.preventDefault(); connectBot(); }} noValidate>
              <UserLookupInput value={botLogin} onChange={(value) => { setBotLogin(value); setBotProblem(null); }}
                label="Bot account username"
                help="You will sign in to Twitch as that account and approve its chat permissions. Make it a moderator of your channel on Twitch afterwards." />
              <button type="submit" className="btn primary tw-admin-inline__action">
                <Bot size={16} aria-hidden="true" /> Connect with Twitch
              </button>
            </form>
          )}
          {botProblem && <p className="tw-field__error" role="alert">{botProblem}</p>}
        </RoleGate>
      </section>

      <RoleGate min="broadcaster" role={role}>
        <section className="tw-admin-card" aria-labelledby="tw-settings-pause">
          <h2 id="tw-settings-pause" className="tw-admin-card__title">Pause</h2>
          <p className="tw-admin-card__lead">
            {channel.status === 'paused'
              ? 'Acosmibot is paused: it does not respond or act in your chat. Settings stay saved.'
              : 'Pausing stops Acosmibot responding and acting in your chat until you resume. Nothing is deleted.'}
          </p>
          {channel.status === 'paused' ? (
            <button type="button" className="btn primary" onClick={() => resume.mutate()} disabled={resume.isPending} aria-busy={resume.isPending}>
              <Play size={16} aria-hidden="true" /> {resume.isPending ? 'Resuming…' : 'Resume Acosmibot'}
            </button>
          ) : channel.status === 'active' ? (
            <button type="button" className="btn" onClick={() => setConfirm('pause')} disabled={pause.isPending}>
              <Pause size={16} aria-hidden="true" /> Pause Acosmibot
            </button>
          ) : (
            <p className="tw-muted">Pausing is available while the channel is active.</p>
          )}
        </section>

        <section className="tw-admin-card tw-admin-card--danger" aria-labelledby="tw-settings-remove">
          <h2 id="tw-settings-remove" className="tw-admin-card__title">Remove Acosmibot from this channel</h2>
          <p className="tw-admin-card__lead">
            Acosmibot leaves your chat now, gives back its Twitch permissions, and deletes this channel’s commands, settings,
            points, logs and every other record within 15 minutes. This cannot be undone.
          </p>
          <button type="button" className="btn tw-admin-danger" onClick={() => setConfirm('delete_channel')} disabled={deleteChannel.isPending}>
            <Trash2 size={16} aria-hidden="true" /> Delete Acosmibot data for this channel
          </button>
        </section>
      </RoleGate>

      <section className="tw-admin-card" aria-labelledby="tw-settings-me">
        <h2 id="tw-settings-me" className="tw-admin-card__title">Your viewer data</h2>
        <p className="tw-admin-card__lead">
          Delete what Acosmibot stored about you as a viewer in every channel that uses it: points, watch time, chat log
          lines, queue and giveaway entries, and your dashboard sign-in. You are signed out. Channels you own are not removed;
          use the option above for that.
        </p>
        <button type="button" className="btn" onClick={() => setConfirm('delete_me')} disabled={deleteMe.isPending}>
          Delete my viewer data everywhere
        </button>
      </section>

      {confirm === 'pause' && (
        <ConfirmDialog kicker="Pause Acosmibot" title={`Pause Acosmibot in ${channel.display_name}?`} confirmLabel="Pause" tone="primary"
          pending={pause.isPending} onConfirm={() => pause.mutate()} onClose={() => setConfirm(null)}>
          <p>Acosmibot stops responding and acting in your chat until you resume. Your settings stay saved.</p>
        </ConfirmDialog>
      )}
      {confirm === 'disconnect_bot' && (
        <ConfirmDialog kicker="Bot account" title="Disconnect your custom bot?" confirmLabel="Disconnect"
          pending={disconnectBot.isPending} onConfirm={() => disconnectBot.mutate()} onClose={() => setConfirm(null)}>
          <p>Acosmibot gives back that account’s Twitch permissions and chats as the shared Acosmibot account again.</p>
        </ConfirmDialog>
      )}
      {confirm === 'delete_channel' && (
        <ConfirmTypeDialog kicker="Remove Acosmibot" title={`Delete all Acosmibot data for ${channel.display_name}?`}
          word={channel.login} caseSensitive={false} confirmLabel="Delete channel data" pending={deleteChannel.isPending}
          onConfirm={() => deleteChannel.mutate()} onClose={() => setConfirm(null)}>
          <p>Acosmibot leaves your chat and deletes this channel’s commands, timers, settings, viewers and points, logs,
            quotes, overlays and analytics within 15 minutes. This cannot be undone.</p>
        </ConfirmTypeDialog>
      )}
      {confirm === 'delete_me' && (
        <ConfirmTypeDialog kicker="Your viewer data" title="Delete your viewer data in every channel?" word="DELETE"
          confirmLabel="Delete my data" pending={deleteMe.isPending} onConfirm={() => deleteMe.mutate()} onClose={() => setConfirm(null)}>
          <p>Your points, watch time and other viewer records are deleted from every channel within 15 minutes, and you are
            signed out. This cannot be undone.</p>
        </ConfirmTypeDialog>
      )}
    </SectionPage>
  );
};
