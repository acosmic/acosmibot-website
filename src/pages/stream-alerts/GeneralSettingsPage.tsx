import React, { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { streamAlertsApi, StreamAlertAccount, StreamAlertGeneral, StreamAlertModerationMode, StreamAlertProfanityMode } from '@/api/streamAlerts';
import { PageNotice, plainError } from '@/utils/streamAlertAccounts';
import {
  addWords,
  apiField,
  FieldProblem,
  generalSettingsPart,
  MAX_ALLOWED_WORDS,
  MAX_MINIMUM,
  MAX_WORDS,
  MESSAGE_MINIMUM_KINDS,
  MINIMUM_KINDS,
  normalizeGeneral,
  validateGeneral,
} from '@/utils/streamAlertBox';
import { SettingsCard } from './LookForm';
import { FieldError } from './TextBoxProperties';

const PROFANITY_MODES: { value: StreamAlertProfanityMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'replace', label: 'Replace bad words with asterisks' },
  { value: 'hide_message', label: 'Hide the message (and star out bad words in the name)' },
  { value: 'skip_alert', label: 'Do not show the alert at all' },
];

const MODERATION_MODES: { value: StreamAlertModerationMode; label: string; about: string }[] = [
  { value: 'off', label: 'Off', about: 'Alerts show as soon as they arrive.' },
  { value: 'hold', label: 'Hold, then show', about: 'Each alert waits a few seconds, so you can block it under Activity first.' },
  { value: 'manual', label: 'Show only once approved', about: 'Each alert waits until you approve it under Activity. Unapproved alerts are dropped after 10 minutes.' },
];

/** A list of words as removable chips, with an input to add more (comma or Enter adds). */
const WordChips: React.FC<{
  id: string;
  label: string;
  words: string[];
  max: number;
  problem: string | null;
  onChange: (next: string[]) => void;
}> = ({ id, label, words, max, problem, onChange }) => {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    const result = addWords(words, typed, max);
    onChange(result.list);
    setError(result.error);
    if (!result.error) setTyped('');
  };
  return (
    <div className="stream-box__chips-field">
      <label className="stream-props__field" htmlFor={`${id}-input`}>
        <span>{label} ({words.length} of {max})</span>
      </label>
      <div className="stream-box__chip-add">
        <input
          id={`${id}-input`}
          className="form-control"
          value={typed}
          placeholder="Type a word, then Enter"
          aria-invalid={Boolean(problem || error)}
          aria-describedby={problem || error ? `${id}-error` : undefined}
          onChange={(event) => { setTyped(event.target.value); setError(null); }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(); }
          }}
        />
        <button type="button" disabled={!typed.trim()} onClick={add}>Add</button>
      </div>
      {words.length > 0 && (
        <ul className="stream-box__chips" aria-label={label}>
          {words.map((word) => (
            <li key={word}>
              <span>{word}</span>
              <button type="button" aria-label={`Remove ${word}`} onClick={() => onChange(words.filter((item) => item !== word))}>×</button>
            </li>
          ))}
        </ul>
      )}
      <FieldError id={`${id}-error`} text={problem ?? error} />
    </div>
  );
};

const wholeInput = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN);

