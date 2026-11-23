/**
 * Activity (§11.4, §12.9): the channel's event log (follows, subs, gifts,
 * cheers, raids, redemptions, Hype Trains, ad breaks, polls, predictions),
 * filterable by type, paged with "Load older", and updated live from the feed.
 * Names and messages are untrusted and render only as React text.
 */
import React, { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { FeatureToggle } from '@/components/ui';
import type { SectionProps } from '../types';
import {
  EmptyState,
  ReadOnlyNotice,
  SectionPage,
  SettingsSaveBar,
  describeActivityEvent,
  describeActivityRow,
  formatDateTime,
  formatRelative,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useFeedEvents,
  useSectionSettings,
  type ActivityLine,
} from '../shared/ui';
import { activityApi } from './api';
import {
  ACTIVITY_LIVE_MAX,
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABELS,
  activityFilterAdmits,
  feedActivityType,
  type ActivitySettings,
  type ActivityType,
} from './model';
import './overlays.css';

const sentence = (line: ActivityLine) => (line.actor ? line.text : line.text.charAt(0).toUpperCase() + line.text.slice(1));

export const ActivityPage: React.FC<SectionProps> = ({ channelId, role }) => {
  const settings = useSectionSettings<ActivitySettings>(channelId, 'activity');
  const [selected, setSelected] = useState<ActivityType[]>([]);
  const [live, setLive] = useState<ActivityLine[]>([]);
  const typesKey = selected.join(',');

  const log = useInfiniteQuery({
    queryKey: tk(channelId, 'activity', 'log', typesKey),
    queryFn: ({ pageParam }) => activityApi.list(channelId, selected, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.next_before_id ?? null,
    retry: twitchRetry,
  });

  useFeedEvents(['activity.'], (event) => {
    const type = feedActivityType(event.type, event.data);
    if (!activityFilterAdmits(selected, type)) return;
    setLive((lines) => [describeActivityEvent(event), ...lines.filter((line) => line.key !== `feed-${event.id}`)].slice(0, ACTIVITY_LIVE_MAX));
  });

  const toggle = (type: ActivityType, on: boolean) => {
    setLive([]);
    setSelected((current) => ACTIVITY_TYPES.filter((item) => (item === type ? on : current.includes(item))));
  };
  const clearFilters = () => { setLive([]); setSelected([]); };
  const refresh = () => { setLive([]); void log.refetch(); };

  const stored = (log.data?.pages ?? []).flatMap((page) => page.items ?? []).map(describeActivityRow);
  const lines = [...live, ...stored];
  const filtered = selected.length > 0;

  return (
    <SectionPage
      title="Activity"
      description="Follows, subscriptions, gifts, cheers, raids, redemptions and other channel events. New events appear here as they happen."
      query={log}
      actions={(
        <button type="button" className="btn" onClick={refresh} disabled={log.isFetching} aria-busy={log.isFetching}>
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      )}
    >
      <div className="tw-ov-stack">
        <fieldset className="tw-ov-filter">
          <legend className="form-label">Show</legend>
          <div className="tw-ov-filter__chips">
            {ACTIVITY_TYPES.map((type) => {
              const id = `tw-activity-filter-${type}`;
              const checked = selected.includes(type);
              return (
                <label key={type} htmlFor={id} className={`tw-ov-chip${checked ? ' is-selected' : ''}`}>
                  <input id={id} type="checkbox" className="visually-hidden" checked={checked}
                    onChange={(event) => toggle(type, event.target.checked)} />
                  <span>{ACTIVITY_TYPE_LABELS[type]}</span>
                </label>
              );
            })}
            {filtered && <button type="button" className="btn" onClick={clearFilters}>Show all</button>}
          </div>
        </fieldset>

        <section aria-labelledby="tw-activity-log-title">
          <h2 id="tw-activity-log-title" className="visually-hidden">Events</h2>
          {lines.length === 0 ? (
            filtered ? (
              <EmptyState title="No matching events" description="Nothing of these types has happened yet. Choose other types or show all." />
            ) : (
              <EmptyState title="No activity yet" description="Follows, subscriptions, cheers, raids and redemptions appear here as they happen." />
            )
          ) : (
            <ol className="tw-activity-list tw-ov-log" aria-live="polite" aria-relevant="additions">
              {lines.map((line) => (
                <li key={line.key}>
                  <span className="tw-activity-list__text">
                    <span className="tw-ov-log__type">{ACTIVITY_TYPE_LABELS[line.type as ActivityType] ?? line.type}</span>
                    {line.actor && <strong>{line.actor} </strong>}
                    {sentence(line)}
                    {line.message && <span className="tw-activity-list__message">“{line.message}”</span>}
                  </span>
                  <time dateTime={line.at} title={formatDateTime(line.at)}>{formatRelative(line.at)}</time>
                </li>
              ))}
            </ol>
          )}
          {log.hasNextPage && (
            <div className="tw-ov-more">
              <button type="button" className="btn" onClick={() => void log.fetchNextPage()} disabled={log.isFetchingNextPage}
                aria-busy={log.isFetchingNextPage}>
                {log.isFetchingNextPage ? 'Loading…' : 'Load older'}
              </button>
            </div>
          )}
          {log.isFetchNextPageError && (
            <p className="tw-field__error" role="alert">{twitchErrorMessage(log.error)}</p>
          )}
        </section>

        {settings.form && (
          <section className="tw-ov-card" aria-labelledby="tw-activity-settings">
            <h2 id="tw-activity-settings" className="tw-ov-card__title">Activity log settings</h2>
            {!settings.canWrite && <ReadOnlyNotice required={settings.writeRole} role={role} />}
            <FeatureToggle
              label="Record the activity log"
              description="When off, new events are still shown here live but are not stored. Stored events are kept for 90 days."
              enabled={settings.form.enabled}
              onChange={(enabled) => settings.canWrite && settings.setForm({ enabled })}
            />
          </section>
        )}
        <SettingsSaveBar settings={settings} />
      </div>
    </SectionPage>
  );
};
