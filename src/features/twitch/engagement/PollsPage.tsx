/**
 * Polls & predictions (§11.4, §12.6): start native Twitch polls and predictions, follow the live results,
 * and end, lock or resolve them. Twitch runs one poll and one prediction at a time and only offers them to
 * affiliates and partners. Chat commands (!poll, !prediction) do the same from chat.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus } from 'lucide-react';
import { ConfirmDialog, FeatureToggle, NumberInput } from '@/components/ui';
import type { SectionProps } from '../types';
import {
  EmptyState,
  Field,
  ReadOnlyNotice,
  RecordTable,
  SectionPage,
  SettingsSaveBar,
  StatusChip,
  TabPanel,
  Tabs,
  formatDateTime,
  isTwitchApiError,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useChannelMutation,
  useFeedEvents,
  useSectionSettings,
} from '../shared/ui';
import { pollsApi, predictionsApi } from './api';
import {
  EMPTY_POLL_DRAFT,
  EMPTY_PREDICTION_DRAFT,
  POLL_LIMITS,
  POLL_STATUS_LABEL,
  PREDICTION_STATUS_LABEL,
  isPollRunning,
  isPredictionRunning,
  mergePollUpdate,
  mergePredictionUpdate,
  pollInput,
  pollLeaders,
  pollProblem,
  predictionInput,
  predictionProblem,
  share,
  totalVotes,
  type Poll,
  type PollDraft,
  type PollUpdate,
  type PollsSettings,
  type Prediction,
  type PredictionDraft,
  type PredictionUpdate,
} from './model';
import './engagement.css';

/** The API's sentence, with clearer wording for the two failures people hit most. */
const problemText = (error: unknown): string => {
  if (isTwitchApiError(error, 'not_eligible')) return 'Twitch only offers polls and predictions on affiliate and partner channels.';
  if (isTwitchApiError(error, 'missing_grant')) return 'Reconnect Acosmibot on the Overview page to allow polls and predictions.';
  return twitchErrorMessage(error);
};

export const PollsPage: React.FC<SectionProps> = ({ channelId, role }) => {
  const queryClient = useQueryClient();
  const settings = useSectionSettings<PollsSettings>(channelId, 'polls');
  const [tab, setTab] = useState<'polls' | 'predictions' | 'settings'>('polls');

  const polls = useQuery({
    queryKey: tk(channelId, 'polls'), queryFn: () => pollsApi.list(channelId), retry: twitchRetry,
  });
  const predictions = useQuery({
    queryKey: tk(channelId, 'predictions'), queryFn: () => predictionsApi.list(channelId), retry: twitchRetry,
  });

  // Live results arrive through the feed; patch the cached lists instead of asking Twitch again.
  useFeedEvents<PollUpdate>(['poll.update'], (event) => {
    queryClient.setQueryData<{ success: true; items: Poll[] }>(tk(channelId, 'polls'), (old) =>
      (old ? { ...old, items: mergePollUpdate(old.items, event.data) } : old));
  });
  useFeedEvents<PredictionUpdate>(['prediction.update'], (event) => {
    queryClient.setQueryData<{ success: true; items: Prediction[] }>(tk(channelId, 'predictions'), (old) =>
      (old ? { ...old, items: mergePredictionUpdate(old.items, event.data) } : old));
  });

  const runningPoll = polls.data?.items.find(isPollRunning) ?? null;
  const runningPrediction = predictions.data?.items.find(isPredictionRunning) ?? null;

  return (
    <SectionPage
      title="Polls & predictions"
      description="Native Twitch polls and channel point predictions. Twitch allows one of each at a time and only on affiliate and partner channels."
      query={settings.query}
    >
      <div className="tw-en-stack">
        <Tabs
          label="Polls and predictions sections" idPrefix="tw-polls"
          tabs={[{ id: 'polls', label: 'Polls' }, { id: 'predictions', label: 'Predictions' }, { id: 'settings', label: 'Chat settings' }]}
          active={tab} onChange={(id) => setTab(id as typeof tab)}
        />
        <TabPanel idPrefix="tw-polls" id="polls" active={tab}>
          <PollsTab channelId={channelId} polls={polls.data?.items ?? []} running={runningPoll} list={polls}
            defaultDuration={settings.value?.default_duration_s ?? 120} />
        </TabPanel>
        <TabPanel idPrefix="tw-polls" id="predictions" active={tab}>
          <PredictionsTab channelId={channelId} predictions={predictions.data?.items ?? []} running={runningPrediction} list={predictions}
            defaultWindow={settings.value?.default_prediction_window_s ?? 120} />
        </TabPanel>
        <TabPanel idPrefix="tw-polls" id="settings" active={tab}>
          {settings.form && (
            <section className="tw-en-card" aria-labelledby="tw-polls-settings">
              <h2 id="tw-polls-settings" className="tw-en-card__title">Chat settings</h2>
              {!settings.canWrite && <ReadOnlyNotice required={settings.writeRole} role={role} />}
              <FeatureToggle
                label="Poll and prediction commands" description="Turns !poll and !prediction on or off in chat. The dashboard keeps working."
                enabled={settings.form.enabled}
                onChange={(enabled) => settings.canWrite && settings.setForm({ enabled })}
              />
              <FeatureToggle
                label="Announce poll results" description="Posts the winning choice in chat when a poll ends."
                enabled={settings.form.announce_results}
                onChange={(announce_results) => settings.canWrite && settings.setForm({ announce_results })}
              />
              <div className="tw-en-grid">
                <Field label="Default poll length (seconds)" help={`${POLL_LIMITS.pollDurationMin} to ${POLL_LIMITS.pollDurationMax}.`}>
                  {(control) => (
                    <NumberInput {...control} className="form-control" min={POLL_LIMITS.pollDurationMin} max={POLL_LIMITS.pollDurationMax}
                      value={settings.form?.default_duration_s} disabled={!settings.canWrite}
                      onValueChange={(default_duration_s) => settings.setForm({ default_duration_s })} />
                  )}
                </Field>
                <Field label="Default prediction window (seconds)" help={`${POLL_LIMITS.windowMin} to ${POLL_LIMITS.windowMax}.`}>
                  {(control) => (
                    <NumberInput {...control} className="form-control" min={POLL_LIMITS.windowMin} max={POLL_LIMITS.windowMax}
                      value={settings.form?.default_prediction_window_s} disabled={!settings.canWrite}
                      onValueChange={(default_prediction_window_s) => settings.setForm({ default_prediction_window_s })} />
                  )}
                </Field>
              </div>
            </section>
          )}
          <SettingsSaveBar settings={settings} />
        </TabPanel>
      </div>
    </SectionPage>
  );
};

