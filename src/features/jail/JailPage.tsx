/*
 * THESIS: Jail configuration is a visible lifecycle, not a generic stack of unrelated settings; it refuses the category-default wall of cards.
 * OWN-WORLD: Existing graphite command-deck surfaces, Signal Cyan actions, literal warning/success states, Poppins hierarchy, standard selectors, and compact operational readouts.
 * STORY: A server administrator enables Jail, verifies its channel and trigger, controls ballot safeguards, then understands exactly how confinement ends.
 * FIRST VIEWPORT: Page title and master state lead into a four-stage lifecycle strip; Setup and a truthful reaction-tracker preview occupy the first working region, with Save/Discard remaining persistent.
 * FORM: Lifecycle control matrix, grounded candidate 4, key 67ea0fb7; familiar controls carry a left-to-right operational sequence that stacks on mobile.
 */
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock3, Gavel, LockKeyhole, MessageSquareText, RotateCcw, Vote, WandSparkles } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { ChannelMultiSelect, ChannelSelect, CollapsibleSection, FeatureToggle, LoadingSpinner, NumberInput, RoleMultiSelect, SaveBar } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import { JailConfig } from '@/types/features';
import { showToast } from '@/utils/toast';
import { validateJailConfig } from './jailValidation';
import { useJailConfig } from './useJailConfig';
import { EmojiPicker } from '@/features/slots/EmojiPicker';
import './JailPage.css';

const formatDuration = (seconds: number): string => {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds % 3600 === 0) return `${seconds / 3600} hr`;
  return `${Math.floor(seconds / 3600)} hr ${Math.round((seconds % 3600) / 60)} min`;
};

const formatSentence = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) return `${minutes / 60} hr`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
};

const lifecycleStages = [
  { id: 'setup', label: 'Setup', icon: LockKeyhole, summary: 'Channel + trigger' },
  { id: 'vote', label: 'Vote', icon: Vote, summary: 'Ballot safeguards' },
  { id: 'confine', label: 'Confinement', icon: Gavel, summary: 'Scoped access' },
  { id: 'release', label: 'Release', icon: RotateCcw, summary: 'Automatic restore' },
] as const;

const getCustomEmojiId = (value: string): string | null => {
  const match = value.match(/^<a?:[^:]+:(\d+)>$/);
  return match?.[1] ?? null;
};

