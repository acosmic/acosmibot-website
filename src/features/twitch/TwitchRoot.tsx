/**
 * Root of the `/twitch/*` section (§11.1). Mounted by `App.tsx`; owns the
 * Twitch session bootstrap and its own nested routes. The Discord session
 * (`AuthSessionBootstrap`, `useAuthStore`) is never read or written here.
 */
import React, { Suspense, useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowLeft, LoaderCircle, LockKeyhole } from 'lucide-react';
import { CenteredMessage } from '@/components/ui/CenteredMessage';
import { lazyRoute } from '@/lib/versionSkew';
import '@/styles/sign-in.css';
import { TwitchAuthBootstrap, forgetTwitchReturnPath, startTwitchLogin } from './shared/auth';
import { useTwitchAuthStore } from './shared/authStore';
import { TwitchMark } from './shared/ui/basics';
import { TwitchPageFrame } from './shared/ui/PageFrame';

const TwitchLandingPage = lazyRoute(() => import('./landing/TwitchLandingPage').then((module) => ({ default: module.TwitchLandingPage })));
const ChannelPickerPage = lazyRoute(() => import('./dashboard/ChannelPickerPage').then((module) => ({ default: module.ChannelPickerPage })));
const TwitchDashboardShell = lazyRoute(() => import('./shell/TwitchDashboardShell').then((module) => ({ default: module.TwitchDashboardShell })));

/** Signed-out visitor on a protected `/twitch/...` page. */
const TwitchSignInRequired: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <TwitchPageFrame labelledBy="tw-sign-in-title">
      <div className="sign-in-main">
        <section className="sign-in-card tw-sign-in-card">
          <span className="sign-in-card__icon" aria-hidden="true"><LockKeyhole /></span>
          <h1 id="tw-sign-in-title">Sign in to continue</h1>
          <p>Sign in with Twitch to open your channel dashboard. You will come straight back to this page.</p>
          <div className="sign-in-card__actions">
            <button type="button" className="sign-in-action sign-in-action--primary" onClick={() => startTwitchLogin(pathname)}>
              <TwitchMark />
              Sign in with Twitch
            </button>
            <Link className="sign-in-action" to="/twitch">
              <ArrowLeft aria-hidden="true" />
              What Acosmibot does on Twitch
            </Link>
          </div>
          <small>Signing in shares your Twitch username, profile picture and the channels you moderate. Acosmibot does not keep your sign-in token.</small>
        </section>
      </div>
    </TwitchPageFrame>
  );
};

const RequireTwitchAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const me = useTwitchAuthStore((state) => state.me);
  const isReady = useTwitchAuthStore((state) => state.isReady);
  const { pathname } = useLocation();

  // The API honoured `?return=`; the stored fallback is no longer needed.
  useEffect(() => {
    if (me && pathname !== '/twitch/dashboard') forgetTwitchReturnPath();
  }, [me, pathname]);

  if (!isReady) {
    return (
      <TwitchPageFrame>
        <CenteredMessage icon={<LoaderCircle aria-hidden="true" />} title="Checking your Twitch session…" />
      </TwitchPageFrame>
    );
  }
  return me ? children : <TwitchSignInRequired />;
};

export const TwitchRoot: React.FC = () => (
  <>
    <TwitchAuthBootstrap />
    <Suspense fallback={null}>
      <Routes>
        <Route index element={<TwitchLandingPage />} />
        <Route path="dashboard" element={<RequireTwitchAuth><ChannelPickerPage /></RequireTwitchAuth>} />
        <Route path="c/:channelId" element={<Navigate to="overview" replace />} />
        <Route path="c/:channelId/:section/*" element={<RequireTwitchAuth><TwitchDashboardShell /></RequireTwitchAuth>} />
        <Route path="*" element={<Navigate to="/twitch" replace />} />
      </Routes>
    </Suspense>
  </>
);