/** Rules for every alert: the profanity filter, minimums, the gap between alerts, and moderation. */
export const GeneralSettingsPage: React.FC<{
  account: StreamAlertAccount;
  general: StreamAlertGeneral;
  dirty: boolean;
  loading: boolean;
  loadError: unknown;
  onRetry: () => void;
  onChange: (next: StreamAlertGeneral) => void;
  onDiscard: () => void;
  onSaved: (general: StreamAlertGeneral) => void;
}> = ({ account, general, dirty, loading, loadError, onRetry, onChange, onDiscard, onSaved }) => {
  const [triedSave, setTriedSave] = useState(false);
  const [serverProblem, setServerProblem] = useState<FieldProblem | null>(null);
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const localProblems = useMemo(() => validateGeneral(general), [general]);
  const problemAt = (field: string) => {
    if (serverProblem?.field === field) return serverProblem.error;
    if (!triedSave) return null;
    return localProblems.find((item) => item.field === field)?.error ?? null;
  };
  const change = (next: StreamAlertGeneral) => { onChange(next); setServerProblem(null); setNotice(null); };

  const save = useMutation({
    mutationFn: (input: StreamAlertGeneral) => streamAlertsApi.saveAlertSettings(account.id, generalSettingsPart(input)),
    onMutate: () => { setServerProblem(null); setNotice(null); },
    onSuccess: (result, input) => {
      setTriedSave(false);
      onSaved(normalizeGeneral(result.general ?? input));
      setNotice({ tone: 'ok', text: 'Saved. OBS now uses these settings.' });
    },
    onError: (error) => setServerProblem({ field: apiField(error instanceof ApiError ? error.body.field : null), error: plainError(error) }),
  });
  const submit = () => {
    if (save.isPending) return;
    setTriedSave(true);
    if (localProblems.length) { setNotice({ tone: 'error', text: 'Nothing was saved. Fix the parts marked in red first.' }); return; }
    save.mutate(general);
  };

  if (loading) return <p className="stream-accounts__empty" role="status">Loading the settings…</p>;
  if (loadError) {
    return (
      <div className="stream-accounts__load-error" role="alert">
        <p className="stream-accounts__notice is-error">Could not load the settings: {plainError(loadError)}</p>
        <button type="button" onClick={onRetry}>Try again</button>
      </div>
    );
  }

  const number = (group: 'minimums' | 'message_minimums', kind: string, label: string, unit: string) => {
    const field = `${group}.${kind}`;
    const value = (general[group] as Record<string, number>)[kind];
    return (
      <label key={field} className="stream-props__field">
        <span>{label} ({unit})</span>
        <input
          className="form-control"
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_MINIMUM}
          step={1}
          value={Number.isFinite(value) ? value : ''}
          aria-invalid={Boolean(problemAt(field))}
          aria-describedby={problemAt(field) ? `stream-general-${group}-${kind}` : undefined}
          onChange={(event) => change({ ...general, [group]: { ...general[group], [kind]: wholeInput(event.target.value) } })}
        />
        <FieldError id={`stream-general-${group}-${kind}`} text={problemAt(field)} />
      </label>
    );
  };

  return (
    <div className="stream-box__page">
      <header className="stream-box__page-head">
        <h2>General settings</h2>
        <p>These rules apply to every alert. Safe Mode and pause are in the live controls at the top.</p>
      </header>
      <div className="stream-box__settings is-single">
        <SettingsCard title="Profanity filter" id="stream-general-profanity-title" about="Words are matched whole, in any case, also when spelled with numbers or symbols (such as 5h1t).">
          <label className="stream-props__field">
            <span>When a bad word shows up</span>
            <select
              className="form-control"
              value={general.profanity.mode}
              aria-invalid={Boolean(problemAt('profanity.mode'))}
              onChange={(event) => change({ ...general, profanity: { ...general.profanity, mode: event.target.value as StreamAlertProfanityMode } })}
            >
              {PROFANITY_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
            </select>
            <FieldError id="stream-general-profanity-mode" text={problemAt('profanity.mode')} />
          </label>
          <label className="stream-props__check">
            <input type="checkbox" checked={general.profanity.builtin} onChange={(event) => change({ ...general, profanity: { ...general.profanity, builtin: event.target.checked } })} />
            <span>Use the built-in English word list</span>
          </label>
          <WordChips
            id="stream-general-words"
            label="Your own bad words"
            words={general.profanity.words}
            max={MAX_WORDS}
            problem={problemAt('profanity.words')}
            onChange={(words) => change({ ...general, profanity: { ...general.profanity, words } })}
          />
          <WordChips
            id="stream-general-allow"
            label="Allowed words (never filtered)"
            words={general.profanity.allow}
            max={MAX_ALLOWED_WORDS}
            problem={problemAt('profanity.allow')}
            onChange={(allow) => change({ ...general, profanity: { ...general.profanity, allow } })}
          />
        </SettingsCard>

        <SettingsCard title="Minimums" id="stream-general-minimums-title" about="Alerts below these are not shown.">
          <div className="stream-box__grid">
            {MINIMUM_KINDS.filter((item) => item.kind !== 'donation' || account.legacy_overlay).map((item) => number('minimums', item.kind, item.label, item.unit))}
          </div>
        </SettingsCard>

        <SettingsCard title="Message minimums" id="stream-general-message-title" about="Below these, the alert shows without the viewer's message.">
          <div className="stream-box__grid">
            {MESSAGE_MINIMUM_KINDS.filter((item) => item.kind !== 'donation' || account.legacy_overlay).map((item) => number('message_minimums', item.kind, item.label, item.unit))}
          </div>
        </SettingsCard>

        <SettingsCard title="Timing" id="stream-general-timing-title">
          <div className="stream-box__grid">
            <label className="stream-props__field">
              <span>Gap between alerts (seconds)</span>
              <input
                className="form-control"
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={Number.isFinite(general.delay_ms) ? general.delay_ms / 1000 : ''}
                aria-invalid={Boolean(problemAt('delay_ms'))}
                aria-describedby={problemAt('delay_ms') ? 'stream-general-delay' : undefined}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  change({ ...general, delay_ms: event.target.value.trim() === '' || !Number.isFinite(value) ? Number.NaN : Math.round(value * 1000) });
                }}
              />
              <FieldError id="stream-general-delay" text={problemAt('delay_ms')} />
            </label>
            <label className="stream-props__check">
              <input type="checkbox" checked={general.interrupt} onChange={(event) => change({ ...general, interrupt: event.target.checked })} />
              <span>A new alert ends the one on screen instead of waiting</span>
            </label>
          </div>
        </SettingsCard>

        <SettingsCard title="Alert moderation" id="stream-general-moderation-title" about="Check alerts before they show. Your own Twitch events in the installed overlay are never held.">
          <div className="stream-box__choices is-stacked" role="radiogroup" aria-labelledby="stream-general-moderation-title">
            {MODERATION_MODES.map((mode) => (
              <label key={mode.value} className={`stream-box__choice ${general.moderation.mode === mode.value ? 'is-current' : ''}`}>
                <input
                  type="radio"
                  name="stream-general-moderation"
                  value={mode.value}
                  checked={general.moderation.mode === mode.value}
                  onChange={() => change({ ...general, moderation: { ...general.moderation, mode: mode.value } })}
                />
                <span><strong>{mode.label}</strong><small>{mode.about}</small></span>
              </label>
            ))}
          </div>
          {general.moderation.mode === 'hold' && (
            <label className="stream-props__field">
              <span>Hold each alert for (seconds)</span>
              <input
                className="form-control"
                type="number"
                min={5}
                max={60}
                step={1}
                value={Number.isFinite(general.moderation.seconds) ? general.moderation.seconds : ''}
                aria-invalid={Boolean(problemAt('moderation.seconds'))}
                aria-describedby={problemAt('moderation.seconds') ? 'stream-general-seconds' : undefined}
                onChange={(event) => change({ ...general, moderation: { ...general.moderation, seconds: wholeInput(event.target.value) } })}
              />
              <FieldError id="stream-general-seconds" text={problemAt('moderation.seconds')} />
            </label>
          )}
        </SettingsCard>
      </div>

      <footer className="stream-box__savebar">
        <div className="stream-box__savebar-text" aria-live="polite">
          {serverProblem && <p className="stream-accounts__notice is-error" role="alert">Not saved: {serverProblem.error}</p>}
          {notice && <p className={`stream-accounts__notice is-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
          {!notice && !serverProblem && dirty && <p className="stream-box__unsaved">You have unsaved changes.</p>}
        </div>
        {dirty && <button type="button" disabled={save.isPending} onClick={() => { setTriedSave(false); setServerProblem(null); setNotice(null); onDiscard(); }}>Discard changes</button>}
        <button type="button" className="is-primary" disabled={!dirty || save.isPending} onClick={submit}>{save.isPending ? 'Saving…' : 'Save settings'}</button>
      </footer>
    </div>
  );
};