export const JailPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { data, emojis, isLoading, loadError, save, isSaving, saveError, setup, isSettingUp, setupError } = useJailConfig(guildId!);
  const { form, setForm, isDirty, resetForm } = useDirtyState<JailConfig>(data);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [setupChannelName, setSetupChannelName] = useState('jail');
  const [setupRoleName, setSetupRoleName] = useState('Inmate');
  const [enableAfterSetup, setEnableAfterSetup] = useState(true);

  const customEmojiId = form ? getCustomEmojiId(form.trigger_emoji) : null;
  const selectedCustomEmoji = useMemo(
    () => customEmojiId ? emojis.find((emoji) => emoji.id === customEmojiId) : undefined,
    [customEmojiId, emojis],
  );
  const validationMessage = form ? validateJailConfig(form) : null;

  if (isLoading) return <LoadingSpinner />;
  if (loadError) {
    return <div className="feature-page jail-page"><div className="jail-error" role="alert"><AlertTriangle aria-hidden="true" /><span>Could not load Jail settings: {loadError.message}</span></div></div>;
  }
  if (!form) return <div className="feature-page jail-page"><div className="jail-error" role="alert">No Jail configuration was returned for this server.</div></div>;

  const updateNumber = (field: keyof Pick<JailConfig, 'required_votes' | 'vote_window_seconds' | 'sentence_minutes' | 'target_cooldown_minutes'>, value: number) => {
    setForm({ [field]: value } as Partial<JailConfig>);
  };

  const handleSetup = () => {
    setup({
      channel_name: setupChannelName,
      inmate_role_name: setupRoleName,
      staff_role_ids: form.staff_role_ids,
      enable: enableAfterSetup,
    }, {
      onSuccess: (response) => {
        const jail = response.data.settings.jail;
        setForm({
          channel_id: jail.channel_id,
          inmate_role_id: jail.inmate_role_id,
          staff_role_ids: jail.staff_role_ids ?? [],
          enabled: jail.enabled,
        });
        showToast(response.message ?? 'Jail channel and Inmate role are ready.', 'success');
      },
    });
  };

  return (
    <div className="feature-page jail-page">
      <header className="jail-page__header">
        <div>
          <p className="jail-kicker">Chaos / community control</p>
          <h1>Jail configuration</h1>
          <p>Turn a qualifying reaction into one durable ballot, then confine the message author for a defined sentence.</p>
        </div>
        <div className={`jail-state-readout${form.enabled ? ' is-active' : ''}`} role="status">
          <span className="jail-state-readout__dot" aria-hidden="true" />
          <span><strong>{form.enabled ? 'Ready to operate' : 'Feature disabled'}</strong><small>{form.enabled ? 'Watching eligible channels' : 'Save an enabled setup to begin'}</small></span>
        </div>
      </header>

      <FeatureToggle
        enabled={form.enabled}
        onChange={(enabled) => setForm({ enabled })}
        label="Enable server Jail"
        description="A reaction ballot is opt-in per server. Owners, administrators, bots, webhooks, and protected roles remain immune."
      />

      <ol className="jail-lifecycle" aria-label="Jail lifecycle">
        {lifecycleStages.map(({ id, label, icon: Icon, summary }, index) => (
          <li key={id} className={form.enabled || index === 0 ? 'is-reachable' : ''}>
            <span className="jail-lifecycle__index">0{index + 1}</span>
            <Icon aria-hidden="true" />
            <span><strong>{label}</strong><small>{summary}</small></span>
            {index < lifecycleStages.length - 1 && <span className="jail-lifecycle__connector" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      <section className="jail-autosetup" aria-labelledby="jail-autosetup-title">
        <div className="jail-autosetup__copy">
          <div className="jail-panel__heading">
            <div><span className="jail-stage-label">Recommended first step</span><h2 id="jail-autosetup-title">Create the private Jail setup automatically</h2></div>
            <WandSparkles aria-hidden="true" />
          </div>
          <p>We’ll create a text channel, an Inmate status role, and the permission rules that keep the channel visible to staff and jailed members. You can still fine-tune the advanced controls below.</p>
          <ul className="jail-autosetup__checks">
            <li><Check aria-hidden="true" /> Members only receive access while their case is active.</li>
            <li><Check aria-hidden="true" /> Existing Jail IDs are repaired instead of creating duplicates.</li>
            <li><AlertTriangle aria-hidden="true" /> Discord Administrator access always bypasses channel overwrites.</li>
          </ul>
        </div>
        <div className="jail-autosetup__form">
          <div className="jail-autosetup__inputs">
            <label className="jail-setup-input"><span>Channel name</span><input className="form-control" value={setupChannelName} maxLength={100} onChange={(event) => setSetupChannelName(event.target.value)} placeholder="jail" /></label>
            <label className="jail-setup-input"><span>Inmate role name</span><input className="form-control" value={setupRoleName} maxLength={100} onChange={(event) => setSetupRoleName(event.target.value)} placeholder="Inmate" /></label>
          </div>
          <RoleMultiSelect
            guildId={guildId!}
            value={form.staff_role_ids}
            onChange={(staff_role_ids) => setForm({ staff_role_ids })}
            label="Staff roles with Jail access (optional)"
            placeholder="Leave empty to auto-detect Administrator / Manage Server roles"
          />
          <label className="jail-setup-enable"><input type="checkbox" checked={enableAfterSetup} onChange={(event) => setEnableAfterSetup(event.target.checked)} /><span><strong>Enable Jail after setup</strong><small>Turn the feature on as soon as Discord confirms both resources.</small></span></label>
          <button type="button" className="jail-setup-button" onClick={handleSetup} disabled={isSettingUp || !setupChannelName.trim() || !setupRoleName.trim()}>
            <WandSparkles aria-hidden="true" />{isSettingUp ? 'Creating Discord setup…' : form.channel_id && form.inmate_role_id ? 'Repair Jail setup' : 'Create Jail setup'}
          </button>
          {setupError && <p className="jail-setup-error" role="alert"><AlertTriangle aria-hidden="true" />{setupError.message}</p>}
          {form.channel_id && form.inmate_role_id && !setupError && <p className="jail-setup-success" role="status"><Check aria-hidden="true" />Channel and Inmate role are connected. The setup button can safely repair their permissions later.</p>}
        </div>
      </section>

      <fieldset className={`jail-controls${form.enabled ? '' : ' is-gated'}`} disabled={!form.enabled}>
        <div className="jail-first-row">
          <section className="jail-panel jail-setup-panel" aria-labelledby="jail-setup-title">
            <div className="jail-panel__heading">
              <div><span className="jail-stage-label">01 / Setup</span><h2 id="jail-setup-title">Give the ballot a clear home</h2></div>
              <LockKeyhole aria-hidden="true" />
            </div>
            <p className="jail-panel__intro">Choose where members are confined and what reaction opens the single edited tracker.</p>
            <ChannelSelect
              guildId={guildId!}
              value={form.channel_id}
              onChange={(channel_id) => setForm({ channel_id })}
              channelTypes={[0]}
              label="Jail channel"
              placeholder="Choose an ordinary text channel"
            />
            <div className="jail-form-group">
              <span className="form-label d-block" id="jail-emoji-label">Trigger reaction</span>
              <button
                type="button"
                className="jail-emoji-trigger"
                aria-haspopup="dialog"
                aria-label={`Choose Jail trigger reaction, currently ${form.trigger_emoji || 'not selected'}`}
                onClick={() => setEmojiPickerOpen(true)}
              >
                {selectedCustomEmoji ? <img src={selectedCustomEmoji.url} alt="" /> : <span className="jail-emoji-character">{form.trigger_emoji || '—'}</span>}
                <span>{selectedCustomEmoji ? `:${selectedCustomEmoji.name}:` : form.trigger_emoji || 'Select a reaction'}</span>
                <span className="jail-emoji-trigger__hint">Change</span>
              </button>
              <small className="jail-help">Standard Unicode and this server’s custom emoji are supported. Matching custom emoji uses its ID.</small>
            </div>
          </section>

          <section className="jail-panel jail-preview-panel" aria-labelledby="jail-preview-title">
            <div className="jail-panel__heading">
              <div><span className="jail-stage-label">Live shape / synthetic</span><h2 id="jail-preview-title">Reaction tracker preview</h2></div>
              <MessageSquareText aria-hidden="true" />
            </div>
            <p className="jail-panel__intro">A truthful preview of the one bot-authored message that is edited as votes change. It is not a live Discord message.</p>
            <div className="jail-discord-preview" aria-label="Synthetic Discord ballot preview">
              <div className="jail-discord-preview__topline"><span className="jail-bot-avatar">A</span><span><strong>Acosmibot</strong><small>BOT · just now</small></span><span className="jail-synthetic-badge">SYNTHETIC PREVIEW</span></div>
              <h3>Jail vote for a member</h3>
              <p><strong>{Math.min(3, form.required_votes)} / {form.required_votes} votes</strong> · {Math.max(form.required_votes - Math.min(3, form.required_votes), 0)} remaining</p>
              <div className="jail-discord-preview__meter"><span style={{ width: `${Math.min(100, (Math.min(3, form.required_votes) / form.required_votes) * 100)}%` }} /></div>
              <small>Closes in {formatDuration(form.vote_window_seconds)} · Removing the reaction withdraws a vote while active.</small>
              <a href="#jail-preview-title" onClick={(event) => event.preventDefault()}>Jump to source message ↗</a>
            </div>
          </section>
        </div>

        <div className="jail-lifecycle-grid">
          <section className="jail-panel" aria-labelledby="jail-vote-title">
            <div className="jail-panel__heading"><div><span className="jail-stage-label">02 / Vote</span><h2 id="jail-vote-title">Set the ballot safeguards</h2></div><Vote aria-hidden="true" /></div>
            <div className="jail-field-grid">
              <label className="jail-number-field"><span>Required votes</span><NumberInput value={form.required_votes} min={2} max={25} step={1} aria-label="Required votes" onValueChange={(value) => updateNumber('required_votes', value)} /><small>2–25 unique voters</small></label>
              <label className="jail-number-field"><span>Ballot window</span><NumberInput value={form.vote_window_seconds} min={60} max={86400} step={60} aria-label="Ballot window in seconds" onValueChange={(value) => updateNumber('vote_window_seconds', value)} /><small>60 sec–24 hr</small></label>
            </div>
            <ChannelMultiSelect
              guildId={guildId!}
              value={form.allowed_channel_ids}
              onChange={(allowed_channel_ids) => setForm({ allowed_channel_ids })}
              excludeIds={form.channel_id ? [form.channel_id] : []}
              label="Eligible vote channels"
              placeholder="All text channels except Jail"
            />
            <p className="jail-help"><Check aria-hidden="true" /> Empty means every eligible text or announcement channel except the Jail channel.</p>
          </section>

          <section className="jail-panel" aria-labelledby="jail-release-title">
            <div className="jail-panel__heading"><div><span className="jail-stage-label">04 / Release</span><h2 id="jail-release-title">Make the ending explicit</h2></div><Clock3 aria-hidden="true" /></div>
            <div className="jail-field-grid">
              <label className="jail-number-field"><span>Sentence duration</span><NumberInput value={form.sentence_minutes} min={1} max={10080} step={1} aria-label="Sentence duration in minutes" onValueChange={(value) => updateNumber('sentence_minutes', value)} /><small>1 min–7 days · current {formatSentence(form.sentence_minutes)}</small></label>
              <label className="jail-number-field"><span>Failed-ballot cooldown</span><NumberInput value={form.target_cooldown_minutes} min={0} max={10080} step={1} aria-label="Failed-ballot cooldown in minutes" onValueChange={(value) => updateNumber('target_cooldown_minutes', value)} /><small>0 min–7 days before another ballot</small></label>
            </div>
            <p className="jail-help"><RotateCcw aria-hidden="true" /> Automatic release restores only the Jail-touched permissions. Moderators can release early with <code>/jail release</code>.</p>
          </section>
        </div>

        <CollapsibleSection title="03 / Confinement safeguards" defaultOpen>
          <div className="jail-safeguards">
            <div className="jail-safeguards__controls">
              <RoleMultiSelect guildId={guildId!} value={form.protected_role_ids} onChange={(protected_role_ids) => setForm({ protected_role_ids })} disabled={!form.enabled} label="Protected roles" placeholder="No protected roles — choose any roles immune to ballots" />
              <ChannelSelect guildId={guildId!} value={form.mod_log_channel_id} onChange={(mod_log_channel_id) => setForm({ mod_log_channel_id })} label="Optional Jail mod-log channel" placeholder="Do not send a separate Jail mod-log" />
            </div>
            <div className="jail-guidance" role="note">
              <p><strong>Permission readiness</strong><span>Configuration-based guidance, not a live permission check.</span></p>
              <ul>
                <li><Check aria-hidden="true" /> Acosmibot needs <strong>Manage Roles</strong> to install member-specific channel overwrites.</li>
                <li><Check aria-hidden="true" /> Connected voice members also require <strong>Move Members</strong>.</li>
                <li><AlertTriangle aria-hidden="true" /> Server owners and members with <strong>Administrator</strong> are always immune.</li>
              </ul>
            </div>
          </div>
        </CollapsibleSection>
      </fieldset>

      <EmojiPicker
        open={emojiPickerOpen}
        onClose={() => setEmojiPickerOpen(false)}
        onSelect={(trigger_emoji) => { setForm({ trigger_emoji }); setEmojiPickerOpen(false); }}
        serverEmojis={emojis}
        usedEmojis={[]}
      />

      <SaveBar
        isDirty={isDirty}
        onSave={() => save(form)}
        onDiscard={resetForm}
        isSaving={isSaving}
        saveError={saveError}
        saveDisabled={Boolean(validationMessage)}
        validationMessage={validationMessage ?? undefined}
      />
    </div>
  );
};
