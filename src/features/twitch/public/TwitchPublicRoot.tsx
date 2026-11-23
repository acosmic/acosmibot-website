/**
 * Public channel pages root, `/t/:login/*` (§11.1). Loads the channel card
 * from `GET /api/twitch-bot/public/:login` once, then renders the home page or
 * a registered public page (`<slice>/public.tsx`) that the streamer has
 * enabled. No Twitch session is needed or read here.
 */
import React, { Suspense } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { LoadFailed, LoadingSpinner } from '@/components/ui';
import type { PublicChannelResponse, TwitchPublicPage } from '../types';
import { TWITCH_PUBLIC_PAGES } from '../registry';
import { TwitchApiError, twitchApi, twitchRetry } from '../shared/api';
import { publicKey } from '../shared/queryKeys';
import { ChannelAvatar, EmptyState, StatusChip } from '../shared/ui/basics';
import { liveView } from '../shared/ui/channelStatus';
import { LOGIN_PATTERN } from '../shared/ui/inputs';
import { TwitchPageFrame } from '../shared/ui/PageFrame';
import { PublicChannelHome } from './PublicChannelHome';

export const publicChannelQueryOptions = (login: string) => ({
  queryKey: publicKey(login, 'home'),
  queryFn: () => twitchApi.get<PublicChannelResponse>(`/api/twitch-bot/public/${encodeURIComponent(login)}`),
  retry: twitchRetry,
  staleTime: 30_000,
});

const PublicPageOutlet: React.FC<{ login: string; enabled: TwitchPublicPage[] }> = ({ login, enabled }) => {
  const { page: pageId = '' } = useParams<{ page: string }>();
  const registered = TWITCH_PUBLIC_PAGES.find((page) => page.id === pageId);
  if (!registered) return <Navigate to={`/t/${login}`} replace />;
  const page = enabled.find((entry) => entry.id === pageId);
  if (!page) {
    return (
      <EmptyState
        title={`${registered.label} is turned off`}
        description="The streamer has not made this page public."
        action={<Link className="btn" to={`/t/${login}`}><ArrowLeft aria-hidden="true" size={16} /> Channel home</Link>}
      />
    );
  }
  const Page = page.component;
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Page key={`${login}:${page.id}`} login={login} />
    </Suspense>
  );
};

export const TwitchPublicRoot: React.FC = () => {
  const { login: rawLogin = '', '*': rest = '' } = useParams<{ login: string; '*': string }>();
  const { search } = useLocation();
  const login = rawLogin.toLowerCase();
  const validLogin = LOGIN_PATTERN.test(login);
  const query = useQuery({ ...publicChannelQueryOptions(login), enabled: validLogin });

  if (validLogin && rawLogin !== login) {
    return <Navigate to={`/t/${login}${rest ? `/${rest}` : ''}${search}`} replace />;
  }

  let content: React.ReactNode;
  if (!validLogin || (query.error instanceof TwitchApiError && query.error.status === 404)) {
    content = (
      <EmptyState
        title="Channel not found"
        description="No active Acosmibot channel has this name. Check the link, or ask the streamer for their page."
        action={<Link className="btn" to="/twitch">About Acosmibot on Twitch</Link>}
      />
    );
  } else if (query.isError) {
    content = (
      <LoadFailed
        title="This channel page didn't load"
        message={`${query.error instanceof Error ? query.error.message : 'Something went wrong.'} Try again in a moment.`}
        onRetry={() => query.refetch()}
      />
    );
  } else if (query.isPending) {
    content = <LoadingSpinner />;
  } else {
    const { channel, pages } = query.data;
    const enabled = TWITCH_PUBLIC_PAGES.filter((page) => pages.includes(page.id));
    const live = liveView(channel);
    content = (
      <>
        <header className="tw-public__header">
          <div className="tw-public__identity">
            <ChannelAvatar src={channel.profile_image_url} name={channel.display_name} size={56} />
            <div>
              <h1 id="tw-public-title">{channel.display_name}</h1>
              <p>twitch.tv/{channel.login}</p>
            </div>
            <StatusChip tone={live.tone}>{live.label}</StatusChip>
          </div>
          {enabled.length > 0 && (
            <nav className="tw-public__nav" aria-label={`${channel.display_name} pages`}>
              <NavLink end to={`/t/${login}`} className={({ isActive }) => `tw-tabs__tab${isActive ? ' is-active' : ''}`}>Home</NavLink>
              {enabled.map((page) => (
                <NavLink key={page.id} to={`/t/${login}/${page.id}`} className={({ isActive }) => `tw-tabs__tab${isActive ? ' is-active' : ''}`}>
                  {page.label}
                </NavLink>
              ))}
            </nav>
          )}
        </header>
        <Routes>
          <Route index element={<PublicChannelHome login={login} channel={channel} pages={enabled} />} />
          <Route path=":page/*" element={<PublicPageOutlet login={login} enabled={enabled} />} />
        </Routes>
      </>
    );
  }

  return (
    <TwitchPageFrame className="tw-public" labelledBy={query.isSuccess ? 'tw-public-title' : undefined}>
      {content}
    </TwitchPageFrame>
  );
};
