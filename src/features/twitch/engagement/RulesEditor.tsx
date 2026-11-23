/**
 * Eligibility rule editor (owner request: per-giveaway rules). Grouped controls whose defaults let everyone
 * in chat enter, plus the rules in plain words. Used in the giveaway drawer, for the channel defaults and
 * for saved rule sets. Named exclusions are stored by Twitch user id: a typed name is looked up first.
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { NumberInput } from '@/components/ui';
import { Field, LevelSelect, Switch, UserLookupInput, isValidLogin, normalizeLogin, twitchErrorMessage } from '../shared/ui';
import { giveawaysApi } from './api';
import {
  COUNTED_LABEL,
  COUNTED_STATUSES,
  PRIOR_PERIODS,
  ROLE_LABEL,
  ROLE_NAMES,
  RULE_LIMITS,
  describeRules,
  type CountedStatus,
  type EligibilityRules,
  type FollowingMode,
  type PriorPeriod,
  type RoleChoice,
  type RoleName,
  type SubscriptionRule,
} from './model';

interface RulesEditorProps {
  channelId: string;
  rules: EligibilityRules;
  onChange: (rules: EligibilityRules) => void;
  disabled?: boolean;
  levelName?: (value: number) => string;
  timezone?: string | null;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

export const RulesSummary: React.FC<{ rules: EligibilityRules; levelName?: (value: number) => string; timezone?: string | null; label?: string }> = ({
  rules, levelName, timezone, label = 'Who can enter, in plain words',
}) => (
  <div className="tw-en-summary">
    <p className="tw-en-summary__label">{label}</p>
    <ul>
      {describeRules(rules, { levelName, timezone }).map((line) => <li key={line}>{line}</li>)}
    </ul>
  </div>
);

export const RulesEditor: React.FC<RulesEditorProps> = ({ channelId, rules, onChange, disabled = false, levelName, timezone }) => {
  const [login, setLogin] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const set = (patch: Partial<EligibilityRules>) => onChange({ ...rules, ...patch });
  const setRole = (name: RoleName, choice: RoleChoice) =>
    set({ roles: { ...rules.roles, [name]: choice, only: choice === 'exclude' ? rules.roles.only.filter((r) => r !== name) : rules.roles.only } });
  const toggleOnly = (name: RoleName, on: boolean) =>
    set({ roles: { ...rules.roles, only: on ? [...rules.roles.only, name] : rules.roles.only.filter((r) => r !== name) } });
  const prior = rules.prior_winners;
  const setPrior = (patch: Partial<EligibilityRules['prior_winners']>) => set({ prior_winners: { ...prior, ...patch } });
  const toggleStatus = (status: CountedStatus, on: boolean) =>
    setPrior({ statuses: on ? COUNTED_STATUSES.filter((s) => s === status || prior.statuses.includes(s)) : prior.statuses.filter((s) => s !== status) });
  const setPeriod = (period: PriorPeriod) => setPrior({
    period,
    days: period === 'rolling' ? (prior.days || 7) : 0,
    start: period === 'range' ? prior.start : null,
    end: period === 'range' ? prior.end : null,
  });
  const part = rules.participation;
  const setPart = (patch: Partial<EligibilityRules['participation']>) => set({ participation: { ...part, ...patch } });
  const full = rules.named_exclusions.length >= RULE_LIMITS.namedExclusionsMax;

  const addExclusion = async () => {
    const name = normalizeLogin(login);
    setLookupError(null);
    if (!isValidLogin(name)) { setLookupError('Type a Twitch username.'); return; }
    if (rules.named_exclusions.some((item) => item.login === name)) { setLogin(''); return; }
    setLooking(true);
    try {
      const found = await giveawaysApi.resolveUsers(channelId, [name]);
      const user = found.users[0];
      if (!user) { setLookupError(`There is no Twitch account named ${name}.`); return; }
      if (!rules.named_exclusions.some((item) => item.user_id === user.user_id)) {
        set({ named_exclusions: [...rules.named_exclusions, { user_id: user.user_id, login: user.login }] });
      }
      setLogin('');
    } catch (error) {
      setLookupError(twitchErrorMessage(error));
    } finally {
      setLooking(false);
    }
  };

  return (
    <div className="tw-en-rules">
      <RulesSummary rules={rules} levelName={levelName} timezone={timezone} />

      <fieldset className="tw-en-rules__group" disabled={disabled}>
        <legend className="tw-en-subhead">Roles</legend>
        <div className="tw-en-grid">
          {ROLE_NAMES.map((name) => (
            <Field key={name} label={ROLE_LABEL[name]}>
              {(control) => (
                <select {...control} className="form-select" value={rules.roles[name]} disabled={disabled}
                  onChange={(event) => setRole(name, event.target.value as RoleChoice)}>
                  <option value="allow">Can enter</option>
                  <option value="exclude">Cannot enter</option>
                </select>
              )}
            </Field>
          ))}
        </div>
        <p className="tw-en-rules__hint">Only let these roles in (leave all off for everyone):</p>
        <div className="tw-en-grid">
          {ROLE_NAMES.map((name) => (
            <Switch key={name} label={ROLE_LABEL[name]} checked={rules.roles.only.includes(name)}
              disabled={disabled || rules.roles[name] === 'exclude'}
              description={rules.roles[name] === 'exclude' ? 'Set to "Cannot enter" above' : undefined}
              onChange={(on) => toggleOnly(name, on)} />
          ))}
        </div>
        <LevelSelect label="Lowest chat level" value={rules.min_level} disabled={disabled}
          onChange={(min_level) => set({ min_level })}
          help="Everyone is the usual choice. Higher levels also let in anyone above them." />
      </fieldset>

      <fieldset className="tw-en-rules__group" disabled={disabled}>
        <legend className="tw-en-subhead">Subscribers and followers</legend>
        <div className="tw-en-grid">
          <Field label="Subscription">
            {(control) => (
              <select {...control} className="form-select" value={rules.subscription} disabled={disabled}
                onChange={(event) => set({ subscription: event.target.value as SubscriptionRule })}>
                <option value="everyone">Everyone</option>
                <option value="subscribers">Subscribers only</option>
                <option value="non_subscribers">Non-subscribers only</option>
              </select>
            )}
          </Field>
          <Field label="Following" help="Checked with Twitch; needs Acosmibot's follower permission.">
            {(control) => (
              <select {...control} className="form-select" value={rules.following.mode} disabled={disabled}
                onChange={(event) => {
                  const mode = event.target.value as FollowingMode;
                  set({ following: { mode, min_follow_minutes: mode === 'followers' ? rules.following.min_follow_minutes : 0 } });
                }}>
                <option value="everyone">Everyone</option>
                <option value="followers">Followers only</option>
                <option value="non_followers">Non-followers only</option>
              </select>
            )}
          </Field>
          {rules.following.mode === 'followers' && (
            <Field label="Following for at least (days)" optional help="0 for any follower. 0.5 is twelve hours.">
              {(control) => (
                <NumberInput {...control} className="form-control" min={0} max={365} step={0.5} disabled={disabled}
                  value={round2(rules.following.min_follow_minutes / 1440)}
                  onValueChange={(days) => set({ following: { mode: 'followers', min_follow_minutes: Math.round(days * 1440) } })} />
              )}
            </Field>
          )}
        </div>
      </fieldset>

      <fieldset className="tw-en-rules__group" disabled={disabled}>
        <legend className="tw-en-subhead">Past winners</legend>
        <div className="tw-en-grid">
          <Field label="Winners of earlier giveaways" help="Counts giveaways in this channel. Days and weeks use the channel time zone.">
            {(control) => (
              <select {...control} className="form-select" value={prior.period} disabled={disabled}
                onChange={(event) => setPeriod(event.target.value as PriorPeriod)}>
                {PRIOR_PERIODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            )}
          </Field>
          {prior.period === 'rolling' && (
            <Field label="Number of days" help="Counts back from the moment of the check, not from Monday.">
              {(control) => (
                <NumberInput {...control} className="form-control" min={1} max={RULE_LIMITS.rollingDaysMax} disabled={disabled}
                  value={prior.days} onValueChange={(days) => setPrior({ days })} />
              )}
            </Field>
          )}
          {prior.period === 'range' && (
            <>
              <Field label="From">
                {(control) => (
                  <input {...control} className="form-control" type="date" value={prior.start ?? ''} disabled={disabled}
                    onChange={(event) => setPrior({ start: event.target.value || null })} />
                )}
              </Field>
              <Field label="Until (included)">
                {(control) => (
                  <input {...control} className="form-control" type="date" value={prior.end ?? ''} disabled={disabled}
                    onChange={(event) => setPrior({ end: event.target.value || null })} />
                )}
              </Field>
            </>
          )}
        </div>
        {prior.period !== 'off' && (
          <>
            <p className="tw-en-rules__hint">What counts as a win:</p>
            <div className="tw-en-grid">
              {COUNTED_STATUSES.map((status) => (
                <Switch key={status} label={COUNTED_LABEL[status]} checked={prior.statuses.includes(status)} disabled={disabled}
                  onChange={(on) => toggleStatus(status, on)} />
              ))}
            </div>
          </>
        )}
      </fieldset>

      <fieldset className="tw-en-rules__group" disabled={disabled}>
        <legend className="tw-en-subhead">Account and activity</legend>
        <div className="tw-en-grid">
          <Field label="Twitch account at least (days old)" help="0 for no requirement.">
            {(control) => (
              <NumberInput {...control} className="form-control" min={0} max={RULE_LIMITS.accountAgeDaysMax} disabled={disabled}
                value={rules.min_account_age_days} onValueChange={(min_account_age_days) => set({ min_account_age_days })} />
            )}
          </Field>
          <Field label="Watched at least (hours)" help="Watch time Acosmibot counted in this channel.">
            {(control) => (
              <NumberInput {...control} className="form-control" min={0} max={100_000} step={0.5} disabled={disabled}
                value={round2(part.min_watch_minutes / 60)} onValueChange={(hours) => setPart({ min_watch_minutes: Math.round(hours * 60) })} />
            )}
          </Field>
          <Field label="Chat messages at least" help="Messages Acosmibot counted in this channel.">
            {(control) => (
              <NumberInput {...control} className="form-control" min={0} max={RULE_LIMITS.messagesMax} disabled={disabled}
                value={part.min_messages} onValueChange={(min_messages) => setPart({ min_messages })} />
            )}
          </Field>
          <Field label="Points at least" help="The viewer's current loyalty balance.">
            {(control) => (
              <NumberInput {...control} className="form-control" min={0} max={RULE_LIMITS.pointsMax} disabled={disabled}
                value={part.min_points} onValueChange={(min_points) => setPart({ min_points })} />
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className="tw-en-rules__group" disabled={disabled}>
        <legend className="tw-en-subhead">Excluded accounts</legend>
        <p className="tw-en-rules__hint">
          These accounts can never enter. They stay excluded after a name change. {rules.named_exclusions.length} of {RULE_LIMITS.namedExclusionsMax}.
        </p>
        {rules.named_exclusions.length > 0 && (
          <ul className="tw-en-chips" aria-label="Excluded accounts">
            {rules.named_exclusions.map((item) => (
              <li key={item.user_id} className="tw-en-chip">
                <span className="tw-en-name">{item.login}</span>
                <button type="button" className="tw-en-chip__remove" disabled={disabled} aria-label={`Stop excluding ${item.login}`}
                  onClick={() => set({ named_exclusions: rules.named_exclusions.filter((x) => x.user_id !== item.user_id) })}>
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="tw-en-list-editor__row">
          <UserLookupInput label="Exclude a Twitch account" value={login} onChange={setLogin} disabled={disabled || full || looking}
            onSubmit={() => { void addExclusion(); }} />
          <button type="button" className="btn" disabled={disabled || full || looking || !login.trim()} aria-busy={looking}
            onClick={() => { void addExclusion(); }}>
            {looking ? 'Looking up…' : 'Exclude'}
          </button>
        </div>
        {lookupError && <p className="tw-field__error" role="alert">{lookupError}</p>}
      </fieldset>
    </div>
  );
};
