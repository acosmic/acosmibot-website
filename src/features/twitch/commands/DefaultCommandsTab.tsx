/**
 * Default commands tab: every built-in command with its effective level,
 * cooldowns and aliases. Editors change them in a drawer (enable, level,
 * cooldowns, cost, aliases, and the response where the built-in has one);
 * moderators can read them.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { LoadFailed, LoadingSpinner, NumberInput } from '@/components/ui';
import type { Role, SectionProps } from '../types';
import {
  DurationInput, EditorDrawer, EmptyState, Field, LevelSelect, ReadOnlyNotice, RecordTable, StatusChip, Switch,
  TemplateField, hasRole, isTwitchApiError, twitchErrorMessage, twitchRetry, useChannelMutation, useLevelLabel,
} from '../shared/ui';
import { defaultCommandsApi } from './api';
import { CommandPreview } from './CommandPreview';
import { defaultCommandsKey, useCurrencyName, useTemplateIssues } from './hooks';
import {
  COMMAND_LIMITS, MODULE_LABELS, cooldownSummary, defaultDraftProblems, describeCommand, fromDefaultDraft,
  issueMessages, parseBuiltinAliases, templateIssuesFrom, toDefaultDraft, withPrefix,
  type DefaultCommandState, type DefaultDraft,
} from './model';

const DefaultEditor: React.FC<{
  channelId: string; state: DefaultCommandState | null; prefix: string; canEdit: boolean; role: Role; onClose: () => void;
}> = ({ channelId, state, prefix, canEdit, role, onClose }) => {
  const levelLabel = useLevelLabel();
  const currency = useCurrencyName(channelId);
  const initial = useMemo<DefaultDraft | null>(() => (state ? toDefaultDraft(state) : null), [state]);
  const [draft, setDraft] = useState<DefaultDraft | null>(initial);
  const [showProblems, setShowProblems] = useState(false);
  useEffect(() => { setDraft(initial); setShowProblems(false); }, [initial]);
  const replaceable = Boolean(state?.defaults.response);
  const live = useTemplateIssues(channelId, draft?.response ?? '', { key: state?.key, enabled: Boolean(state && replaceable) });

  const save = useChannelMutation({
    mutationFn: () => defaultCommandsApi.save(channelId, state!.key, fromDefaultDraft(state!, draft!)),
    invalidate: [defaultCommandsKey(channelId)],
    successMessage: `${prefix}${state?.trigger ?? ''} saved.`,
    errorMessage: false,
    onSuccess: () => onClose(),
  });
  const reset = useChannelMutation({
    mutationFn: () => defaultCommandsApi.reset(channelId, state!.key),
    invalidate: [defaultCommandsKey(channelId)],
    successMessage: `${prefix}${state?.trigger ?? ''} is back to its defaults.`,
    errorMessage: false,
    onSuccess: () => onClose(),
  });

  if (!state || !draft) return null;

  const set = <K extends keyof DefaultDraft>(key: K, value: DefaultDraft[K]) => setDraft((current) => (current ? { ...current, [key]: value } : current));
  const problems = defaultDraftProblems(state, draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const error = save.error ?? reset.error;
  const submitted = templateIssuesFrom(isTwitchApiError(save.error) ? save.error.details : undefined, 'response_override');
  const responseIssues = issueMessages(submitted.length ? submitted : live.issues);
  const preview = describeCommand({
    name: `${prefix}${state.trigger}`, aliases: parseBuiltinAliases(draft.aliasesText, state.trigger).map((a) => `${prefix}${a}`),
    match_mode: 'trigger', level: draft.level, global_cooldown_s: draft.global_cooldown_s, user_cooldown_s: draft.user_cooldown_s,
    cost: draft.cost, availability: state.availability ?? 'always', send_mode: 'say', announce_color: null,
  }, levelLabel, currency);
  const subLevels = Object.entries(state.subcommand_levels ?? {});

  const submit = () => {
    if (Object.keys(problems).length || live.issues.some((issue) => issue.severity === 'error')) { setShowProblems(true); return; }
    save.mutate();
  };

  return (
    <EditorDrawer
      open
      title={`${prefix}${state.trigger}`}
      description={state.description}
      onClose={() => { save.reset(); reset.reset(); onClose(); }}
      onSubmit={canEdit ? submit : onClose}
      submitting={save.isPending}
      error={error ? twitchErrorMessage(error) : null}
      dirty={canEdit && dirty}
      submitLabel={canEdit ? 'Save' : 'Close'}
      secondaryAction={canEdit && state.override ? (
        <button type="button" className="btn" disabled={reset.isPending} onClick={() => reset.mutate()}>Reset to defaults</button>
      ) : undefined}
    >
      {!canEdit && <ReadOnlyNotice required="editor" role={role} what="built-in commands" />}
      <p className="tw-muted">Usage: <code className="tw-code-list">{withPrefix(state.usage, prefix)}</code> · {MODULE_LABELS[state.module] ?? state.module}</p>
      <Switch checked={draft.enabled} onChange={(value) => set('enabled', value)} label="Enabled" disabled={!canEdit}
        description={`Turning it off frees ${prefix}${state.trigger} for a custom command.`} />
      <div className="tw-cmd-grid">
        <LevelSelect value={draft.level} onChange={(value) => set('level', value)} disabled={!canEdit}
          help={`Default: ${levelLabel(state.defaults.level)}`} />
        <Field label={`Cost (${currency})`} error={showProblems ? problems.cost : undefined}
          help={`Default: ${state.defaults.cost}`}>
          {(control) => (
            <NumberInput {...control} className="form-control" min={0} max={COMMAND_LIMITS.costMax} step={1} disabled={!canEdit}
              value={draft.cost} onValueChange={(value) => set('cost', Math.max(0, Math.round(value)))} />
          )}
        </Field>
        <DurationInput label="Channel cooldown" seconds={draft.global_cooldown_s} min={0} max={COMMAND_LIMITS.cooldownMax}
          disabled={!canEdit} onChange={(value) => set('global_cooldown_s', value)} help={`Default: ${state.defaults.global_cooldown_s} s`} />
        <DurationInput label="Per-viewer cooldown" seconds={draft.user_cooldown_s} min={0} max={COMMAND_LIMITS.cooldownMax}
          disabled={!canEdit} onChange={(value) => set('user_cooldown_s', value)} help={`Default: ${state.defaults.user_cooldown_s} s`} />
      </div>
      <Field label="Aliases" optional error={showProblems ? problems.aliases : undefined}
        help={`Other names, separated by commas${state.defaults.aliases.length ? `. Default: ${state.defaults.aliases.map((a) => prefix + a).join(', ')}` : ''}.`}>
        {(control) => (
          <input {...control} className="form-control" value={draft.aliasesText} disabled={!canEdit} autoComplete="off"
            spellCheck={false} onChange={(event) => set('aliasesText', event.target.value)} />
        )}
      </Field>
      {replaceable && (
        <TemplateField
          label="Response"
          value={draft.response}
          onChange={(value) => set('response', value)}
          maxLength={COMMAND_LIMITS.overrideMax}
          context="command"
          field={`default_commands.${state.key}`}
          disabled={!canEdit}
          placeholder={state.defaults.response ?? ''}
          issues={problems.response ? [problems.response, ...responseIssues] : responseIssues}
          help="Leave empty to use the default shown in the box."
        />
      )}
      {subLevels.length > 0 && (
        <p className="tw-muted">
          Some parts need a higher level: {subLevels.map(([name, level]) => `${name} (${levelLabel(level)})`).join(', ')}.
        </p>
      )}
      <CommandPreview preview={preview} title="How it behaves" omit={['how']} />
    </EditorDrawer>
  );
};

export const DefaultCommandsTab: React.FC<SectionProps> = ({ channelId, role }) => {
  const levelLabel = useLevelLabel();
  const canEdit = hasRole(role, 'editor');
  const [search, setSearch] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const list = useQuery({ queryKey: defaultCommandsKey(channelId), queryFn: () => defaultCommandsApi.list(channelId), retry: twitchRetry });
  const toggle = useChannelMutation({
    mutationFn: (state: DefaultCommandState) => {
      const draft = { ...toDefaultDraft(state), enabled: !state.effective.enabled };
      return defaultCommandsApi.save(channelId, state.key, fromDefaultDraft(state, draft));
    },
    invalidate: [defaultCommandsKey(channelId)],
    errorMessage: 'The built-in command could not be changed.',
  });

  if (list.isError) {
    return (
      <LoadFailed
        title="Built-in commands didn't load"
        message={`${list.error instanceof Error ? list.error.message : 'Something went wrong.'} Nothing was changed.`}
        onRetry={() => list.refetch()}
      />
    );
  }
  if (list.isPending) return <LoadingSpinner />;

  const prefix = list.data.prefix ?? '!';
  const needle = search.trim().toLowerCase();
  const rows = list.data.items.filter((item) => !needle
    || item.trigger.includes(needle.replace(/^[!#$%&*+\-.?~]/, ''))
    || item.description.toLowerCase().includes(needle)
    || (MODULE_LABELS[item.module] ?? item.module).toLowerCase().includes(needle));
  const open = list.data.items.find((item) => item.key === openKey) ?? null;

  return (
    <div className="tw-cmd-stack">
      {!canEdit && <ReadOnlyNotice required="editor" role={role} what="built-in commands" />}
      <RecordTable<DefaultCommandState>
        caption="Built-in commands"
        rows={rows}
        rowKey={(item) => item.key}
        activeKey={openKey}
        onRowClick={(item) => setOpenKey(item.key)}
        rowLabel={(item) => `${canEdit ? 'Edit' : 'View'} ${prefix}${item.trigger}`}
        toolbar={(
          <div className="tw-cmd-toolbar">
            <Field label="Search built-in commands" hideLabel>
              {(control) => (
                <div className="tw-cmd-search">
                  <Search size={16} aria-hidden="true" />
                  <input {...control} className="form-control" type="search" placeholder="Search built-in commands"
                    value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)} />
                </div>
              )}
            </Field>
          </div>
        )}
        columns={[
          {
            key: 'trigger', header: 'Command', primary: true,
            render: (item) => (
              <span className="tw-cmd-name">
                <span>{prefix}{item.trigger}</span>
                {item.effective.aliases.length > 0 && <small>{item.effective.aliases.map((a) => prefix + a).join(', ')}</small>}
              </span>
            ),
          },
          { key: 'description', header: 'What it does', render: (item) => item.description },
          { key: 'module', header: 'Feature', width: '130px', hideOnMobile: true, render: (item) => MODULE_LABELS[item.module] ?? item.module },
          { key: 'level', header: 'Who', width: '140px', render: (item) => levelLabel(item.effective.level) },
          {
            key: 'cooldown', header: 'Cooldown', width: '110px', hideOnMobile: true,
            render: (item) => cooldownSummary(item.effective.global_cooldown_s, item.effective.user_cooldown_s),
          },
          {
            key: 'state', header: 'Changed', width: '110px', hideOnMobile: true,
            render: (item) => (item.override ? <StatusChip tone="neutral">Customised</StatusChip> : null),
          },
        ]}
        rowActions={(item) => (
          <Switch checked={item.effective.enabled} label={`${prefix}${item.trigger} enabled`} hideLabel
            disabled={!canEdit || toggle.isPending} onChange={() => toggle.mutate(item)} />
        )}
        empty={<EmptyState title="No built-in commands match" description="Try another word, or clear the search." />}
      />
      <DefaultEditor channelId={channelId} state={open} prefix={prefix} canEdit={canEdit} role={role}
        onClose={() => setOpenKey(null)} />
    </div>
  );
};