interface ListState { isPending: boolean; isError: boolean; error: unknown; refetch: () => Promise<unknown> }

/** A failed Twitch read (not an affiliate, grant missing, Twitch down) stays inside the tab so the rest still works. */
const ListProblem: React.FC<{ list: ListState; what: string }> = ({ list, what }) => (
  list.isError ? (
    <div className="tw-en-card" role="alert">
      <h2 className="tw-en-card__title">{what} could not be loaded</h2>
      <p className="tw-en-card__lead">{problemText(list.error)}</p>
      <div className="tw-en-actions"><button type="button" className="btn" onClick={() => void list.refetch()}>Try again</button></div>
    </div>
  ) : list.isPending ? <p className="tw-muted" role="status">Loading {what.toLowerCase()}...</p> : null
);

/** Text inputs for a list of choices or outcomes with add and remove buttons. */
const ListEditor: React.FC<{
  noun: string; values: string[]; min: number; max: number; itemMax: number; onChange: (values: string[]) => void;
}> = ({ noun, values, min, max, itemMax, onChange }) => (
  <div className="tw-en-list-editor" role="group" aria-label={`${noun}s`}>
    {values.map((value, index) => (
      <div key={index} className="tw-en-list-editor__row">
        <Field label={`${noun} ${index + 1}`}>
          {(control) => (
            <input {...control} className="form-control" type="text" maxLength={itemMax} value={value}
              onChange={(event) => onChange(values.map((item, at) => (at === index ? event.target.value : item)))} />
          )}
        </Field>
        <button
          type="button" className="btn" disabled={values.length <= min}
          aria-label={`Remove ${noun.toLowerCase()} ${index + 1}`}
          onClick={() => onChange(values.filter((_item, at) => at !== index))}
        >
          <Minus size={16} aria-hidden="true" />
        </button>
      </div>
    ))}
    <div>
      <button type="button" className="btn" disabled={values.length >= max} onClick={() => onChange([...values, ''])}>
        <Plus size={16} aria-hidden="true" /> Add {noun.toLowerCase()}
      </button>
    </div>
  </div>
);

