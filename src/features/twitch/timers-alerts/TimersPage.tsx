/**
 * Timers (§11.4, §12.2): a list editor for timers and groups, plus the channel's
 * timer settings. Timers wait a full interval after a restart, a config change or
 * going live, so editing never makes the bot talk in a burst.
 */
import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Send } from 'lucide-react';
import { ConfirmDialog, FeatureToggle, NumberInput } from '@/components/ui';
import { showToast } from '@/utils/toast';
import type { SectionProps } from '../types';
import {
  DurationInput,
  EditorDrawer,
  EmptyState,
  Field,
  ReadOnlyNotice,
  RecordTable,
  SectionPage,
  SettingsSaveBar,
  StatusChip,
  Switch,
  TabPanel,
  Tabs,
  TemplateField,
  combineQueries,
  describeDuration,
  formatRelative,
  isTwitchApiError,
  parseTemplateIssues,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useChannelMutation,
  useSectionSettings,
  type Column,
} from '../shared/ui';
import { timersApi } from './api';
import {
  ANNOUNCE_COLORS,
  AVAILABILITY_OPTIONS,
  EMPTY_GROUP_DRAFT,
  EMPTY_TIMER_DRAFT,
  TIMER_LIMITS,
  describeRunFailure,
  describeSchedule,
  draftFromGroup,
  draftFromTimer,
  groupInputFromDraft,
  groupProblem,
  timerInputFromDraft,
  timerProblem,
  type AnnounceColor,
  type Availability,
  type GroupDraft,
  type Rotation,
  type SendMode,
  type Timer,
  type TimerDraft,
  type TimerGroup,
  type TimersSettings,
} from './model';
import './timers-alerts.css';

type Editing<T> = { kind: 'new' } | { kind: 'edit'; record: T } | null;

const sameDraft = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Server-side problems for the drawer: the API's sentence plus any template issue. */
function serverProblem(error: unknown): { message: string | null; template: string[] } {
  if (!error) return { message: null, template: [] };
  const template = isTwitchApiError(error, 'validation_failed') ? parseTemplateIssues(error.details).message ?? [] : [];
  return { message: twitchErrorMessage(error), template };
}

interface ConditionFieldsProps {
  draft: { interval_s: number; min_chat_lines: number; availability: Availability; categories: string };
  onChange: (patch: Partial<{ interval_s: number; min_chat_lines: number; availability: Availability; categories: string }>) => void;
  disabled?: boolean;
  note?: string;
}

