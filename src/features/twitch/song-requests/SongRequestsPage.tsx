/**
 * Song requests (§11.4, §12.7): the player, the queue, history, the blocklist, the fallback playlist
 * and the settings. The bot owns the queue; this page plays it and reports what the player does.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SectionProps } from '../types';
import {
  SectionPage, TabPanel, Tabs, formatNumber, tk, twitchRetry, useFeedEvents, useSectionSettings,
} from '../shared/ui';
import { songsApi } from './api';
import { BlocklistPanel } from './BlocklistPanel';
import { FallbackPanel } from './FallbackPanel';
import { HistoryPanel } from './HistoryPanel';
import type { SongSettings } from './model';
import { PlayerPanel } from './PlayerPanel';
import { QueuePanel } from './QueuePanel';
import { SettingsPanel } from './SettingsPanel';
import './song-requests.css';

type TabId = 'queue' | 'history' | 'blocklist' | 'fallback' | 'settings';
const QUEUE_REFRESH_MS = 10_000;

export const SongRequestsPage: React.FC<SectionProps> = ({ channelId, channel, role }) => {
  const queryClient = useQueryClient();
  const settings = useSectionSettings<SongSettings>(channelId, 'song_requests');
  const [tab, setTab] = useState<TabId>('queue');
  const queueKey = tk(channelId, 'songs', 'queue');
  const queue = useQuery({
    queryKey: queueKey,
    queryFn: () => songsApi.queue(channelId),
    retry: twitchRetry,
    refetchInterval: QUEUE_REFRESH_MS,
    placeholderData: (previous) => previous,
  });
  useFeedEvents(['song.queue', 'song.now_playing'], () => { void queryClient.invalidateQueries({ queryKey: queueKey }); });

  const form = settings.form;
  return (
    <SectionPage
      title="Song requests"
      description="Viewers request YouTube songs with !sr. This page plays the queue, so keep it open (in one tab) while you stream."
      query={queue}
    >
      <div className="tw-st-stack">
        <Tabs
          label="Song request sections" idPrefix="tw-songs"
          tabs={[
            { id: 'queue', label: 'Player and queue', count: queue.data?.length },
            { id: 'history', label: 'History' },
            { id: 'blocklist', label: 'Blocklist' },
            { id: 'fallback', label: 'Fallback playlist' },
            { id: 'settings', label: 'Settings' },
          ]}
          active={tab} onChange={(id) => setTab(id as TabId)}
        />
        <TabPanel idPrefix="tw-songs" id="queue" active={tab}>
          {queue.data && (
            <div className="tw-st-stack">
              <PlayerPanel channelId={channelId} queue={queue.data} volume={form?.player_volume ?? 50} fallbackOn={Boolean(form?.fallback_enabled)} />
              <QueuePanel channelId={channelId} queue={queue.data} enabled={form?.enabled ?? true} />
              {queue.data.length > 0 && <p className="tw-muted">{formatNumber(queue.data.length)} queued. The list refreshes by itself.</p>}
            </div>
          )}
        </TabPanel>
        <TabPanel idPrefix="tw-songs" id="history" active={tab}>
          {tab === 'history' && <HistoryPanel channelId={channelId} />}
        </TabPanel>
        <TabPanel idPrefix="tw-songs" id="blocklist" active={tab}>
          {tab === 'blocklist' && <BlocklistPanel channelId={channelId} />}
        </TabPanel>
        <TabPanel idPrefix="tw-songs" id="fallback" active={tab}>
          {tab === 'fallback' && <FallbackPanel channelId={channelId} role={role} fallbackOn={Boolean(form?.fallback_enabled)} />}
        </TabPanel>
        <TabPanel idPrefix="tw-songs" id="settings" active={tab}>
          {tab === 'settings' && <SettingsPanel settings={settings} role={role} login={channel.login} />}
        </TabPanel>
      </div>
    </SectionPage>
  );
};
