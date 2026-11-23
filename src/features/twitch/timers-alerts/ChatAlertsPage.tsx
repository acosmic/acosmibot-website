/**
 * Chat alerts (§11.4, §12.2): one card per alert type with its message template,
 * minimum amount and how it is sent, the raid shoutout options, and a "Send test"
 * button per alert. A test uses the saved message, so unsaved edits are flagged.
 */
import React from 'react';
import { Send } from 'lucide-react';
import { FeatureToggle, NumberInput } from '@/components/ui';
import { showToast } from '@/utils/toast';
import type { SectionProps } from '../types';
import {
  DurationInput,
  Field,
  ReadOnlyNotice,
  SectionPage,
  SettingsSaveBar,
  Switch,
  TemplateField,
  hasRole,
  useChannelMutation,
  useSectionSettings,
} from '../shared/ui';
import { alertsApi } from './api';
import {
  ALERTS,
  ALERT_TEMPLATE_MAX,
  ANNOUNCE_COLORS,
  RAID_SHOUTOUT_VARS,
  alertChanged,
  describeRunFailure,
  type AlertKey,
  type AlertMeta,
  type AlertTemplate,
  type AnnounceColor,
  type ChatAlertsSettings,
  type SendMode,
} from './model';
import './timers-alerts.css';

interface AlertCardProps {
  meta: AlertMeta;
  value: AlertTemplate;
  saved: AlertTemplate | undefined;
  issues: string[];
  disabled: boolean;
  canTest: boolean;
  testing: boolean;
  onChange: (next: AlertTemplate) => void;
  onTest: (key: AlertKey) => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ meta, value, saved, issues, disabled, canTest, testing, onChange, onTest }) => {
  const unsaved = alertChanged(value, saved);
  const patch = (next: Partial<AlertTemplate>) => onChange({ ...value, ...next });
  return (
    <section className="tw-ta-card" aria-labelledby={`tw-alert-${meta.key}`}>
      <div className="tw-ta-card__header">
        <div>
          <h2 id={`tw-alert-${meta.key}`} className="tw-ta-card__title">{meta.label}</h2>
          <p className="tw-muted">{meta.description}</p>
        </div>
        <Switch label={`${meta.label} alert`} checked={value.enabled} disabled={disabled}
          onChange={(enabled) => patch({ enabled })} />
      </div>
      <TemplateField
        label="Message" value={value.template} maxLength={ALERT_TEMPLATE_MAX} context="alert" rows={2}
        contextVars={meta.vars} field={`chat_alerts.${meta.key}.template`}
        issues={issues} disabled={disabled}
        onChange={(template) => patch({ template })}
      />
      <div className="tw-ta-card__grid">
        {meta.minLabel && (
          <Field label={meta.minLabel} help="Smaller amounts do not post. 0 posts every time.">
            {(control) => (
              <NumberInput {...control} className="form-control" min={0} max={1_000_000} value={value.min_amount}
                disabled={disabled} onValueChange={(min_amount) => patch({ min_amount })} />
            )}
          </Field>
        )}
        <Field label="Send as">
          {(control) => (
            <select {...control} className="form-select" value={value.send_mode} disabled={disabled}
              onChange={(event) => patch({ send_mode: event.target.value as SendMode })}>
              <option value="say">A chat message</option>
              <option value="announce">An announcement</option>
            </select>
          )}
        </Field>
        {value.send_mode === 'announce' && (
          <Field label="Announcement colour">
            {(control) => (
              <select {...control} className="form-select" value={value.announce_color} disabled={disabled}
                onChange={(event) => patch({ announce_color: event.target.value as AnnounceColor })}>
                {ANNOUNCE_COLORS.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}
              </select>
            )}
          </Field>
        )}
      </div>
      {meta.testable && (
        <div className="tw-ta-card__footer">
          <button type="button" className="btn" disabled={!canTest || unsaved || testing}
            aria-label={`Send a test ${meta.label} alert`} onClick={() => onTest(meta.key)}>
            <Send size={16} aria-hidden="true" /> Send test
          </button>
          <span className="tw-muted">
            {!canTest
              ? 'Testing needs the editor role.'
              : unsaved
                ? 'Save your changes first. The test sends the saved message.'
                : 'Posts the saved message in chat with sample values, marked [Test].'}
          </span>
        </div>
      )}
    </section>
  );
};