const ConditionFields: React.FC<ConditionFieldsProps> = ({ draft, onChange, disabled, note }) => (
  <>
    {note && <p className="tw-muted">{note}</p>}
    <DurationInput
      label="Send every"
      seconds={draft.interval_s}
      min={TIMER_LIMITS.intervalMin}
      max={TIMER_LIMITS.intervalMax}
      units={['m', 'h']}
      help="At least 5 minutes. The first message comes one full interval after the bot starts, the stream goes live or you change this."
      disabled={disabled}
      onChange={(interval_s) => onChange({ interval_s })}
    />
    <Field label="Minimum chat lines" help="Chat messages that must arrive since the last message. 0 sends on the interval alone.">
      {(control) => (
        <NumberInput
          {...control}
          className="form-control"
          min={0}
          max={TIMER_LIMITS.linesMax}
          value={draft.min_chat_lines}
          disabled={disabled}
          onValueChange={(min_chat_lines) => onChange({ min_chat_lines })}
        />
      )}
    </Field>
    <Field label="When">
      {(control) => (
        <select {...control} className="form-select" value={draft.availability} disabled={disabled}
          onChange={(event) => onChange({ availability: event.target.value as Availability })}>
          {AVAILABILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      )}
    </Field>
    <Field label="Only in these categories" optional help="One category name or id per line (up to 20). Leave empty for any category.">
      {(control) => (
        <textarea {...control} className="form-control" rows={3} value={draft.categories} disabled={disabled}
          onChange={(event) => onChange({ categories: event.target.value })} />
      )}
    </Field>
  </>
);

export const TimersPage: React.FC<SectionProps> = ({ channelId, role }) => {
  const timersQuery = useQuery({
    queryKey: tk(channelId, 'timers'),
    queryFn: () => timersApi.list(channelId),
    retry: twitchRetry,
  });
  const groupsQuery = useQuery({
    queryKey: tk(channelId, 'timer-groups'),
    queryFn: () => timersApi.listGroups(channelId),
    retry: twitchRetry,
  });
  const settings = useSectionSettings<TimersSettings>(channelId, 'timers');

  const timers = timersQuery.data?.items ?? [];
  const groups = groupsQuery.data?.items ?? [];
  const groupName = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);

  const [tab, setTab] = useState<'timers' | 'groups'>('timers');
  const [editingTimer, setEditingTimer] = useState<Editing<Timer>>(null);
  const [timerDraft, setTimerDraft] = useState<TimerDraft>(EMPTY_TIMER_DRAFT);
  const timerBase = useRef<TimerDraft>(EMPTY_TIMER_DRAFT);
  const [editingGroup, setEditingGroup] = useState<Editing<TimerGroup>>(null);
  const [groupDraft, setGroupDraft] = useState<GroupDraft>(EMPTY_GROUP_DRAFT);
  const groupBase = useRef<GroupDraft>(EMPTY_GROUP_DRAFT);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'timer'; record: Timer } | { kind: 'group'; record: TimerGroup } | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const invalidate = [tk(channelId, 'timers'), tk(channelId, 'timer-groups')];

  const openTimer = (record: Timer | null) => {
    const draft = record ? draftFromTimer(record) : EMPTY_TIMER_DRAFT;
    timerBase.current = draft;
    setTimerDraft(draft);
    setClientError(null);
    saveTimer.reset();
    setEditingTimer(record ? { kind: 'edit', record } : { kind: 'new' });
  };
  const openGroup = (record: TimerGroup | null) => {
    const draft = record ? draftFromGroup(record) : EMPTY_GROUP_DRAFT;
    groupBase.current = draft;
    setGroupDraft(draft);
    setClientError(null);
    saveGroup.reset();
    setEditingGroup(record ? { kind: 'edit', record } : { kind: 'new' });
  };

  const saveTimer = useChannelMutation({
    mutationFn: (draft: TimerDraft) => {
      const input = timerInputFromDraft(draft);
      return editingTimer?.kind === 'edit'
        ? timersApi.update(channelId, editingTimer.record.id, input)
        : timersApi.create(channelId, input);
    },
    invalidate,
    successMessage: 'Timer saved',
    errorMessage: false,
    onSuccess: () => setEditingTimer(null),
  });
  const saveGroup = useChannelMutation({
    mutationFn: (draft: GroupDraft) => {
      const input = groupInputFromDraft(draft);
      return editingGroup?.kind === 'edit'
        ? timersApi.updateGroup(channelId, editingGroup.record.id, input)
        : timersApi.createGroup(channelId, input);
    },
    invalidate,
    successMessage: 'Group saved',
    errorMessage: false,
    onSuccess: () => setEditingGroup(null),
  });
  const toggle = useChannelMutation({
    mutationFn: (variables: { id: number; enabled: boolean }) => timersApi.setEnabled(channelId, variables.id, variables.enabled),
    invalidate,
    errorMessage: 'Could not change the timer.',
  });
  const remove = useChannelMutation({
    mutationFn: (target: NonNullable<typeof confirmDelete>) => target.kind === 'timer'
      ? timersApi.remove(channelId, target.record.id)
      : timersApi.removeGroup(channelId, target.record.id),
    invalidate,
    successMessage: (_data, target) => (target.kind === 'timer' ? 'Timer deleted' : 'Group deleted'),
    errorMessage: 'Could not delete it.',
    onSuccess: (_data, target) => {
      setConfirmDelete(null);
      if (target.kind === 'timer') setEditingTimer(null);
      else setEditingGroup(null);
    },
    onError: () => setConfirmDelete(null),
  });
  const runNow = useChannelMutation({
    mutationFn: (timer: Timer) => timersApi.run(channelId, timer.id),
    invalidate: [],
    errorMessage: 'Could not send the timer.',
    onSuccess: (result) => {
      if (result.sent) showToast('Sent to chat', 'success');
      else showToast(describeRunFailure(result.reason), 'error');
    },
  });

  const timerLimit = timersQuery.data?.limit ?? 50;
  const groupLimit = groupsQuery.data?.limit ?? 10;
  const timerServer = serverProblem(saveTimer.error);
  const groupServer = serverProblem(saveGroup.error);
  const timerGroup = timerDraft.group_id !== null ? groups.find((group) => group.id === timerDraft.group_id) : undefined;

  const submitTimer = () => {
    const problem = timerProblem(timerDraft);
    setClientError(problem);
    if (!problem) saveTimer.mutate(timerDraft);
  };
  const submitGroup = () => {
    const problem = groupProblem(groupDraft);
    setClientError(problem);
    if (!problem) saveGroup.mutate(groupDraft);
  };

  const timerColumns: Column<Timer>[] = [
    { key: 'name', header: 'Name', primary: true, render: (timer) => timer.name },
    {
      key: 'message', header: 'Message', hideOnMobile: true,
      render: (timer) => <span className="tw-ta-message" title={timer.message}>{timer.message}</span>,
    },
    {
      key: 'when', header: 'Runs',
      render: (timer) => timer.group_id !== null
        ? `In group ${groupName.get(timer.group_id) ?? '(unknown)'}`
        : describeSchedule(timer, describeDuration),
    },
    { key: 'last', header: 'Last sent', hideOnMobile: true, render: (timer) => timer.last_sent_at ? formatRelative(timer.last_sent_at) : 'Not yet' },
    {
      key: 'enabled', header: 'On', width: '84px',
      render: (timer) => (
        <Switch checked={timer.enabled} hideLabel label={`${timer.name} enabled`}
          disabled={toggle.isPending}
          onChange={(enabled) => toggle.mutate({ id: timer.id, enabled })} />
      ),
    },
  ];

  const groupColumns: Column<TimerGroup>[] = [
    { key: 'name', header: 'Name', primary: true, render: (group) => group.name },
    {
      key: 'members', header: 'Timers',
      render: (group) => {
        const count = timers.filter((timer) => timer.group_id === group.id).length;
        return `${count} ${count === 1 ? 'timer' : 'timers'}`;
      },
    },
    { key: 'when', header: 'Runs', render: (group) => `${describeSchedule(group, describeDuration)}, ${group.rotation === 'random' ? 'random order' : 'in order'}` },
    {
      key: 'enabled', header: 'Status', width: '110px',
      render: (group) => <StatusChip tone={group.enabled ? 'active' : 'neutral'}>{group.enabled ? 'On' : 'Off'}</StatusChip>,
    },
  ];

  return (
    <SectionPage
      title="Timers"
      description="Messages the bot sends on its own while chat is active. Each one waits for its interval and for enough chat, and never more than one goes out per check."
      query={combineQueries(timersQuery, groupsQuery)}
      actions={(
        <>
          <button type="button" className="btn" disabled={groups.length >= groupLimit} onClick={() => openGroup(null)}>
            <Plus size={16} aria-hidden="true" /> New group
          </button>
          <button type="button" className="btn primary" disabled={timers.length >= timerLimit} onClick={() => openTimer(null)}>
            <Plus size={16} aria-hidden="true" /> New timer
          </button>
        </>
      )}
    >
      <div className="tw-ta-stack">
        <Tabs
          label="Timer lists" idPrefix="tw-timers"
          tabs={[{ id: 'timers', label: 'Timers', count: timers.length }, { id: 'groups', label: 'Groups', count: groups.length }]}
          active={tab} onChange={(id) => setTab(id as 'timers' | 'groups')}
        />
        <TabPanel idPrefix="tw-timers" id="timers" active={tab}>
          <RecordTable
            rows={timers} columns={timerColumns} rowKey={(timer) => timer.id} caption="Timers"
            onRowClick={openTimer} rowLabel={(timer) => `Edit timer ${timer.name}`}
            activeKey={editingTimer?.kind === 'edit' ? editingTimer.record.id : null}
            rowActions={(timer) => (
              <div className="tw-ta-row-actions">
                <button type="button" className="btn" disabled={runNow.isPending}
                  aria-label={`Send ${timer.name} now`} onClick={() => runNow.mutate(timer)}>
                  <Send size={16} aria-hidden="true" /> Send now
                </button>
              </div>
            )}
            empty={(
              <EmptyState title="No timers yet"
                description="A timer posts a message to chat every so often, for example a reminder to follow or a link to your socials."
                action={<button type="button" className="btn primary" onClick={() => openTimer(null)}>New timer</button>} />
            )}
          />
        </TabPanel>
        <TabPanel idPrefix="tw-timers" id="groups" active={tab}>
          <RecordTable
            rows={groups} columns={groupColumns} rowKey={(group) => group.id} caption="Timer groups"
            onRowClick={openGroup} rowLabel={(group) => `Edit group ${group.name}`}
            activeKey={editingGroup?.kind === 'edit' ? editingGroup.record.id : null}
            empty={(
              <EmptyState title="No groups yet"
                description="A group shares one interval and one set of conditions between several timers and sends them one at a time, in order or at random."
                action={<button type="button" className="btn primary" onClick={() => openGroup(null)}>New group</button>} />
            )}
          />
        </TabPanel>

        {settings.form && (
          <section className="tw-ta-card" aria-labelledby="tw-timer-settings">
            <h2 id="tw-timer-settings" className="tw-ta-card__title">Channel timer settings</h2>
            {!settings.canWrite && <ReadOnlyNotice required={settings.writeRole} role={role} />}
            <FeatureToggle
              label="Timers" description="Turn every timer in this channel on or off."
              enabled={settings.form.enabled}
              onChange={(enabled) => settings.canWrite && settings.setForm({ enabled })}
            />
            <DurationInput
              label="Minimum gap between timer messages"
              seconds={settings.form.min_gap_s} min={TIMER_LIMITS.minGapMin} max={TIMER_LIMITS.minGapMax}
              units={['s', 'm']}
              help="No two timers in this channel send closer together than this."
              disabled={!settings.canWrite}
              onChange={(min_gap_s) => settings.setForm({ min_gap_s })}
            />
          </section>
        )}
      </div>
      <SettingsSaveBar settings={settings} />

      <EditorDrawer
        open={editingTimer !== null}
        title={editingTimer?.kind === 'edit' ? `Edit ${editingTimer.record.name}` : 'New timer'}
        description="The message is a template, so $(variables) work here as they do in commands."
        onClose={() => setEditingTimer(null)}
        onSubmit={submitTimer}
        submitting={saveTimer.isPending}
        error={clientError ?? timerServer.message}
        dirty={!sameDraft(timerDraft, timerBase.current)}
        submitLabel={editingTimer?.kind === 'edit' ? 'Save timer' : 'Create timer'}
        secondaryAction={editingTimer?.kind === 'edit' ? (
          <button type="button" className="btn" onClick={() => setConfirmDelete({ kind: 'timer', record: editingTimer.record })}>Delete</button>
        ) : undefined}
      >
        <Field label="Name" help="Only you see this. At most 40 characters.">
          {(control) => (
            <input {...control} className="form-control" type="text" maxLength={TIMER_LIMITS.nameMax} value={timerDraft.name}
              onChange={(event) => setTimerDraft({ ...timerDraft, name: event.target.value })} />
          )}
        </Field>
        <TemplateField
          label="Message" value={timerDraft.message} maxLength={TIMER_LIMITS.messageMax} context="timer" rows={4}
          issues={timerServer.template}
          onChange={(message) => setTimerDraft({ ...timerDraft, message })}
        />
        <Field label="Send as">
          {(control) => (
            <select {...control} className="form-select" value={timerDraft.send_mode}
              onChange={(event) => setTimerDraft({ ...timerDraft, send_mode: event.target.value as SendMode })}>
              <option value="say">A chat message</option>
              <option value="announce">An announcement</option>
            </select>
          )}
        </Field>
        {timerDraft.send_mode === 'announce' && (
          <Field label="Announcement colour">
            {(control) => (
              <select {...control} className="form-select" value={timerDraft.announce_color}
                onChange={(event) => setTimerDraft({ ...timerDraft, announce_color: event.target.value as AnnounceColor })}>
                {ANNOUNCE_COLORS.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}
              </select>
            )}
          </Field>
        )}
        <Field label="Group" optional help="A grouped timer follows the group's interval and conditions and takes its turn in the group.">
          {(control) => (
            <select {...control} className="form-select" value={timerDraft.group_id ?? ''}
              onChange={(event) => setTimerDraft({ ...timerDraft, group_id: event.target.value ? Number(event.target.value) : null })}>
              <option value="">No group</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          )}
        </Field>
        <ConditionFields
          draft={timerDraft} disabled={timerGroup !== undefined}
          note={timerGroup ? `These are set by the group "${timerGroup.name}".` : undefined}
          onChange={(patch) => setTimerDraft({ ...timerDraft, ...patch })}
        />
        {timerGroup && (
          <Field label="Order in the group" help="Lower numbers go first in a group that runs in order.">
            {(control) => (
              <NumberInput {...control} className="form-control" min={-TIMER_LIMITS.sortOrderMax} max={TIMER_LIMITS.sortOrderMax}
                value={timerDraft.sort_order}
                onValueChange={(sort_order) => setTimerDraft({ ...timerDraft, sort_order })} />
            )}
          </Field>
        )}
        <Switch label="Enabled" checked={timerDraft.enabled} onChange={(enabled) => setTimerDraft({ ...timerDraft, enabled })} />
      </EditorDrawer>

      <EditorDrawer
        open={editingGroup !== null}
        title={editingGroup?.kind === 'edit' ? `Edit ${editingGroup.record.name}` : 'New group'}
        description="Timers in a group share this schedule and send one at a time."
        onClose={() => setEditingGroup(null)}
        onSubmit={submitGroup}
        submitting={saveGroup.isPending}
        error={clientError ?? groupServer.message}
        dirty={!sameDraft(groupDraft, groupBase.current)}
        submitLabel={editingGroup?.kind === 'edit' ? 'Save group' : 'Create group'}
        secondaryAction={editingGroup?.kind === 'edit' ? (
          <button type="button" className="btn" onClick={() => setConfirmDelete({ kind: 'group', record: editingGroup.record })}>Delete</button>
        ) : undefined}
      >
        <Field label="Name" help="At most 40 characters.">
          {(control) => (
            <input {...control} className="form-control" type="text" maxLength={TIMER_LIMITS.nameMax} value={groupDraft.name}
              onChange={(event) => setGroupDraft({ ...groupDraft, name: event.target.value })} />
          )}
        </Field>
        <Field label="Order" help="In order goes through the timers by their order number. Random never repeats the last one.">
          {(control) => (
            <select {...control} className="form-select" value={groupDraft.rotation}
              onChange={(event) => setGroupDraft({ ...groupDraft, rotation: event.target.value as Rotation })}>
              <option value="sequential">In order</option>
              <option value="random">Random</option>
            </select>
          )}
        </Field>
        <ConditionFields draft={groupDraft} onChange={(patch) => setGroupDraft({ ...groupDraft, ...patch })} />
        <Switch label="Enabled" checked={groupDraft.enabled} onChange={(enabled) => setGroupDraft({ ...groupDraft, enabled })} />
        <p className="tw-muted">Add timers to this group from each timer's Group field. Deleting a group keeps its timers as ordinary timers.</p>
      </EditorDrawer>

      {confirmDelete && (
        <ConfirmDialog
          kicker={confirmDelete.kind === 'timer' ? 'Delete timer' : 'Delete group'}
          title={`Delete ${confirmDelete.record.name}?`}
          confirmLabel="Delete" pending={remove.isPending}
          onConfirm={() => remove.mutate(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        >
          {confirmDelete.kind === 'timer'
            ? 'The bot stops sending this timer. This cannot be undone.'
            : 'The group is removed. Its timers stay and run on their own schedules, so check them afterwards.'}
        </ConfirmDialog>
      )}
    </SectionPage>
  );
};
