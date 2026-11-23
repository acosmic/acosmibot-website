/**
 * Analytics (§11.4, §12.10): daily chat, community and points activity as small
 * single-series bar charts (plain SVG, no chart library), totals for the range
 * and recent streams. Only recorded days are drawn; a day Acosmibot recorded
 * nothing for is a gap, never an invented zero. Each chart has a table view.
 */
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SectionProps } from '../types';
import {
  EmptyState,
  Field,
  RecordTable,
  SectionPage,
  combineQueries,
  formatDateTime,
  formatNumber,
  tk,
  twitchRetry,
  type Column,
} from '../shared/ui';
import { analyticsApi } from './api';
import {
  ANALYTICS_MAX_DAYS,
  CHART_METRICS,
  RANGE_PRESETS,
  daySeries,
  formatMinutes,
  hasAnyValue,
  niceMax,
  parseDay,
  presetRange,
  shortDay,
  type AnalyticsResponse,
  type AnalyticsMetric,
  type RangePreset,
  type StreamRow,
} from './model';
import './admin.css';

const CHART_W = 640;
const CHART_H = 160;
const PAD_LEFT = 44;
const PAD_BOTTOM = 22;
const PAD_TOP = 8;

const BarChart: React.FC<{ id: string; label: string; data: AnalyticsResponse; metric: AnalyticsMetric }> = ({ id, label, data, metric }) => {
  const series = useMemo(() => daySeries(data.from, data.to, data.days, metric), [data, metric]);
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(series.map((point) => point.value));
  const plotW = CHART_W - PAD_LEFT;
  const plotH = CHART_H - PAD_BOTTOM - PAD_TOP;
  const slot = series.length ? plotW / series.length : plotW;
  const gap = Math.min(2, slot * 0.2);
  const barW = Math.max(1, slot - gap);
  const recorded = series.filter((point) => point.value !== null);
  const total = recorded.reduce((sum, point) => sum + (point.value ?? 0), 0);
  const labelEvery = Math.max(1, Math.ceil(series.length / 6));
  const active = hover !== null ? series[hover] : null;

  return (
    <figure className="tw-chart" aria-labelledby={`${id}-title`}>
      <figcaption className="tw-chart__head">
        <h3 id={`${id}-title`} className="tw-chart__title">{label}</h3>
        <span className="tw-chart__value" aria-live="polite">
          {active
            ? `${shortDay(active.day)}: ${active.value === null ? 'not recorded' : formatNumber(active.value)}`
            : `${formatNumber(total)} in ${recorded.length} recorded day${recorded.length === 1 ? '' : 's'}`}
        </span>
      </figcaption>
      {hasAnyValue(series) ? (
        <svg className="tw-chart__svg" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img"
          aria-label={`${label}, daily, highest ${formatNumber(Math.max(...recorded.map((p) => p.value ?? 0)))}`}
          onMouseLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((fraction) => {
            const y = PAD_TOP + plotH * (1 - fraction);
            return (
              <g key={fraction} className="tw-chart__grid">
                <line x1={PAD_LEFT} x2={CHART_W} y1={y} y2={y} />
                <text x={PAD_LEFT - 6} y={y + 4} textAnchor="end">{formatNumber(Math.round(max * fraction))}</text>
              </g>
            );
          })}
          {series.map((point, index) => {
            const x = PAD_LEFT + index * slot + gap / 2;
            const value = point.value ?? 0;
            const height = point.value === null ? 0 : Math.max(value > 0 ? 2 : 0, (value / max) * plotH);
            const y = PAD_TOP + plotH - height;
            const r = Math.min(4, barW / 2, height);
            return (
              <g key={point.day}>
                {height > 0 && (
                  <path className={`tw-chart__bar${hover === index ? ' is-active' : ''}`}
                    d={`M${x},${PAD_TOP + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${PAD_TOP + plotH} Z`} />
                )}
                <rect className="tw-chart__hit" x={PAD_LEFT + index * slot} y={PAD_TOP} width={slot} height={plotH}
                  onMouseEnter={() => setHover(index)}>
                  <title>{`${shortDay(point.day)}: ${point.value === null ? 'not recorded' : formatNumber(point.value)}`}</title>
                </rect>
                {index % labelEvery === 0 && (
                  <text className="tw-chart__axis" x={x + barW / 2} y={CHART_H - 6} textAnchor="middle">{shortDay(point.day)}</text>
                )}
              </g>
            );
          })}
        </svg>
      ) : (
        <p className="tw-muted tw-chart__empty">Nothing recorded in this range.</p>
      )}
      {recorded.length > 0 && (
        <details className="tw-chart__table">
          <summary>Show as a table</summary>
          <table className="tw-admin-table">
            <thead><tr><th scope="col">Day</th><th scope="col">{label}</th></tr></thead>
            <tbody>
              {recorded.map((point) => (
                <tr key={point.day}><td>{point.day}</td><td>{formatNumber(point.value ?? 0)}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </figure>
  );
};

export const AnalyticsPage: React.FC<SectionProps> = ({ channelId }) => {
  const [preset, setPreset] = useState<RangePreset | 'custom'>('30');
  const [custom, setCustom] = useState(() => presetRange('30'));
  const [draft, setDraft] = useState(custom);
  const range = preset === 'custom' ? custom : presetRange(preset);

  const analytics = useQuery({
    queryKey: tk(channelId, 'analytics', range.from, range.to),
    queryFn: () => analyticsApi.days(channelId, range.from, range.to),
    retry: twitchRetry,
  });
  const streams = useQuery({
    queryKey: tk(channelId, 'analytics', 'streams'),
    queryFn: () => analyticsApi.streams(channelId, 10),
    retry: twitchRetry,
  });

  const start = parseDay(draft.from);
  const end = parseDay(draft.to);
  const draftProblem = !start || !end
    ? 'Choose both dates.'
    : start > end
      ? 'The start date is after the end date.'
      : (end.getTime() - start.getTime()) / 86_400_000 + 1 > ANALYTICS_MAX_DAYS
        ? `Choose at most ${ANALYTICS_MAX_DAYS} days.`
        : null;

  const data = analytics.data;
  const totals = data?.totals;
  const streamColumns: Column<StreamRow>[] = [
    { key: 'started', header: 'Started', primary: true, render: (row) => formatDateTime(row.started_at) },
    { key: 'length', header: 'Length', render: (row) => (row.ended_at ? formatMinutes(row.duration_minutes) : 'Live now') },
    { key: 'title', header: 'Title', hideOnMobile: true, render: (row) => <span className="tw-admin-clip">{row.title ?? ''}</span> },
    { key: 'category', header: 'Category', hideOnMobile: true, render: (row) => row.category_name ?? '' },
    { key: 'peak', header: 'Peak viewers', align: 'end', render: (row) => formatNumber(row.peak_viewers) },
  ];

  return (
    <SectionPage
      title="Analytics"
      description="Daily activity Acosmibot recorded in your channel, in UTC days. New numbers appear about every five minutes."
      query={combineQueries(analytics, streams)}
    >
      <div className="tw-admin-inline tw-analytics-range">
        <Field label="Range">
          {(control) => (
            <select {...control} className="form-select" value={preset}
              onChange={(event) => setPreset(event.target.value as RangePreset | 'custom')}>
              {RANGE_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              <option value="custom">Custom dates</option>
            </select>
          )}
        </Field>
        {preset === 'custom' && (
          <>
            <Field label="From">
              {(control) => <input {...control} type="date" className="form-control" value={draft.from}
                onChange={(event) => setDraft({ ...draft, from: event.target.value })} />}
            </Field>
            <Field label="To">
              {(control) => <input {...control} type="date" className="form-control" value={draft.to}
                onChange={(event) => setDraft({ ...draft, to: event.target.value })} />}
            </Field>
            <button type="button" className="btn tw-admin-inline__action" disabled={Boolean(draftProblem)}
              onClick={() => setCustom(draft)}>Show</button>
          </>
        )}
      </div>
      {preset === 'custom' && draftProblem && <p className="tw-field__error" role="alert">{draftProblem}</p>}

      {data && totals && (totals.days_recorded === 0 ? (
        <EmptyState title="Nothing recorded yet"
          description="Acosmibot records chat messages, follows, subs, bits, raids, points and stream time while it is in your channel. Numbers for this range will appear here once there is activity." />
      ) : (
        <>
          <dl className="tw-analytics-totals" aria-label="Totals for this range">
            <div><dt>Messages</dt><dd>{formatNumber(totals.messages)}</dd></div>
            <div><dt>Most chatters in a day</dt><dd>{formatNumber(totals.unique_chatters)}</dd></div>
            <div><dt>New followers</dt><dd>{formatNumber(totals.new_followers)}</dd></div>
            <div><dt>Subs and gifted subs</dt><dd>{formatNumber(totals.subs + totals.gift_subs)}</dd></div>
            <div><dt>Bits</dt><dd>{formatNumber(totals.bits)}</dd></div>
            <div><dt>Time live</dt><dd>{formatMinutes(totals.stream_minutes)}</dd></div>
            <div><dt>Peak viewers</dt><dd>{formatNumber(totals.peak_viewers)}</dd></div>
            <div><dt>Raids received</dt><dd>{formatNumber(totals.raids_received)}</dd></div>
          </dl>
          <div className="tw-analytics-grid">
            {CHART_METRICS.map((metric) => (
              <BarChart key={metric.key} id={`tw-chart-${metric.key}`} label={metric.label} data={data} metric={metric.key} />
            ))}
          </div>
        </>
      ))}

      <section className="tw-admin-section" aria-labelledby="tw-analytics-streams">
        <h2 id="tw-analytics-streams" className="tw-section-title">Recent streams</h2>
        <RecordTable rows={streams.data?.items ?? []} columns={streamColumns} rowKey={(row) => row.id} caption="Recent streams"
          empty={<EmptyState title="No streams recorded yet" description="Each stream Acosmibot sees go live is listed here with its length and peak viewers." />} />
      </section>
    </SectionPage>
  );
};
