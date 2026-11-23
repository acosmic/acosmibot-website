/**
 * Viewer queue (§11.4, §12.6): a line of viewers waiting to play with the streamer. Open or close the line,
 * pick who is next (the bot announces the pick in chat), remove people, and change the queue settings.
 * Viewers use !queue join, !queue leave, !queue position and !queue list in chat.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
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
  TemplateField,
  combineQueries,
  formatRelative,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useChannelMutation,
  useFeedEvents,
  useSectionSettings,
} from '../shared/ui';
import { queueApi } from './api';
import { QUEUE_LIMITS, TEMPLATE_MAX, clampPickCount, queueSettingsProblem, type QueueEntry, type QueueResponse, type ViewerQueueSettings } from './model';
import './engagement.css';

export const QueuePage: React.FC<SectionProps> = ({ channelId, channel, role }) => {
  const queryClient = useQueryClient();
  const settings = useSectionSettings<ViewerQueueSettings>(channelId, 'viewer_queue');
  const [tab, setTab] = useState<'queue' | 'settings'>('queue');
  const [count, setCount] = useState(1);
  const [confirmClear, setConfirmClear] = useState(false);

  const queue = useQuery({
    queryKey: tk(channelId, 'queue'),
    queryFn: () => queueApi.get(channelId),
    retry: twitchRetry,
  });
  // The bot and other dashboards publish queue.update; refetch the list when the line changes.
  useFeedEvents(['queue.update'], () => { void queryClient.invalidateQueries({ queryKey: tk(channelId, 'queue') }); });

  const data: QueueResponse | undefined = queue.data;
  const isOpen = data?.open ?? false;
  const enabled = data?.enabled ?? false;

  const act = useChannelMutation({
    mutationFn: (body: Parameters<typeof queueApi.action>[1]) => queueApi.action(channelId, body),
    invalidate: [tk(channelId, 'queue')],
    successMessage: (_result, body) => (body.action === 'open' ? 'Queue opened' : body.action === 'close' ? 'Queue closed' : 'Picked and announced in chat'),
    errorMessage: false,
  });
  const remove = useChannelMutation({
    mutationFn: (entry: QueueEntry) => queueApi.remove(channelId, entry.id),
    invalidate: [tk(channelId, 'queue')],
    successMessage: 'Removed from the queue',
    errorMessage: 'Could not remove them.',
  });
  const clear = useChannelMutation({
    mutationFn: () => queueApi.clear(channelId),
    invalidate: [tk(channelId, 'queue')],
    successMessage: (result) => `Cleared ${result.cleared} from the queue`,
    errorMessage: 'Could not clear the queue.',
    onSuccess: () => setConfirmClear(false),
    onError: () => setConfirmClear(false),
  });

  const items = data?.items ?? [];
  const publicOn = Boolean(settings.value?.enabled && settings.value?.public_page);
  const problem = settings.form ? queueSettingsProblem(settings.form) : null;

  return (
    <SectionPage
      title="Viewer queue"
      description="A line for viewers who want to play with you. They join with !queue join in chat; you decide when it is open and who is next."
      query={combineQueries(queue, settings.query)}
    >
      <div className="tw-en-stack">
        <Tabs
          label="Viewer queue sections" idPrefix="tw-queue"
          tabs={[{ id: 'queue', label: 'Queue', count: items.length }, { id: 'settings', label: 'Settings' }]}
          active={tab} onChange={(id) => setTab(id as 'queue' | 'settings')}
        />
        <TabPanel idPrefix="tw-queue" id="queue" active={tab}>
          <div className="tw-en-stack">
            {!enabled && (
              <p className="tw-muted" role="status">
                The viewer queue is turned off, so viewers cannot join. Turn it on in the Settings tab.
              </p>
            )}
            <section className={`tw-en-card${isOpen ? ' tw-en-card--live' : ''}`} aria-labelledby="tw-queue-state">
              <div className="tw-en-card__header">
                <div>
                  <h2 id="tw-queue-state" className="tw-en-card__title">
                    <StatusChip tone={isOpen ? 'active' : 'neutral'}>{isOpen ? 'Open' : 'Closed'}</StatusChip>
                  </h2>
                  <p className="tw-en-card__lead">{isOpen ? 'Viewers can join the line.' : 'Viewers cannot join right now.'}</p>
                </div>
                <div className="tw-en-count" aria-label={`${items.length} waiting`}>{items.length}<span className="tw-muted"> waiting</span></div>
              </div>
              {Boolean(act.error) && <p className="tw-field__error" role="alert">{twitchErrorMessage(act.error)}</p>}
              <div className="tw-en-actions">
                <button
                  type="button" className="btn" disabled={act.isPending || !enabled}
                  onClick={() => act.mutate({ action: isOpen ? 'close' : 'open' })}
                >
                  {isOpen ? 'Close the queue' : 'Open the queue'}
                </button>
                <Field label="Pick" hideLabel>
                  {(control) => (
                    <NumberInput
                      {...control} className="form-control" min={1} max={QUEUE_LIMITS.pickMax} value={count} style={{ width: 84 }}
                      aria-label="How many viewers to pick"
                      onValueChange={(value) => setCount(clampPickCount(value))}
                    />
                  )}
                </Field>
                <button
                  type="button" className="btn primary" disabled={act.isPending || items.length === 0}
                  onClick={() => act.mutate({ action: 'pick_next', count: clampPickCount(count) })}
                >
                  Pick next {count > 1 ? count : ''}
                </button>
                <button type="button" className="btn" disabled={items.length === 0} onClick={() => setConfirmClear(true)}>Clear queue</button>
              </div>
              {publicOn && (
                <p className="tw-muted">
                  <a href={`/t/${encodeURIComponent(channel.login)}/queue`} target="_blank" rel="noopener noreferrer">
                    Open the public queue page <ExternalLink size={14} aria-hidden="true" /><span className="visually-hidden"> (opens in a new tab)</span>
                  </a>
                </p>
              )}
            </section>
            <RecordTable
              rows={items}
              rowKey={(entry) => entry.id}
              caption="Viewers waiting"
              columns={[
                { key: 'place', header: '#', width: '56px', render: (entry) => items.indexOf(entry) + 1 },
                { key: 'name', header: 'Viewer', primary: true, render: (entry) => <span className="tw-en-name">{entry.display_name}</span> },
                { key: 'note', header: 'Note', hideOnMobile: true, render: (entry) => (entry.note ? <span className="tw-en-note">{entry.note}</span> : '') },
                { key: 'joined', header: 'Joined', hideOnMobile: true, render: (entry) => (entry.created_at ? formatRelative(entry.created_at) : '') },
                {
                  key: 'actions', header: 'Actions', hideHeader: true, align: 'end',
                  render: (entry) => (
                    <span className="tw-en-actions">
                      <button type="button" className="btn" disabled={act.isPending} aria-label={`Pick ${entry.display_name}`}
                        onClick={() => act.mutate({ action: 'pick', entry_id: entry.id })}>Pick</button>
                      <button type="button" className="btn" disabled={remove.isPending} aria-label={`Remove ${entry.display_name}`}
                        onClick={() => remove.mutate(entry)}>Remove</button>
                    </span>
                  ),
                },
              ]}
              empty={(
                <EmptyState
                  title="Nobody is waiting"
                  description={isOpen ? 'Viewers join with !queue join in chat.' : 'Open the queue so viewers can join.'}
                />
              )}
            />
          </div>
        </TabPanel>
        <TabPanel idPrefix="tw-queue" id="settings" active={tab}>
          {settings.form && (
            <section className="tw-en-card" aria-labelledby="tw-queue-settings">
              <h2 id="tw-queue-settings" className="tw-en-card__title">Queue settings</h2>
              {!settings.canWrite && <ReadOnlyNotice required={settings.writeRole} role={role} />}
              <FeatureToggle
                label="Viewer queue" description="Turns the queue and !queue on or off. Turn it on before opening the line."
                enabled={settings.form.enabled}
                onChange={(next) => settings.canWrite && settings.setForm({ enabled: next })}
              />
              <FeatureToggle
                label="Allow notes" description="Viewers can add a short note when they join, for example their game name."
                enabled={settings.form.allow_notes}
                onChange={(allow_notes) => settings.canWrite && settings.setForm({ allow_notes })}
              />
              <FeatureToggle
                label="Public queue page" description="Shows the line on a page anyone can open."
                enabled={settings.form.public_page}
                onChange={(public_page) => settings.canWrite && settings.setForm({ public_page })}
              />
              <div className="tw-en-grid">
                <Field label="Most viewers in the line" help={`1 to ${QUEUE_LIMITS.sizeMax}.`}>
                  {(control) => (
                    <NumberInput {...control} className="form-control" min={1} max={QUEUE_LIMITS.sizeMax} value={settings.form?.max_size}
                      disabled={!settings.canWrite} onValueChange={(max_size) => settings.setForm({ max_size })} />
                  )}
                </Field>
                <Field label="Points to join" help="0 is free. Points come from the viewer's loyalty balance.">
                  {(control) => (
                    <NumberInput {...control} className="form-control" min={0} max={QUEUE_LIMITS.costMax} value={settings.form?.cost}
                      disabled={!settings.canWrite} onValueChange={(cost) => settings.setForm({ cost })} />
                  )}
                </Field>
              </div>
              <TemplateField
                label="When someone is picked" value={settings.form.pick_template} maxLength={TEMPLATE_MAX} context="other"
                contextVars={['user', 'position']} field="viewer_queue.pick_template"
                issues={settings.issuesFor('viewer_queue.pick_template')} disabled={!settings.canWrite} rows={2}
                onChange={(pick_template) => settings.setForm({ pick_template })}
              />
              {problem && <p className="tw-field__error" role="alert">{problem}</p>}
            </section>
          )}
          <SettingsSaveBar settings={settings} validationMessage={problem ?? undefined} />
        </TabPanel>
      </div>
      {confirmClear && (
        <ConfirmDialog
          kicker="Clear queue" title="Clear the whole queue?" confirmLabel="Clear queue" pending={clear.isPending}
          onConfirm={() => clear.mutate()} onClose={() => setConfirmClear(false)}
        >
          <p>Everyone waiting is removed from the line. Points already spent to join are not refunded.</p>
        </ConfirmDialog>
      )}
    </SectionPage>
  );
};