const PollsTab: React.FC<{ channelId: string; polls: Poll[]; running: Poll | null; defaultDuration: number; list: ListState }> = ({
  channelId, polls, running, defaultDuration, list,
}) => {
  const [draft, setDraft] = useState<PollDraft>(EMPTY_POLL_DRAFT(defaultDuration));
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState<Poll | null>(null);
  const create = useChannelMutation({
    mutationFn: (value: PollDraft) => pollsApi.create(channelId, pollInput(value)),
    invalidate: [tk(channelId, 'polls')],
    successMessage: 'Poll started',
    errorMessage: false,
    onSuccess: () => setDraft(EMPTY_POLL_DRAFT(defaultDuration)),
  });
  const end = useChannelMutation({
    mutationFn: (vars: { poll: Poll; status: 'TERMINATED' | 'ARCHIVED' }) => pollsApi.end(channelId, vars.poll.id, vars.status),
    invalidate: [tk(channelId, 'polls')],
    successMessage: (_data, vars) => (vars.status === 'ARCHIVED' ? 'Poll archived' : 'Poll ended'),
    errorMessage: false,
    onSuccess: () => setConfirmEnd(null),
    onError: () => setConfirmEnd(null),
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = pollProblem(draft);
    setProblem(found);
    if (!found) create.mutate(draft);
  };

  return (
    <div className="tw-en-stack">
      <ListProblem list={list} what="Polls" />
      {running && <PollCard poll={running} onEnd={() => setConfirmEnd(running)} busy={end.isPending} />}
      {Boolean(end.error) && <p className="tw-field__error" role="alert">{problemText(end.error)}</p>}
      <section className="tw-en-card" aria-labelledby="tw-poll-new">
        <h2 id="tw-poll-new" className="tw-en-card__title">Start a poll</h2>
        {running ? (
          <p className="tw-en-card__lead">A poll is running. End it before starting another.</p>
        ) : (
          <form onSubmit={submit} className="tw-en-stack" noValidate>
            <Field label="Question" help={`${draft.title.length} of ${POLL_LIMITS.pollTitleMax} characters`}>
              {(control) => (
                <input {...control} className="form-control" type="text" maxLength={POLL_LIMITS.pollTitleMax} value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
              )}
            </Field>
            <ListEditor noun="Choice" values={draft.choices} min={POLL_LIMITS.pollChoicesMin} max={POLL_LIMITS.pollChoicesMax}
              itemMax={POLL_LIMITS.choiceMax} onChange={(choices) => setDraft({ ...draft, choices })} />
            <Field label="Length (seconds)" help={`${POLL_LIMITS.pollDurationMin} to ${POLL_LIMITS.pollDurationMax}.`}>
              {(control) => (
                <NumberInput {...control} className="form-control" min={POLL_LIMITS.pollDurationMin} max={POLL_LIMITS.pollDurationMax}
                  value={draft.duration_s} onValueChange={(duration_s) => setDraft({ ...draft, duration_s })} />
              )}
            </Field>
            {Boolean(problem || create.error) && <p className="tw-field__error" role="alert">{problem ?? problemText(create.error)}</p>}
            <div className="tw-en-actions">
              <button type="submit" className="btn primary" disabled={create.isPending}>Start poll</button>
            </div>
          </form>
        )}
      </section>
      <RecordTable
        rows={polls.filter((poll) => poll.id !== running?.id)}
        rowKey={(poll) => poll.id}
        caption="Recent polls"
        columns={[
          { key: 'title', header: 'Poll', primary: true, render: (poll) => <span className="tw-en-name">{poll.title}</span> },
          { key: 'result', header: 'Result', render: (poll) => describeResult(poll) },
          { key: 'status', header: 'Status', hideOnMobile: true, render: (poll) => POLL_STATUS_LABEL[poll.status] ?? poll.status },
          { key: 'when', header: 'Started', hideOnMobile: true, render: (poll) => (poll.started_at ? formatDateTime(poll.started_at) : '') },
        ]}
        empty={<EmptyState title="No earlier polls" description="Polls from the last 90 days appear here after they end." />}
      />
      {confirmEnd && (
        <ConfirmDialog
          kicker="End poll" title={`End "${confirmEnd.title}"?`} confirmLabel="End poll" pending={end.isPending}
          onConfirm={() => end.mutate({ poll: confirmEnd, status: 'TERMINATED' })} onClose={() => setConfirmEnd(null)}
        >
          <p>The poll stops now and the results stay visible in chat.</p>
        </ConfirmDialog>
      )}
    </div>
  );
};

const describeResult = (poll: Poll): string => {
  const leaders = pollLeaders(poll.choices);
  const total = totalVotes(poll.choices);
  if (total === 0) return 'No votes';
  const top = leaders.map((choice) => choice.title).join(' and ');
  return `${top} (${share(leaders[0]?.votes ?? 0, total)}%) of ${total} vote${total === 1 ? '' : 's'}`;
};

const PollCard: React.FC<{ poll: Poll; onEnd: () => void; busy: boolean }> = ({ poll, onEnd, busy }) => {
  const total = totalVotes(poll.choices);
  const leaders = new Set(pollLeaders(poll.choices).map((choice) => choice.id));
  return (
    <section className="tw-en-card tw-en-card--live" aria-labelledby="tw-poll-live">
      <div className="tw-en-card__header">
        <div>
          <h2 id="tw-poll-live" className="tw-en-card__title">{poll.title}</h2>
          <p className="tw-en-card__lead"><StatusChip tone="active">Running</StatusChip> {total} vote{total === 1 ? '' : 's'}</p>
        </div>
        <button type="button" className="btn" disabled={busy} onClick={onEnd}>End poll</button>
      </div>
      <ul className="tw-en-bars" aria-live="polite">
        {poll.choices.map((choice) => (
          <li key={choice.id} className={leaders.has(choice.id) ? 'tw-en-bar--lead' : undefined}>
            <div className="tw-en-bar__label"><span>{choice.title}</span><span>{choice.votes} ({share(choice.votes, total)}%)</span></div>
            <div className="tw-en-bar__track"><div className="tw-en-bar__fill" style={{ width: `${share(choice.votes, total)}%` }} /></div>
          </li>
        ))}
      </ul>
    </section>
  );
};

const PredictionsTab: React.FC<{
  channelId: string; predictions: Prediction[]; running: Prediction | null; defaultWindow: number; list: ListState;
}> = ({
  channelId, predictions, running, defaultWindow, list,
}) => {
  const [draft, setDraft] = useState<PredictionDraft>(EMPTY_PREDICTION_DRAFT(defaultWindow));
  const [problem, setProblem] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'cancel' } | { kind: 'resolve'; outcomeId: string; title: string } | null>(null);
  const create = useChannelMutation({
    mutationFn: (value: PredictionDraft) => predictionsApi.create(channelId, predictionInput(value)),
    invalidate: [tk(channelId, 'predictions')],
    successMessage: 'Prediction started',
    errorMessage: false,
    onSuccess: () => setDraft(EMPTY_PREDICTION_DRAFT(defaultWindow)),
  });
  const manage = useChannelMutation({
    mutationFn: (vars: { prediction: Prediction; verb: 'lock' | 'resolve' | 'cancel'; outcomeId?: string }) => {
      if (vars.verb === 'lock') return predictionsApi.lock(channelId, vars.prediction.id);
      if (vars.verb === 'cancel') return predictionsApi.cancel(channelId, vars.prediction.id);
      return predictionsApi.resolve(channelId, vars.prediction.id, vars.outcomeId ?? '');
    },
    invalidate: [tk(channelId, 'predictions')],
    successMessage: (_data, vars) => (vars.verb === 'lock' ? 'Prediction locked' : vars.verb === 'resolve' ? 'Prediction resolved' : 'Prediction cancelled'),
    errorMessage: false,
    onSuccess: () => setConfirm(null),
    onError: () => setConfirm(null),
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = predictionProblem(draft);
    setProblem(found);
    if (!found) create.mutate(draft);
  };
  const totalPoints = running ? running.outcomes.reduce((sum, outcome) => sum + outcome.channel_points, 0) : 0;

  return (
    <div className="tw-en-stack">
      <ListProblem list={list} what="Predictions" />
      {running && (
        <section className="tw-en-card tw-en-card--live" aria-labelledby="tw-prediction-live">
          <div className="tw-en-card__header">
            <div>
              <h2 id="tw-prediction-live" className="tw-en-card__title">{running.title}</h2>
              <p className="tw-en-card__lead">
                <StatusChip tone={running.status === 'ACTIVE' ? 'active' : 'warning'}>{PREDICTION_STATUS_LABEL[running.status] ?? running.status}</StatusChip>
                {' '}{totalPoints.toLocaleString('en-US')} channel points in
              </p>
            </div>
            <div className="tw-en-actions">
              {running.status === 'ACTIVE' && (
                <button type="button" className="btn" disabled={manage.isPending}
                  onClick={() => manage.mutate({ prediction: running, verb: 'lock' })}>Lock predictions</button>
              )}
              <button type="button" className="btn" disabled={manage.isPending} onClick={() => setConfirm({ kind: 'cancel' })}>
                Cancel and refund
              </button>
            </div>
          </div>
          <ul className="tw-en-bars" aria-live="polite">
            {running.outcomes.map((outcome) => (
              <li key={outcome.id}>
                <div className="tw-en-bar__label">
                  <span>{outcome.title}</span>
                  <span>{outcome.users} viewer{outcome.users === 1 ? '' : 's'} · {outcome.channel_points.toLocaleString('en-US')} points</span>
                </div>
                <div className="tw-en-bar__track"><div className="tw-en-bar__fill" style={{ width: `${share(outcome.channel_points, totalPoints)}%` }} /></div>
                <div className="tw-en-actions">
                  <button type="button" className="btn" disabled={manage.isPending}
                    onClick={() => setConfirm({ kind: 'resolve', outcomeId: outcome.id, title: outcome.title })}>
                    {outcome.title} won
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {Boolean(manage.error) && <p className="tw-field__error" role="alert">{problemText(manage.error)}</p>}
      <section className="tw-en-card" aria-labelledby="tw-prediction-new">
        <h2 id="tw-prediction-new" className="tw-en-card__title">Start a prediction</h2>
        {running ? (
          <p className="tw-en-card__lead">A prediction is running. Resolve or cancel it before starting another.</p>
        ) : (
          <form onSubmit={submit} className="tw-en-stack" noValidate>
            <Field label="Question" help={`${draft.title.length} of ${POLL_LIMITS.predictionTitleMax} characters. Needs channel points turned on.`}>
              {(control) => (
                <input {...control} className="form-control" type="text" maxLength={POLL_LIMITS.predictionTitleMax} value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
              )}
            </Field>
            <ListEditor noun="Outcome" values={draft.outcomes} min={POLL_LIMITS.outcomesMin} max={POLL_LIMITS.outcomesMax}
              itemMax={POLL_LIMITS.choiceMax} onChange={(outcomes) => setDraft({ ...draft, outcomes })} />
            <Field label="Viewers can predict for (seconds)" help={`${POLL_LIMITS.windowMin} to ${POLL_LIMITS.windowMax}.`}>
              {(control) => (
                <NumberInput {...control} className="form-control" min={POLL_LIMITS.windowMin} max={POLL_LIMITS.windowMax}
                  value={draft.window_s} onValueChange={(window_s) => setDraft({ ...draft, window_s })} />
              )}
            </Field>
            {Boolean(problem || create.error) && <p className="tw-field__error" role="alert">{problem ?? problemText(create.error)}</p>}
            <div className="tw-en-actions">
              <button type="submit" className="btn primary" disabled={create.isPending}>Start prediction</button>
            </div>
          </form>
        )}
      </section>
      <RecordTable
        rows={predictions.filter((prediction) => prediction.id !== running?.id)}
        rowKey={(prediction) => prediction.id}
        caption="Recent predictions"
        columns={[
          { key: 'title', header: 'Prediction', primary: true, render: (prediction) => <span className="tw-en-name">{prediction.title}</span> },
          {
            key: 'result', header: 'Result',
            render: (prediction) => prediction.outcomes.find((outcome) => outcome.id === prediction.winning_outcome_id)?.title
              ?? (prediction.status === 'CANCELED' ? 'Refunded' : 'No winner'),
          },
          { key: 'status', header: 'Status', hideOnMobile: true, render: (prediction) => PREDICTION_STATUS_LABEL[prediction.status] ?? prediction.status },
          { key: 'when', header: 'Started', hideOnMobile: true, render: (prediction) => (prediction.created_at ? formatDateTime(prediction.created_at) : '') },
        ]}
        empty={<EmptyState title="No earlier predictions" description="Finished predictions appear here." />}
      />
      {confirm && running && (
        <ConfirmDialog
          kicker={confirm.kind === 'cancel' ? 'Cancel prediction' : 'Resolve prediction'}
          title={confirm.kind === 'cancel' ? 'Cancel this prediction?' : `Resolve with ${confirm.title}?`}
          confirmLabel={confirm.kind === 'cancel' ? 'Cancel and refund' : 'Pay out'}
          tone={confirm.kind === 'cancel' ? 'danger' : 'primary'}
          pending={manage.isPending}
          onConfirm={() => manage.mutate(confirm.kind === 'cancel'
            ? { prediction: running, verb: 'cancel' }
            : { prediction: running, verb: 'resolve', outcomeId: confirm.outcomeId })}
          onClose={() => setConfirm(null)}
        >
          <p>{confirm.kind === 'cancel'
            ? 'Every viewer gets their channel points back.'
            : 'Channel points go to the viewers who picked this outcome. This cannot be undone.'}</p>
        </ConfirmDialog>
      )}
    </div>
  );
};
