/** Song request settings (§4.2 `song_requests`): limits, search, voteskip, fallback, announcement, public page. */
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { FeatureToggle, NumberInput } from '@/components/ui';
import {
  Field, ReadOnlyNotice, SettingsSaveBar, Switch, TemplateField, type SectionSettings,
} from '../shared/ui';
import type { Role } from '../types';
import { SETTINGS_BOUNDS, formatSongDuration, type SongSettings } from './model';
import './song-requests.css';

interface Props {
  settings: SectionSettings<SongSettings>;
  role: Role;
  login: string;
}

const Number_: React.FC<{
  label: string; help?: string; value: number; min: number; max: number; disabled: boolean;
  onChange: (value: number) => void;
}> = ({ label, help, value, min, max, disabled, onChange }) => (
  <Field label={label} help={help}>
    {(control) => (
      <NumberInput {...control} className="form-control" min={min} max={max} value={value} disabled={disabled}
        onValueChange={(next) => onChange(Math.min(max, Math.max(min, Math.round(next))))} />
    )}
  </Field>
);

export const SettingsPanel: React.FC<Props> = ({ settings, role, login }) => {
  const form = settings.form;
  if (!form) return null;
  const disabled = !settings.canWrite;
  const set = (patch: Partial<SongSettings>) => settings.setForm(patch);
  return (
    <div className="tw-st-stack">
      {disabled && <ReadOnlyNotice required={settings.writeRole} role={role} />}
      <FeatureToggle
        label="Song requests"
        description="Lets viewers request YouTube songs with !sr. The queue is played by the player on this page."
        enabled={form.enabled} onChange={(enabled) => !disabled && set({ enabled })}
      />
      <section className="tw-sr-card" aria-labelledby="tw-sr-limits">
        <h2 id="tw-sr-limits" className="tw-st-card__title">Limits</h2>
        <div className="tw-st-grid">
          <Number_ label="Songs in the queue" help="At most this many songs wait at once." value={form.max_queue}
            {...SETTINGS_BOUNDS.max_queue} disabled={disabled} onChange={(max_queue) => set({ max_queue })} />
          <Number_ label="Songs per viewer" help="Moderators are not limited." value={form.max_per_user}
            {...SETTINGS_BOUNDS.max_per_user} disabled={disabled} onChange={(max_per_user) => set({ max_per_user })} />
          <Number_ label="Longest song (seconds)" help={`Currently ${formatSongDuration(form.max_duration_s)}.`} value={form.max_duration_s}
            {...SETTINGS_BOUNDS.max_duration_s} disabled={disabled} onChange={(max_duration_s) => set({ max_duration_s })} />
          <Number_ label="Fewest views" help="Songs with fewer views are refused. 0 allows any." value={form.min_views}
            {...SETTINGS_BOUNDS.min_views} disabled={disabled} onChange={(min_views) => set({ min_views })} />
          <Number_ label="Cost per request" help="Loyalty points a viewer pays in chat. Needs loyalty points turned on. 0 is free; channel point rewards never charge."
            value={form.cost} {...SETTINGS_BOUNDS.cost} disabled={disabled} onChange={(cost) => set({ cost })} />
          <Field label="Region" help="Two letters, such as US. Videos blocked in this region are refused.">
            {(control) => (
              <input {...control} className="form-control" type="text" maxLength={2} value={form.region_code} disabled={disabled}
                onChange={(event) => set({ region_code: event.target.value.toUpperCase().replace(/[^A-Z]/g, '') })} />
            )}
          </Field>
        </div>
        <Switch
          label="Allow searching by song name" checked={form.allow_search} disabled={disabled}
          description="Viewers can type a name instead of a link. Each search uses 100 of the bot's daily YouTube quota units, so it is off by default."
          onChange={(allow_search) => set({ allow_search })}
        />
      </section>
      <section className="tw-sr-card" aria-labelledby="tw-sr-playback">
        <h2 id="tw-sr-playback" className="tw-st-card__title">Playback</h2>
        <div className="tw-st-grid">
          <Number_ label="Votes to skip" help="Viewers who type !voteskip. A moderator can always use !skip." value={form.voteskip_threshold}
            {...SETTINGS_BOUNDS.voteskip_threshold} disabled={disabled} onChange={(voteskip_threshold) => set({ voteskip_threshold })} />
          <Number_ label="Player volume" help="The starting volume of the player on this page, 0 to 100." value={form.player_volume}
            {...SETTINGS_BOUNDS.player_volume} disabled={disabled} onChange={(player_volume) => set({ player_volume })} />
        </div>
        <Switch label="Play the fallback playlist when the queue is empty" checked={form.fallback_enabled} disabled={disabled}
          onChange={(fallback_enabled) => set({ fallback_enabled })} />
        <Switch label="Shuffle the fallback playlist" checked={form.shuffle_fallback} disabled={disabled}
          description="Picks at random without repeating the last 10 songs. Off plays the playlist in order."
          onChange={(shuffle_fallback) => set({ shuffle_fallback })} />
        <Switch label="Announce each new song in chat" checked={form.announce_now_playing} disabled={disabled}
          onChange={(announce_now_playing) => set({ announce_now_playing })} />
        <TemplateField
          label="Now playing message" value={form.now_playing_template} maxLength={SETTINGS_BOUNDS.template} context="other"
          contextVars={['song', 'requester']} field="song_requests.now_playing_template"
          issues={settings.issuesFor('song_requests.now_playing_template')} disabled={disabled} rows={2}
          onChange={(now_playing_template) => set({ now_playing_template })}
        />
      </section>
      <section className="tw-sr-card" aria-labelledby="tw-sr-public">
        <h2 id="tw-sr-public" className="tw-st-card__title">Public queue page</h2>
        <Switch label="Show the queue on a public page" checked={form.public_queue_page} disabled={disabled}
          description="Anyone can see the song titles and who requested them. Nothing else is shown."
          onChange={(public_queue_page) => set({ public_queue_page })} />
        {form.enabled && form.public_queue_page && (
          <p className="tw-muted">
            <a href={`/t/${encodeURIComponent(login)}/songs`} target="_blank" rel="noopener noreferrer">
              Open the public page <ExternalLink size={14} aria-hidden="true" /><span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          </p>
        )}
      </section>
      <SettingsSaveBar settings={settings} />
    </div>
  );
};