export const ChatAlertsPage: React.FC<SectionProps> = ({ channelId, role }) => {
  const settings = useSectionSettings<ChatAlertsSettings>(channelId, 'chat_alerts');
  const form = settings.form;
  const saved = settings.value;
  const canTest = hasRole(role, 'editor');

  const test = useChannelMutation({
    mutationFn: (kind: AlertKey) => alertsApi.test(channelId, kind),
    errorMessage: 'Could not send the test.',
    onSuccess: (result) => {
      if (result.sent) showToast('Test sent to chat', 'success');
      else showToast(describeRunFailure(result.reason), 'error');
    },
  });

  return (
    <SectionPage
      title="Chat alerts"
      description="Messages the bot posts when something happens in your channel. Names and viewer messages are filled in as plain text, never run as commands."
      query={settings.query}
    >
      {!settings.canWrite && <ReadOnlyNotice required={settings.writeRole} role={role} what="these alerts" />}
      {form && (
        <div className="tw-ta-stack">
          <FeatureToggle
            label="Chat alerts" description="Turn every alert below on or off at once."
            enabled={form.enabled}
            onChange={(enabled) => settings.canWrite && settings.setForm({ enabled })}
          />
          {ALERTS.map((meta) => (
            <AlertCard
              key={meta.key}
              meta={meta}
              value={form[meta.key]}
              saved={saved?.[meta.key]}
              issues={settings.issuesFor(`chat_alerts.${meta.key}.template`)}
              disabled={!settings.canWrite}
              canTest={canTest}
              testing={test.isPending}
              onChange={(next) => settings.updateForm((current) => ({ ...current, [meta.key]: next }))}
              onTest={(kind) => test.mutate(kind)}
            />
          ))}

          <section className="tw-ta-card" aria-labelledby="tw-alert-shoutout">
            <div className="tw-ta-card__header">
              <div>
                <h2 id="tw-alert-shoutout" className="tw-ta-card__title">Raid shoutout</h2>
                <p className="tw-muted">After a raid, the bot can thank the raider and point chat at their channel.</p>
              </div>
              <Switch label="Raid shoutout" checked={form.raid_shoutout.enabled} disabled={!settings.canWrite}
                onChange={(enabled) => settings.updateForm((c) => ({ ...c, raid_shoutout: { ...c.raid_shoutout, enabled } }))} />
            </div>
            <TemplateField
              label="Shoutout message" value={form.raid_shoutout_template} maxLength={ALERT_TEMPLATE_MAX} context="alert"
              contextVars={[...RAID_SHOUTOUT_VARS]} field="chat_alerts.raid_shoutout_template" rows={2}
              issues={settings.issuesFor('chat_alerts.raid_shoutout_template')} disabled={!settings.canWrite}
              help="$(raider_game) is the last game the raider played; it reads “a game” when Twitch does not say."
              onChange={(raid_shoutout_template) => settings.setForm({ raid_shoutout_template })}
            />
            <div className="tw-ta-card__grid">
              <Field label="Minimum raid size" help="Smaller raids get no shoutout.">
                {(control) => (
                  <NumberInput {...control} className="form-control" min={0} max={100_000}
                    value={form.raid_shoutout.min_viewers} disabled={!settings.canWrite}
                    onValueChange={(min_viewers) => settings.updateForm((c) => ({ ...c, raid_shoutout: { ...c.raid_shoutout, min_viewers } }))} />
                )}
              </Field>
              <DurationInput
                label="Wait before the shoutout" seconds={form.raid_shoutout.delay_s} min={0} max={120} units={['s']}
                disabled={!settings.canWrite}
                onChange={(delay_s) => settings.updateForm((c) => ({ ...c, raid_shoutout: { ...c.raid_shoutout, delay_s } }))}
              />
            </div>
            <Switch
              label="Also use Twitch's shoutout"
              description="Sends Twitch's own shoutout card too. Twitch only allows it while the raider is live, and the bot needs to be a moderator."
              checked={form.raid_shoutout.native} disabled={!settings.canWrite}
              onChange={(native) => settings.updateForm((c) => ({ ...c, raid_shoutout: { ...c.raid_shoutout, native } }))}
            />
          </section>

          <section className="tw-ta-card" aria-labelledby="tw-alert-shared">
            <h2 id="tw-alert-shared" className="tw-ta-card__title">Shared chat</h2>
            <Switch
              label="Alert for subscriptions in shared chat sessions"
              description="Off by default. When on, subs and gifts that happen in another channel of a shared chat session also post here."
              checked={form.shared_chat_alerts} disabled={!settings.canWrite}
              onChange={(shared_chat_alerts) => settings.setForm({ shared_chat_alerts })}
            />
          </section>
        </div>
      )}
      <SettingsSaveBar settings={settings} />
    </SectionPage>
  );
};
