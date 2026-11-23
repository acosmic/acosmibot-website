/**
 * Drawer editor for one custom command (§11.4 "EditorDrawer with TemplateField,
 * LevelSelect, cooldowns, cost, availability, aliases"). The response is checked
 * by the server while it is typed; a live preview spells out who can use the
 * command, how often and what it costs.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog, NumberInput } from '@/components/ui';
import {
  DurationInput, EditorDrawer, Field, LevelSelect, Switch, TemplateField, isTwitchApiError, twitchErrorMessage,
  useChannelMutation, useLevelLabel,
} from '../shared/ui';
import { commandsApi } from './api';
import { CommandPreview } from './CommandPreview';
import { commandsKey, useCurrencyName, useTemplateIssues } from './hooks';
import {
  ANNOUNCE_COLORS, AVAILABILITY_LABELS, COLOR_LABELS, COMMAND_LIMITS, SEND_MODE_LABELS, describeCommand, draftProblems,
  emptyDraft, fromDraft, issueMessages, sameDraft, templateIssuesFrom, toDraft,
  type AnnounceColor, type Availability, type Command, type CommandDraft, type DraftField, type MatchMode, type SendMode,
} from './model';

export interface CommandEditorProps {
  channelId: string;
  /** `'new'` to create, a command to edit, `null` when closed. */
  editing: Command | 'new' | null;
  prefix: string;
  onClose: () => void;
}

type ServerErrors = Partial<Record<DraftField | 'level' | 'announce_color', string>>;

const serverFieldErrors = (error: unknown): ServerErrors => {
  if (!isTwitchApiError(error)) return {};
  if (error.code === 'name_taken') return { name: error.message };
  const errors = (error.details as { errors?: Array<{ loc?: unknown[]; msg?: string }> } | undefined)?.errors;
  const out: ServerErrors = {};
  for (const item of Array.isArray(errors) ? errors : []) {
    const field = String(item.loc?.[0] ?? '') as keyof ServerErrors;
    if (field && !out[field] && item.msg) out[field] = item.msg;
  }
  return out;
};

