import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RadioTower } from 'lucide-react';
import { analyticsApi } from '@/api/analytics';
import { VolumeChart } from '@/features/analytics/charts';

const RANGE_OPTIONS = [7, 30, 90] as const;
const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  twitter: 'X / Twitter',
  bluesky: 'Bluesky',
  tiktok: 'TikTok',
  reddit: 'Reddit',
};
const platformLabel = (platform: string) =>
  PLATFORM_LABELS[platform] ?? platform.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

interface BetterEmbedsUsagePanelProps {
  guildId: string;
}

export const BetterEmbedsUsagePanel: React.FC<BetterEmbedsUsagePanelProps> = ({ guildId }) => {
  const [days, setDays] = useState<(typeof RANGE_OPTIONS)[number]>(30);
  const usage = useQuery({
    queryKey: ['guild-analytics-better-embeds', guildId, days],
    queryFn: () => analyticsApi.guildBetterEmbeds(guildId, days),
  });

  const topPlatform = useMemo(() => {
    const rows = usage.data?.platforms ?? [];
    return rows.reduce<(typeof rows)[number] | null>(
      (best, row) => (!best || row.replaced > best.replaced ? row : best),
      null,
    );
  }, [usage.data?.platforms]);

  return (
    <section className="better-embeds-usage" aria-labelledby="better-embeds-usage-title">
      <header className="better-embeds-usage__header">
        <div>
          <h2 id="better-embeds-usage-title">Replacement activity</h2>
          <p>Forward-only, content-free counts from Discord. “Posted” confirms the bot transaction, not the external preview crawler.</p>
        </div>
        <label className="better-embeds-usage__range">
          <span>Reporting range</span>
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value) as (typeof RANGE_OPTIONS)[number])}
          >
            {RANGE_OPTIONS.map((range) => (
              <option key={range} value={range}>Last {range} days</option>
            ))}
          </select>
        </label>
      </header>

      {usage.isLoading && (
        <div className="feature-load-state" role="status">
          <strong>Loading replacement activity…</strong>
          <span>Reading daily aggregates for this server.</span>
        </div>
      )}

      {usage.isError && (
        <div className="dashboard-inline-alert better-embeds-usage__error" role="alert">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>Replacement activity is unavailable</strong>
            <p>{usage.error instanceof Error ? usage.error.message : 'Try again in a moment.'}</p>
          </div>
        </div>
      )}

      {usage.data && usage.data.totals.eligible_messages === 0 && (
        <div className="better-embeds-usage__empty">
          <RadioTower aria-hidden="true" />
          <div>
            <strong>No supported links recorded in this range</strong>
            <p>Activity begins when members post enabled Instagram, X, Bluesky, TikTok, or Reddit links after the telemetry release.</p>
          </div>
        </div>
      )}

      {usage.data && usage.data.totals.eligible_messages > 0 && (
        <>
          <dl className="better-embeds-usage__metrics">
            <div>
              <dt>Replacements posted</dt>
              <dd>{usage.data.totals.replacements_posted.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Links improved</dt>
              <dd>{usage.data.totals.links_replaced.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Completion</dt>
              <dd>{Math.round(usage.data.totals.completion_rate * 100)}%</dd>
            </div>
            <div>
              <dt>Most used</dt>
              <dd>{topPlatform && topPlatform.replaced > 0 ? platformLabel(topPlatform.platform) : '—'}</dd>
            </div>
          </dl>

          {usage.data.totals.blocked_permissions > 0 && (
            <div className="dashboard-inline-alert better-embeds-usage__warning" role="status">
              <AlertTriangle aria-hidden="true" />
              <div>
                <strong>{usage.data.totals.blocked_permissions.toLocaleString()} replacement attempts were blocked</strong>
                <p>Check that Acosmibot has Send Messages and Manage Messages in every channel where social links are shared.</p>
              </div>
            </div>
          )}

          <div className="better-embeds-usage__details">
            <div className="better-embeds-usage__volume">
              <h3>Daily replacements</h3>
              <VolumeChart
                unit="replacement"
                data={{
                  granularity: 'day',
                  days,
                  buckets: usage.data.daily.map((day) => ({
                    bucket: day.date,
                    count: day.replacements_posted,
                  })),
                }}
              />
            </div>
            <div className="better-embeds-usage__platforms">
              <h3>Platform mix</h3>
              <div className="better-embeds-usage__platform-ledger">
                {usage.data.platforms.map((platform) => (
                  <div key={platform.platform}>
                    <span>{platformLabel(platform.platform)}</span>
                    <strong>{platform.replaced.toLocaleString()}</strong>
                    <small>{platform.detected.toLocaleString()} detected</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {usage.data?.tracking_started_at && (
        <p className="better-embeds-usage__footnote">
          This server’s aggregate history starts {usage.data.tracking_started_at} and is retained for up to 400 days.
        </p>
      )}
    </section>
  );
};
