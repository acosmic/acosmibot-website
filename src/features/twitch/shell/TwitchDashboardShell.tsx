/**
 * Twitch channel dashboard shell (§11.1, §11.3): the site header, a channel
 * context bar, the registry-driven sidebar and one focused workspace. It loads
 * `GET /channels/:id` into `ChannelContext`, runs the single feed poller and
 * renders the section named in the URL. The geometry is the existing server
 * dashboard's (`dashboard.css`) minus the guild rail.
 */
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { LoadFailed, LoadingSpinner } from '@/components/ui';
import '@/styles/dashboard.css';
import type { ChannelSummary } from '../types';
import { TWITCH_SECTIONS } from '../registry';
import { findSection } from '../registryUtils';
import { TwitchApiError, channelPath, twitchApi, twitchRetry } from '../shared/api';
import { useTwitchAuthStore } from '../shared/authStore';
import { summaryKey } from '../shared/queryKeys';
import { hasRole } from '../shared/roles';
import { ChannelContext, type ChannelContextValue } from '../shared/useChannel';
import { FeedProvider, useFeedEvents } from '../shared/useChannelFeed';
import { EmptyState } from '../shared/ui/basics';
import { RoleRequired } from './RoleRequired';
import { TwitchContextBar } from './TwitchContextBar';
import { TwitchSidebar } from './TwitchSidebar';
import '../shared/styles/twitch.css';

const CHANNEL_ID_PATTERN = /^[0-9]{1,32}$/;
const MOBILE_QUERY = '(max-width: 900px)';

/** Refetch the summary when the bot or stream state changes. */
const SummaryRefresher: React.FC<{ refetch: () => unknown }> = ({ refetch }) => {
  useFeedEvents(['bot.status', 'stream.online', 'stream.offline', 'channel.update'], () => { void refetch(); });
  return null;
};

export const TwitchDashboardShell: React.FC = () => {
  const { channelId = '', section: sectionId = '' } = useParams<{ channelId: string; section: string }>();
  const me = useTwitchAuthStore((state) => state.me);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const validId = CHANNEL_ID_PATTERN.test(channelId);

  const summary = useQuery({
    queryKey: summaryKey(channelId),
    queryFn: () => twitchApi.get<{ success: true; channel: ChannelSummary }>(channelPath(channelId)).then((body) => body.channel),
    enabled: validId,
    retry: twitchRetry,
  });

  const closeSidebar = () => {
    setSidebarOpen(false);
    if (window.matchMedia(MOBILE_QUERY).matches) menuButton.current?.focus();
  };

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const closeAboveMobile = (event: MediaQueryListEvent) => { if (!event.matches) setSidebarOpen(false); };
    query.addEventListener('change', closeAboveMobile);
    return () => query.removeEventListener('change', closeAboveMobile);
  }, []);

  // Close the drawer when the route changes (section or channel).
  useEffect(() => { setSidebarOpen(false); }, [channelId, sectionId]);

  const channel = summary.data;
  const access = me?.channels.find((entry) => entry.broadcaster_id === channelId);
  const role = channel?.role ?? access?.role ?? null;
  const refetchSummary = summary.refetch;
  const contextValue = useMemo<ChannelContextValue | null>(() => (
    channel ? { channelId, channel, role: channel.role, refetch: () => refetchSummary() } : null
  ), [channel, channelId, refetchSummary]);

  if (!validId) return <Navigate to="/twitch/dashboard" replace />;

  const section = findSection(TWITCH_SECTIONS, sectionId);
  if (!section && sectionId !== 'overview') return <Navigate to={`/twitch/c/${channelId}/overview`} replace />;

  let content: React.ReactNode;
  if (summary.isError) {
    const error = summary.error;
    const unavailable = error instanceof TwitchApiError && (error.status === 403 || error.status === 404);
    content = unavailable ? (
      <div className="feature-page">
        <EmptyState
          title="This channel isn't available to you"
          description={error.status === 404
            ? 'Acosmibot is not connected to this channel, or it is being removed.'
            : 'You are not a broadcaster, editor or moderator of this channel in Acosmibot.'}
          action={<Link className="btn" to="/twitch/dashboard"><ArrowLeft aria-hidden="true" size={16} /> Your channels</Link>}
        />
      </div>
    ) : (
      <LoadFailed
        title="This channel didn't load"
        message={`${error instanceof Error ? error.message : 'Something went wrong.'} Nothing was changed.`}
        onRetry={() => summary.refetch()}
      />
    );
  } else if (!channel || !contextValue) {
    content = <LoadingSpinner />;
  } else if (!section) {
    content = (
      <div className="feature-page">
        <EmptyState title="Nothing to show yet" description="No dashboard sections are available in this build." />
      </div>
    );
  } else if (!hasRole(channel.role, section.minRole)) {
    content = <div className="feature-page"><RoleRequired required={section.minRole} current={channel.role} sectionLabel={section.label} /></div>;
  } else {
    const Page = section.component;
    content = (
      <ChannelContext.Provider value={contextValue}>
        <FeedProvider key={channelId} channelId={channelId}>
          <SummaryRefresher refetch={summary.refetch} />
          <Suspense fallback={<LoadingSpinner />}>
            <Page key={`${channelId}:${section.id}`} channelId={channelId} channel={channel} role={channel.role} />
          </Suspense>
        </FeedProvider>
      </ChannelContext.Provider>
    );
  }

  return (
    <div className="dashboard-shell twitch-shell">
      <div className="dashboard-header-stack">
        <PublicNav variant="observatory" />
        <TwitchContextBar
          channelId={channelId}
          channel={channel}
          access={access}
          channels={me?.channels ?? []}
          sectionId={section?.id ?? 'overview'}
          sectionLabel={section?.label ?? 'Overview'}
          onMenuClick={() => setSidebarOpen((open) => !open)}
          menuOpen={sidebarOpen}
          menuButtonRef={menuButton}
        />
      </div>
      {sidebarOpen && <div className="sidebar-backdrop open" onClick={closeSidebar} aria-hidden="true" />}
      <TwitchSidebar
        channelId={channelId}
        channelName={channel?.display_name ?? access?.display_name ?? 'Channel'}
        role={role}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
      />
      <main className="dashboard-main-content" id="twitch-main">
        <div className="dashboard-topology" aria-hidden="true"><span /><span /><span /></div>
        {content}
      </main>
    </div>
  );
};