export const CommandEditor: React.FC<CommandEditorProps> = ({ channelId, editing, prefix, onClose }) => {
  const levelLabel = useLevelLabel();
  const currency = useCurrencyName(channelId);
  const initial = useMemo(() => (editing && editing !== 'new' ? toDraft(editing) : emptyDraft(prefix)), [editing, prefix]);
  const [draft, setDraft] = useState<CommandDraft>(initial);
  const [showProblems, setShowProblems] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => { setDraft(initial); setShowProblems(false); }, [initial]);

  const isNew = editing === 'new';
  const set = <K extends keyof CommandDraft>(key: K, value: CommandDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const dirty = !sameDraft(draft, initial);
  const problems = draftProblems(draft);
  const live = useTemplateIssues(channelId, draft.response, { enabled: editing !== null });

  const save = useChannelMutation({
    mutationFn: () => (isNew
      ? commandsApi.create(channelId, fromDraft(draft))
      : commandsApi.update(channelId, (editing as Command).id, fromDraft(draft))),
    invalidate: [commandsKey(channelId)],
    successMessage: (result) => `${result.command.name} saved${result.live_applied === false ? '. Acosmibot will pick it up within a minute' : ''}.`,
    errorMessage: false,
    onSuccess: () => onClose(),
  });
  const remove = useChannelMutation({
    mutationFn: () => commandsApi.remove(channelId, (editing as Command).id),
    invalidate: [commandsKey(channelId)],
    successMessage: 'Command deleted.',
    onSuccess: () => { setConfirmDelete(false); onClose(); },
    onError: () => setConfirmDelete(false),
  });

  const server = serverFieldErrors(save.error);
  const submittedIssues = templateIssuesFrom(isTwitchApiError(save.error) ? save.error.details : undefined, 'response');
  const responseIssues = issueMessages(submittedIssues.length ? submittedIssues : live.issues);
  const problem = (field: DraftField): string | undefined =>
    server[field] ?? (showProblems || (field === 'response' && problems.response?.startsWith('Responses cannot'))
      ? problems[field] : undefined);
  const hasProblems = Object.keys(problems).length > 0;
  const blockingServerIssue = live.issues.some((issue) => issue.severity === 'error') && !live.stale;

  const submit = () => {
    if (hasProblems || blockingServerIssue) { setShowProblems(true); return; }
    save.mutate();
  };

  const input = fromDraft(draft);
  const preview = describeCommand(input, levelLabel, currency);
  const keyword = draft.match_mode === 'keyword';
  const drawerError = save.error && !Object.keys(server).length && !submittedIssues.length
    ? twitchErrorMessage(save.error)
    : null;

  return (
    <>
      <EditorDrawer
        open={editing !== null}
        title={isNew ? 'New command' : `Edit ${(editing as Command | null)?.name ?? 'command'}`}
        description="Changes reach chat within seconds after you save."
        onClose={() => { save.reset(); onClose(); }}
        onSubmit={submit}
        submitting={save.isPending}
        error={drawerError}
        dirty={dirty}
        submitLabel={isNew ? 'Create command' : 'Save command'}
        secondaryAction={!isNew && editing ? (
          <button type="button" className="btn" onClick={() => setConfirmDelete(true)}>Delete</button>
        ) : undefined}
      >
        <div className="tw-cmd-grid">
          <Field
            label={keyword ? 'Keyword' : 'Command name'}
            error={problem('name')}
            help={keyword
              ? 'The words to look for. Use - between words: good-morning reacts to “good morning”.'
              : `What viewers type, for example ${prefix}discord.`}
          >
            {(control) => (
              <input {...control} className="form-control" value={draft.name} maxLength={COMMAND_LIMITS.nameMax}
                autoComplete="off" spellCheck={false} onChange={(event) => set('name', event.target.value)} />
            )}
          </Field>
          <Field label="How it starts" help={keyword ? 'Keyword commands react anywhere in a message.' : 'The message has to start with the name.'}>
            {(control) => (
              <select {...control} className="form-select" value={draft.match_mode}
                onChange={(event) => set('match_mode', event.target.value as MatchMode)}>
                <option value="trigger">Message starts with the name</option>
                <option value="keyword">Message contains the keyword</option>
              </select>
            )}
          </Field>
        </div>

        {!keyword && (
          <Field label="Aliases" optional error={problem('aliases')}
            help={`Other names that run the same command, separated by commas. Up to ${COMMAND_LIMITS.aliasesMax}.`}>
            {(control) => (
              <input {...control} className="form-control" value={draft.aliasesText} placeholder={`${prefix}dc, ${prefix}server`}
                autoComplete="off" spellCheck={false} onChange={(event) => set('aliasesText', event.target.value)} />
            )}
          </Field>
        )}

        <TemplateField
          label="Response"
          value={draft.response}
          onChange={(value) => set('response', value)}
          maxLength={COMMAND_LIMITS.responseMax}
          context="command"
          required
          rows={4}
          placeholder="Join our Discord: https://… — thanks $(user)!"
          issues={problem('response') ? [problem('response') as string, ...responseIssues] : responseIssues}
          help={live.checking ? 'Checking…' : 'Use Insert variable for names, arguments, counters and more. $(1) is the first word after the command.'}
        />

        <div className="tw-cmd-grid">
          <LevelSelect value={draft.level} onChange={(value) => set('level', value)} label="Who can use it" />
          <Field label="Works" help="Limit it to live or offline time.">
            {(control) => (
              <select {...control} className="form-select" value={draft.availability}
                onChange={(event) => set('availability', event.target.value as Availability)}>
                {(Object.keys(AVAILABILITY_LABELS) as Availability[]).map((value) => (
                  <option key={value} value={value}>{AVAILABILITY_LABELS[value]}</option>
                ))}
              </select>
            )}
          </Field>
          <DurationInput label="Channel cooldown" seconds={draft.global_cooldown_s} min={0} max={COMMAND_LIMITS.cooldownMax}
            onChange={(value) => set('global_cooldown_s', value)}
            help={keyword ? `Keyword commands wait at least ${COMMAND_LIMITS.keywordMinCooldown} seconds.` : 'Time between uses by anyone.'} />
          <DurationInput label="Per-viewer cooldown" seconds={draft.user_cooldown_s} min={0} max={COMMAND_LIMITS.cooldownMax}
            onChange={(value) => set('user_cooldown_s', value)} help="Time before the same viewer can use it again." />
          <Field label={`Cost (${currency})`} error={problem('cost')} help="Taken from the viewer's balance each use; 0 is free.">
            {(control) => (
              <NumberInput {...control} className="form-control" min={0} max={COMMAND_LIMITS.costMax} step={1}
                value={draft.cost} onValueChange={(value) => set('cost', Math.max(0, Math.round(value)))} />
            )}
          </Field>
          <Field label="Send as">
            {(control) => (
              <select {...control} className="form-select" value={draft.send_mode}
                onChange={(event) => set('send_mode', event.target.value as SendMode)}>
                {(Object.keys(SEND_MODE_LABELS) as SendMode[]).map((value) => (
                  <option key={value} value={value}>{SEND_MODE_LABELS[value]}</option>
                ))}
              </select>
            )}
          </Field>
          {draft.send_mode === 'announce' && (
            <Field label="Announcement colour" help="Announcements need Acosmibot to be a moderator.">
              {(control) => (
                <select {...control} className="form-select" value={draft.announce_color}
                  onChange={(event) => set('announce_color', event.target.value as AnnounceColor)}>
                  {ANNOUNCE_COLORS.map((color) => <option key={color} value={color}>{COLOR_LABELS[color]}</option>)}
                </select>
              )}
            </Field>
          )}
        </div>

        <CommandPreview preview={preview} />

        <Field label="Description" optional error={problem('description')} help="Shown on the public command list.">
          {(control) => (
            <input {...control} className="form-control" value={draft.description} maxLength={COMMAND_LIMITS.descriptionMax}
              onChange={(event) => set('description', event.target.value)} />
          )}
        </Field>
        <Switch checked={draft.enabled} onChange={(value) => set('enabled', value)} label="Enabled"
          description="Turned-off commands stay saved but never answer." />
        <Switch checked={draft.hidden} onChange={(value) => set('hidden', value)} label="Hide from the public command list"
          description="It still works in chat." />
      </EditorDrawer>

      {confirmDelete && editing && editing !== 'new' && (
        <ConfirmDialog
          kicker="Delete command"
          title={`Delete ${editing.name}?`}
          confirmLabel="Delete"
          tone="danger"
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirmDelete(false)}
        >
          <p>Viewers will no longer be able to use it. Its use count is deleted too.</p>
        </ConfirmDialog>
      )}
    </>
  );
};
