/**
 * Filters (§11.4, §12.3): the moderation settings (each filter as a card, the
 * link allowlist, the strike ladder, the warning message), the blocked terms
 * table with its tester, and raid / follow-bot protection with a manual Shield
 * Mode switch. Moderators and the broadcaster are never filtered; that is a
 * rule of the bot, not a setting.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlaskConical, Plus, Shield, ShieldOff, Trash2, TriangleAlert, X } from 'lucide-react';
import { ConfirmDialog, FeatureToggle, NumberInput } from '@/components/ui';
import { showToast } from '@/utils/toast';
import type { Level, SectionProps } from '../types';
import {
  DurationInput,
  EditorDrawer,
  EmptyState,
  Field,
  LevelSelect,
  ReadOnlyNotice,
  RecordTable,
  SectionPage,
  SettingsSaveBar,
  StatusChip,
  Switch,
  TemplateField,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useChannelMutation,
  useFeedEvents,
  useLevelLabel,
  useSectionSettings,
  type Column,
} from '../shared/ui';
import { moderationApi } from './api';
import {
  EMPTY_TERM_DRAFT,
  FILTERS,
  LIMITS,
  MATCH_TYPES,
  STRIKE_ACTIONS,
  TERM_ACTIONS,
  describeProtection,
  domainProblem,
  draftFromTerm,
  ladderProblem,
  moderationProblem,
  normalizeDomain,
  sameTermDraft,
  shortDuration,
  termInputFromDraft,
  termProblem,
  type BlockedTerm,
  type FilterMeta,
  type FollowBotProtection,
  type MatchType,
  type ModerationSettings,
  type RaidProtection,
  type StrikeAction,
  type StrikeStep,
  type TermAction,
  type TermDraft,
  type TermTestResult,
} from './model';
import './moderation.css';

/* ── Filter card ────────────────────────────────────────────────────────── */

type AnyFilter = Record<string, unknown> & { enabled: boolean; exempt_level: Level; reason: string };

interface FilterCardProps {
  meta: FilterMeta;
  value: AnyFilter;
  disabled: boolean;
  onChange: (next: AnyFilter) => void;
  children?: React.ReactNode;
}

const FilterCard: React.FC<FilterCardProps> = ({ meta, value, disabled, onChange, children }) => {
  const patch = (next: Partial<AnyFilter>) => onChange({ ...value, ...next });
  return (
    <section className="tw-mod-card" aria-labelledby={`tw-filter-${meta.key}`}>
      <div className="tw-mod-card__header">
        <div>
          <h2 id={`tw-filter-${meta.key}`} className="tw-mod-card__title">{meta.label}</h2>
          <p className="tw-muted">{meta.description}</p>
        </div>
        <Switch label={`${meta.label} filter`} checked={value.enabled} disabled={disabled}
          onChange={(enabled) => patch({ enabled })} />
      </div>
      <div className="tw-mod-grid">
        <LevelSelect label="Exempt from" value={value.exempt_level} disabled={disabled} min={100}
          help="This level and above are never checked by this filter. Moderators always are."
          onChange={(exempt_level) => patch({ exempt_level })} />
        <Field label="Reason in the warning" help="Filled in as $(reason) in the warning message.">
          {(control) => (
            <input {...control} className="form-control" maxLength={LIMITS.reasonChars} value={value.reason}
              disabled={disabled} onChange={(event) => patch({ reason: event.target.value })} />
          )}
        </Field>
        {meta.fields.map((field) => field.kind === 'seconds' ? (
          <DurationInput key={field.key} label={field.label} help={field.help} min={field.min} max={field.max}
            units={['s', 'm']} seconds={Number(value[field.key] ?? 0)} disabled={disabled}
            onChange={(seconds) => patch({ [field.key]: seconds })} />
        ) : (
          <Field key={field.key} label={field.label} help={field.help}>
            {(control) => (
              <NumberInput {...control} className="form-control" min={field.min} max={field.max}
                value={Number(value[field.key] ?? 0)} disabled={disabled}
                onValueChange={(next) => patch({ [field.key]: Math.round(next) })} />
            )}
          </Field>
        ))}
      </div>
      {children}
    </section>
  );
};

/* ── Link allowlist ─────────────────────────────────────────────────────── */

const AllowlistEditor: React.FC<{ domains: string[]; disabled: boolean; onChange: (domains: string[]) => void }> = ({ domains, disabled, onChange }) => {
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const add = () => {
    const domain = normalizeDomain(text);
    const error = domainProblem(domain) ?? (domains.includes(domain) ? `${domain} is already allowed.` : null)
      ?? (domains.length >= LIMITS.allowlist ? `At most ${LIMITS.allowlist} domains.` : null);
    setProblem(error);
    if (error) return;
    onChange([...domains, domain]);
    setText('');
  };
  return (
    <>
      <hr className="tw-mod-divider" />
      <h3 className="tw-mod-subtitle">Allowed domains</h3>
      <p className="tw-muted">Subdomains are allowed too: twitch.tv also allows clips.twitch.tv and www.twitch.tv.</p>
      {domains.length > 0 ? (
        <ul className="tw-mod-chips">
          {domains.map((domain) => (
            <li key={domain} className="tw-mod-chip">
              {domain}
              <button type="button" className="tw-icon-button" aria-label={`Remove ${domain}`} disabled={disabled}
                onClick={() => onChange(domains.filter((item) => item !== domain))}>
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="tw-muted">No domains are allowed; every link is removed.</p>}
      <div className="tw-mod-row">
        <Field label="Add a domain" error={problem}>
          {(control) => (
            <input {...control} className="form-control" placeholder="example.com" value={text} disabled={disabled}
              maxLength={253} onChange={(event) => { setText(event.target.value); setProblem(null); }}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} />
          )}
        </Field>
        <div className="tw-field">
          <button type="button" className="btn" disabled={disabled || !text.trim()} onClick={add}>
            <Plus size={16} aria-hidden="true" /> Allow
          </button>
        </div>
      </div>
    </>
  );
};

/* ── Strike ladder ──────────────────────────────────────────────────────── */

const LadderEditor: React.FC<{ ladder: StrikeStep[]; disabled: boolean; onChange: (ladder: StrikeStep[]) => void }> = ({ ladder, disabled, onChange }) => {
  const problem = ladderProblem(ladder);
  const update = (index: number, next: Partial<StrikeStep>) =>
    onChange(ladder.map((step, i) => (i === index ? { ...step, ...next } : step)));
  return (
    <>
      <ol className="tw-mod-ladder">
        {ladder.map((step, index) => (
          <li key={index} className="tw-mod-ladder__step">
            <span className="tw-mod-ladder__label">Strike {index + 1}{index === ladder.length - 1 ? '+' : ''}</span>
            <Field label="Action">
              {(control) => (
                <select {...control} className="form-select" value={step.action} disabled={disabled}
                  onChange={(event) => {
                    const action = event.target.value as StrikeAction;
                    update(index, { action, duration_s: action === 'timeout' ? step.duration_s || 60 : 0 });
                  }}>
                  {STRIKE_ACTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              )}
            </Field>
            {step.action === 'timeout' ? (
              <DurationInput label="Timeout length" seconds={step.duration_s} min={1} max={LIMITS.maxTimeoutS}
                disabled={disabled} onChange={(duration_s) => update(index, { duration_s })} />
            ) : <span aria-hidden="true" />}
            <div className="tw-field">
              <button type="button" className="tw-icon-button" aria-label={`Remove strike ${index + 1}`}
                disabled={disabled || ladder.length <= 1}
                onClick={() => onChange(ladder.filter((_, i) => i !== index))}>
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ol>
      {problem && <p className="tw-field__error" role="alert">{problem}</p>}
      <button type="button" className="btn" disabled={disabled || ladder.length >= LIMITS.ladderSteps}
        onClick={() => onChange([...ladder, { action: 'timeout', duration_s: 600 }])}>
        <Plus size={16} aria-hidden="true" /> Add a step
      </button>
    </>
  );
};

/* ── Blocked terms ──────────────────────────────────────────────────────── */

type Editing = { kind: 'new' } | { kind: 'edit'; term: BlockedTerm } | null;

const BlockedTerms: React.FC<{ channelId: string; enabled: boolean; canEdit: boolean; onToggle: (on: boolean) => void }> = ({ channelId, enabled, canEdit, onToggle }) => {
  const levelLabel = useLevelLabel();
  const list = useQuery({
    queryKey: tk(channelId, 'moderation', 'blocked-terms'),
    queryFn: () => moderationApi.terms(channelId),
    retry: twitchRetry,
  });
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState<TermDraft>(EMPTY_TERM_DRAFT);
  const [base, setBase] = useState<TermDraft>(EMPTY_TERM_DRAFT);
  const [clientError, setClientError] = useState<string | null>(null);
  const [sample, setSample] = useState('');
  const [testResult, setTestResult] = useState<TermTestResult | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BlockedTerm | null>(null);
  const key = tk(channelId, 'moderation', 'blocked-terms');

  const open = (term: BlockedTerm | null) => {
    const next = term ? draftFromTerm(term) : EMPTY_TERM_DRAFT;
    setDraft(next);
    setBase(next);
    setClientError(null);
    setSample('');
    setTestResult(null);
    save.reset();
    setEditing(term ? { kind: 'edit', term } : { kind: 'new' });
  };

  const save = useChannelMutation({
    mutationFn: (input: ReturnType<typeof termInputFromDraft>) => editing?.kind === 'edit'
      ? moderationApi.updateTerm(channelId, editing.term.id, input)
      : moderationApi.createTerm(channelId, input),
    invalidate: [key],
    successMessage: 'Blocked term saved',
    errorMessage: false,
    onSuccess: () => setEditing(null),
  });
  const remove = useChannelMutation({
    mutationFn: (id: number) => moderationApi.removeTerm(channelId, id),
    invalidate: [key],
    successMessage: 'Blocked term deleted',
    onSuccess: () => { setConfirmDelete(null); setEditing(null); },
  });
  const tester = useChannelMutation({
    mutationFn: () => moderationApi.testTerm(channelId, draft.pattern.trim(), draft.match_type, sample),
    errorMessage: 'Could not test the pattern.',
    onSuccess: (result) => setTestResult(result),
  });

  const submit = () => {
    const problem = termProblem(draft);
    setClientError(problem);
    if (!problem) save.mutate(termInputFromDraft(draft));
  };

  const terms = list.data?.items ?? [];
  const regexCount = terms.filter((term) => term.match_type === 'regex').length;
  const matchLabel = (type: MatchType) => MATCH_TYPES.find((item) => item.value === type)?.label ?? type;
  const actionText = (term: BlockedTerm) => {
    const label = TERM_ACTIONS.find((item) => item.value === term.action)?.label ?? term.action;
    return term.action === 'timeout' && term.timeout_s ? `${label} ${shortDuration(term.timeout_s)}` : label;
  };

  const columns: Column<BlockedTerm>[] = [
    { key: 'pattern', header: 'Pattern', primary: true, render: (term) => <span className="tw-mod-pattern">{term.pattern}</span> },
    { key: 'type', header: 'Type', render: (term) => matchLabel(term.match_type), width: '150px' },
    { key: 'action', header: 'Action', render: actionText, width: '190px' },
    { key: 'exempt', header: 'Exempt from', render: (term) => levelLabel(term.exempt_level), hideOnMobile: true, width: '140px' },
    {
      key: 'state', header: 'State', width: '110px',
      render: (term) => <StatusChip tone={term.enabled ? 'active' : 'neutral'}>{term.enabled ? 'On' : 'Off'}</StatusChip>,
    },
  ];

  const atLimit = list.data ? terms.length >= list.data.limit : false;
  const matchHelp = MATCH_TYPES.find((item) => item.value === draft.match_type)?.help;
  const serverError = save.error ? twitchErrorMessage(save.error) : null;

  return (
    <section className="tw-mod-card" aria-labelledby="tw-blocked-terms">
      <div className="tw-mod-card__header">
        <div>
          <h2 id="tw-blocked-terms" className="tw-mod-card__title">Blocked terms</h2>
          <p className="tw-muted">Checked before every other filter. Each term has its own action instead of the strike ladder. The warning never repeats the term.</p>
        </div>
        <Switch label="Blocked terms" checked={enabled} disabled={!canEdit} onChange={onToggle} />
      </div>
      {list.isError ? (
        <div className="tw-inline-failed">
          <span>Blocked terms didn't load. {twitchErrorMessage(list.error)}</span>
          <button type="button" className="btn" onClick={() => list.refetch()}>Retry</button>
        </div>
      ) : (
        <RecordTable
          rows={terms}
          columns={columns}
          rowKey={(term) => term.id}
          caption="Blocked terms"
          onRowClick={canEdit ? (term) => open(term) : undefined}
          rowLabel={(term) => `Edit blocked term ${term.pattern}`}
          toolbar={(
            <div className="tw-mod-toolbar">
              <span className="tw-muted">
                {list.isPending ? 'Loading…' : `${terms.length} of ${list.data?.limit ?? 500} terms, ${regexCount} of ${list.data?.regex_limit ?? 50} regular expressions`}
              </span>
              <button type="button" className="btn primary" disabled={!canEdit || atLimit || list.isPending} onClick={() => open(null)}>
                <Plus size={16} aria-hidden="true" /> Add term
              </button>
            </div>
          )}
          empty={<EmptyState title="No blocked terms" description="Add words, phrases or patterns the bot should remove from chat." />}
        />
      )}

      <EditorDrawer
        open={editing !== null}
        title={editing?.kind === 'edit' ? 'Edit blocked term' : 'New blocked term'}
        onClose={() => setEditing(null)}
        onSubmit={submit}
        submitting={save.isPending}
        error={clientError ?? serverError}
        dirty={!sameTermDraft(draft, base)}
        secondaryAction={editing?.kind === 'edit' ? (
          <button type="button" className="btn" onClick={() => setConfirmDelete(editing.term)}>
            <Trash2 size={16} aria-hidden="true" /> Delete
          </button>
        ) : undefined}
      >
        <Field label="Match as" help={matchHelp}>
          {(control) => (
            <select {...control} className="form-select" value={draft.match_type}
              onChange={(event) => { setDraft({ ...draft, match_type: event.target.value as MatchType }); setTestResult(null); }}>
              {MATCH_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          )}
        </Field>
        <Field label="Pattern" help={`At most ${LIMITS.termChars} characters. Matching ignores case.`}>
          {(control) => (
            <input {...control} className="form-control tw-mod-pattern" maxLength={LIMITS.termChars} value={draft.pattern}
              autoComplete="off" spellCheck={false}
              onChange={(event) => { setDraft({ ...draft, pattern: event.target.value }); setTestResult(null); }} />
          )}
        </Field>
        <Field label="Action">
          {(control) => (
            <select {...control} className="form-select" value={draft.action}
              onChange={(event) => setDraft({ ...draft, action: event.target.value as TermAction })}>
              {TERM_ACTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          )}
        </Field>
        {draft.action === 'timeout' && (
          <DurationInput label="Timeout length" seconds={draft.timeout_s} min={1} max={LIMITS.maxTimeoutS}
            onChange={(timeout_s) => setDraft({ ...draft, timeout_s })} />
        )}
        <LevelSelect label="Exempt from" value={draft.exempt_level} min={100}
          help="This level and above may use the term. Moderators always may."
          onChange={(exempt_level) => setDraft({ ...draft, exempt_level })} />
        <Switch label="Term is on" checked={draft.enabled} onChange={(on) => setDraft({ ...draft, enabled: on })} />

        <div className="tw-mod-tester">
          <Field label="Try it on a message" help="Nothing is sent to chat.">
            {(control) => (
              <textarea {...control} className="form-control" rows={2} maxLength={LIMITS.sampleChars} value={sample}
                onChange={(event) => { setSample(event.target.value); setTestResult(null); }} />
            )}
          </Field>
          <button type="button" className="btn" disabled={!draft.pattern.trim() || tester.isPending}
            aria-busy={tester.isPending} onClick={() => tester.mutate()}>
            <FlaskConical size={16} aria-hidden="true" /> Test
          </button>
          {testResult && (
            <p className="tw-mod-result" role="status">
              {!testResult.valid
                ? <StatusChip tone="error">Not usable</StatusChip>
                : testResult.matches
                  ? <StatusChip tone="warning">Would be removed</StatusChip>
                  : <StatusChip tone="active">Allowed</StatusChip>}
              {' '}{testResult.error ?? ''}
            </p>
          )}
        </div>
      </EditorDrawer>

      {confirmDelete && (
        <ConfirmDialog
          kicker="Blocked term"
          title="Delete this blocked term?"
          confirmLabel="Delete"
          tone="danger"
          pending={remove.isPending}
          onConfirm={() => remove.mutate(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        >
          <p>Messages with <span className="tw-mod-pattern">{confirmDelete.pattern}</span> will no longer be removed.</p>
        </ConfirmDialog>
      )}
    </section>
  );
};

/* ── Protection ─────────────────────────────────────────────────────────── */

interface ProtectionCardProps<T extends RaidProtection | FollowBotProtection> {
  id: string;
  title: string;
  description: string;
  value: T;
  disabled: boolean;
  onChange: (next: T) => void;
  children: React.ReactNode;
}

function ProtectionCard<T extends RaidProtection | FollowBotProtection>({ id, title, description, value, disabled, onChange, children }: ProtectionCardProps<T>) {
  const patch = (next: Partial<T>) => onChange({ ...value, ...next });
  return (
    <section className="tw-mod-card" aria-labelledby={id}>
      <div className="tw-mod-card__header">
        <div>
          <h2 id={id} className="tw-mod-card__title">{title}</h2>
          <p className="tw-muted">{description}</p>
        </div>
        <Switch label={title} checked={value.enabled} disabled={disabled} onChange={(enabled) => patch({ enabled } as Partial<T>)} />
      </div>
      <div className="tw-mod-grid">
        {children}
        <Field label="Followers-only: minimum follow age (minutes)" help="0 lets any follower chat.">
          {(control) => (
            <NumberInput {...control} className="form-control" min={0} max={129_600} value={value.followers_only_minutes}
              disabled={disabled} onValueChange={(next) => patch({ followers_only_minutes: Math.round(next) } as Partial<T>)} />
          )}
        </Field>
        <DurationInput label="Keep it on for" seconds={value.duration_s}
          min={'follows_per_minute' in value ? 60 : 30} max={'follows_per_minute' in value ? 7200 : 3600}
          units={['s', 'm']} disabled={disabled} onChange={(duration_s) => patch({ duration_s } as Partial<T>)} />
      </div>
      <Switch label="Also turn on Shield Mode" checked={value.shield_mode} disabled={disabled}
        description="Ended afterwards only if Acosmibot turned it on."
        onChange={(shield_mode) => patch({ shield_mode } as Partial<T>)} />
    </section>
  );
}

const ShieldControls: React.FC<{ channelId: string }> = ({ channelId }) => {
  const toggle = useChannelMutation({
    mutationFn: (active: boolean) => moderationApi.protection(channelId, 'shield', active),
    errorMessage: 'Shield Mode did not change.',
    onSuccess: (result) => showToast(describeProtection(result), result.errors.length ? 'error' : 'success'),
  });
  return (
    <section className="tw-mod-card" aria-labelledby="tw-shield">
      <h2 id="tw-shield" className="tw-mod-card__title">Shield Mode</h2>
      <p className="tw-muted">Turn on Twitch's Shield Mode now, using the Shield Mode options set on Twitch. It stays on until you turn it off.</p>
      <div className="tw-mod-row">
        <button type="button" className="btn primary" disabled={toggle.isPending} onClick={() => toggle.mutate(true)}>
          <Shield size={16} aria-hidden="true" /> Turn on Shield Mode
        </button>
        <button type="button" className="btn" disabled={toggle.isPending} onClick={() => toggle.mutate(false)}>
          <ShieldOff size={16} aria-hidden="true" /> Turn off Shield Mode
        </button>
      </div>
    </section>
  );
};

/* ── Page ───────────────────────────────────────────────────────────────── */

export const FiltersPage: React.FC<SectionProps> = ({ channelId, channel, role }) => {
  const settings = useSectionSettings<ModerationSettings>(channelId, 'moderation');
  const form = settings.form;
  const disabled = !settings.canWrite;
  const [notPermitted, setNotPermitted] = useState(false);
  useFeedEvents<{ state?: string }>(['bot.status'], (event) => {
    if (event.data.state === 'not_moderator') setNotPermitted(true);
  });
  const botIsModerator = channel.bot?.is_moderator ?? false;
  const problem = form ? moderationProblem(form) : null;

  const setFilter = (key: FilterMeta['key'], next: Record<string, unknown>) =>
    settings.updateForm((current) => ({ ...current, [key]: next }));

  return (
    <SectionPage
      title="Filters"
      description="Chat filters run on every message before commands. Moderators, the broadcaster and the bot itself are never filtered."
      query={settings.query}
    >
      {!settings.canWrite && <ReadOnlyNotice required={settings.writeRole} role={role} what="the filters" />}
      {(notPermitted || !botIsModerator) && (
        <div className="tw-banner tw-banner--error" role="status">
          <TriangleAlert aria-hidden="true" />
          <p>
            {notPermitted
              ? 'Twitch refused a moderation action. Until Acosmibot is a moderator with the right permissions, filtered messages stay in chat.'
              : 'Acosmibot is not a moderator here. It acts with your permissions where Twitch allows; make it a moderator from the overview for reliable moderation.'}
          </p>
          <span />
        </div>
      )}
      {form && (
        <div className="tw-mod-stack">
          <FeatureToggle
            label="Chat filters"
            description="Turn every filter and blocked term on or off at once. !filters on and !filters off do the same in chat."
            enabled={form.enabled}
            onChange={(enabled) => settings.canWrite && settings.setForm({ enabled })}
          />

          <section className="tw-mod-card" aria-labelledby="tw-mod-actions">
            <h2 id="tw-mod-actions" className="tw-mod-card__title">What happens to a filtered message</h2>
            <p className="tw-muted">Each filter violation adds a strike. The number of strikes in the window picks the step; the last step repeats.</p>
            <LadderEditor ladder={form.ladder} disabled={disabled} onChange={(ladder) => settings.setForm({ ladder })} />
            <hr className="tw-mod-divider" />
            <div className="tw-mod-grid">
              <DurationInput label="Strikes are forgotten after" seconds={form.strike_window_s} min={60} max={86_400}
                units={['m', 'h']} disabled={disabled} onChange={(strike_window_s) => settings.setForm({ strike_window_s })} />
              <DurationInput label="At most one warning message per" seconds={form.warning_cooldown_s} min={0} max={3600}
                units={['s', 'm']} disabled={disabled} help="0 sends a warning for every action."
                onChange={(warning_cooldown_s) => settings.setForm({ warning_cooldown_s })} />
            </div>
            <TemplateField
              label="Warning message" value={form.warning_template} maxLength={LIMITS.warningChars} context="other"
              contextVars={['user', 'reason']} field="moderation.warning_template" rows={2}
              issues={settings.issuesFor('moderation.warning_template')} disabled={disabled}
              help="Posted in chat after an action, except Twitch warnings, which Twitch shows itself. Leave empty to post nothing."
              onChange={(warning_template) => settings.setForm({ warning_template })}
            />
          </section>

          <BlockedTerms channelId={channelId} enabled={form.blocked_terms_enabled} canEdit={settings.canWrite}
            onToggle={(blocked_terms_enabled) => settings.setForm({ blocked_terms_enabled })} />

          {FILTERS.map((meta) => (
            <FilterCard key={meta.key} meta={meta} value={form[meta.key] as unknown as AnyFilter} disabled={disabled}
              onChange={(next) => setFilter(meta.key, next)}>
              {meta.key === 'links' && (
                <>
                  <Switch label="Treat bare domains as links" checked={form.links.block_bare_domains} disabled={disabled}
                    description="example.com without https:// counts as a link."
                    onChange={(block_bare_domains) => settings.updateForm((c) => ({ ...c, links: { ...c.links, block_bare_domains } }))} />
                  <AllowlistEditor domains={form.links.allowlist} disabled={disabled}
                    onChange={(allowlist) => settings.updateForm((c) => ({ ...c, links: { ...c.links, allowlist } }))} />
                </>
              )}
            </FilterCard>
          ))}

          <ProtectionCard
            id="tw-raid-protection" title="Raid protection" value={form.raid_protection} disabled={disabled}
            description="When a large raid arrives, turn on followers-only mode (and optionally Shield Mode), then restore the previous chat settings."
            onChange={(raid_protection) => settings.setForm({ raid_protection })}
          >
            <Field label="Raids of at least (viewers)">
              {(control) => (
                <NumberInput {...control} className="form-control" min={1} max={1_000_000} value={form.raid_protection.min_viewers}
                  disabled={disabled}
                  onValueChange={(next) => settings.updateForm((c) => ({ ...c, raid_protection: { ...c.raid_protection, min_viewers: Math.round(next) } }))} />
              )}
            </Field>
          </ProtectionCard>

          <ProtectionCard
            id="tw-follow-protection" title="Follow-bot protection" value={form.follow_bot_protection} disabled={disabled}
            description="When follows arrive faster than usual, turn on followers-only mode (and optionally Shield Mode) for a while."
            onChange={(follow_bot_protection) => settings.setForm({ follow_bot_protection })}
          >
            <Field label="More follows than this in one minute">
              {(control) => (
                <NumberInput {...control} className="form-control" min={5} max={10_000} value={form.follow_bot_protection.follows_per_minute}
                  disabled={disabled}
                  onValueChange={(next) => settings.updateForm((c) => ({ ...c, follow_bot_protection: { ...c.follow_bot_protection, follows_per_minute: Math.round(next) } }))} />
              )}
            </Field>
          </ProtectionCard>

          <ShieldControls channelId={channelId} />
        </div>
      )}
      <SettingsSaveBar settings={settings} validationMessage={problem ?? undefined} />
    </SectionPage>
  );
};
