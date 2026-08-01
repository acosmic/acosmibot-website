import { Routes, Route, Navigate, Outlet, useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { LoaderCircle, Lock, Orbit, Ticket } from 'lucide-react';
import { ComingSoonPage } from './components/ui/ComingSoonPage';
import { DashboardShell } from './components/layout/DashboardShell';
import { GiveawayPage } from './features/giveaway/GiveawayPage';
import { LevelingPage } from './features/leveling/LevelingPage';
import { StreamPlatformFeature } from './features/streaming/StreamPlatformFeature';
import { OverviewPage } from './features/overview/OverviewPage';
import { CustomCommandsPage } from './features/custom-commands/CustomCommandsPage';
import { ModerationPage } from './features/moderation/ModerationPage';
import { BannedUsersPage } from './features/banned-users/BannedUsersPage';
import { AiPage } from './features/ai/AiPage';
import { GamesPage } from './features/games/GamesPage';
import { PolymorphPage } from './features/polymorph/PolymorphPage';
import { GuildAnalyticsPage } from './features/analytics/GuildAnalyticsPage';
import { MusicPage } from './features/music/MusicPage';
import { ActivityMonitorPage } from './features/activity-monitor/ActivityMonitorPage';
import { BetterEmbedsPage } from './features/better-embeds/BetterEmbedsPage';
import { BillingPage } from './features/billing/BillingPage';
import { EmbedsListPage } from './features/embeds/EmbedsListPage';
import { EmbedBuilderPage } from './features/embeds/EmbedBuilderPage';
import { ReactionRolesListPage } from './features/reaction-roles/ReactionRolesListPage';
import { ReactionRoleBuilderPage } from './features/reaction-roles/ReactionRoleBuilderPage';
import { Platform } from './api/streaming';
import { HomePage } from './pages/HomePage';
import { PricingPage } from './pages/PremiumPage';
import { GuildSelectPage } from './pages/GuildSelectPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { CardStudioPage } from './pages/CardStudioPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { DocsPage } from './pages/docs/DocsPage';
import { TermsOfServicePage } from './pages/legal/TermsOfServicePage';
import { PrivacyPolicyPage } from './pages/legal/PrivacyPolicyPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { useAuthStore } from './store/auth';
import { AdminPage } from './pages/admin/AdminPage';
import { refreshSession } from './lib/auth';
import { CenteredMessage } from './components/ui/CenteredMessage';

/** Completes the cookie-backed OAuth redirect and returns the user to where
 * they started login, falling back to the server selector. */
const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    void refreshSession().then((authenticated) => {
      let dest = authenticated ? '/servers' : '/?error=session_failed';
      try {
        const saved = localStorage.getItem('postLoginRedirect');
        if (authenticated && saved?.startsWith('/') && !saved.startsWith('//')) {
          dest = saved;
        }
        localStorage.removeItem('postLoginRedirect');
      } catch { /* ignore storage errors */ }
      if (authenticated) {
        try { sessionStorage.setItem('acosmibot_login_complete', '1'); } catch { /* optional */ }
      }
      navigate(dest, { replace: true });
    });
  }, [navigate]);

  return <CenteredMessage icon={<LoaderCircle aria-hidden="true" />} title="Securing your session…" subtitle="Returning you to Acosmibot." />;
};

const RequireAuth = () => {
  const { isAuthReady, isAuthenticated } = useAuthStore();
  if (!isAuthReady) {
    return <CenteredMessage icon={<LoaderCircle aria-hidden="true" />} title="Checking your session…" />;
  }
  return isAuthenticated ? <Outlet /> : <Navigate to="/" replace />;
};

/** /me → redirect to the logged-in user's public profile (/u/<username>). */
const MeRedirect = () => {
  const navigate = useNavigate();
  const { user, isAuthReady, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthReady) return;
    if (user?.username) {
      navigate(`/u/${user.username}`, { replace: true });
      return;
    }
    if (!isAuthenticated) {
      navigate('/', { replace: true });
      return;
    }
    void refreshSession().then((authenticated) => {
      const refreshedUser = useAuthStore.getState().user;
      navigate(authenticated && refreshedUser?.username ? `/u/${refreshedUser.username}` : '/', { replace: true });
    });
  }, [user, isAuthReady, isAuthenticated, navigate]);

  return null;
};

const FeatureOutlet = () => {
  const { feature, guildId } = useParams<{ feature: string; guildId: string }>();

  // Pricing lives at the top-level /pricing page; carry the guild over so the
  // server picker preselects it.
  if (feature === 'premium') {
    return <Navigate to={`/pricing?guild=${guildId}`} replace />;
  }

  if (feature === 'overview') {
    return <OverviewPage />;
  }

  if (feature === 'billing') {
    return <BillingPage />;
  }
  
  if (feature === 'giveaway') {
    return <GiveawayPage />;
  }
  
  if (feature === 'leveling') {
    return <LevelingPage />;
  }
  
  if (feature === 'twitch' || feature === 'youtube' || feature === 'kick') {
    return <StreamPlatformFeature platform={feature as Platform} />;
  }
  
  if (feature === 'custom-commands') {
    return <CustomCommandsPage />;
  }
  
  if (feature === 'moderation') {
    return <ModerationPage />;
  }

  if (feature === 'banned-users') {
    return <BannedUsersPage />;
  }
  
  if (feature === 'ai') {
    return <AiPage />;
  }

  if (feature === 'games') {
    return <GamesPage />;
  }

  // Slots and Heist were merged into the consolidated Games page; keep old links working.
  if (feature === 'slots' || feature === 'heist') {
    return <Navigate to={`/server/${guildId}/games`} replace />;
  }

  if (feature === 'polymorph') {
    return <PolymorphPage />;
  }

  if (feature === 'analytics') {
    return <GuildAnalyticsPage />;
  }

  if (feature === 'music') {
    return <MusicPage />;
  }

  // Spotify is the current data source, but the public feature is now Music.
  if (feature === 'spotify') {
    return <Navigate to={`/server/${guildId}/music`} replace />;
  }

  if (feature === 'activity-monitor') {
    return <ActivityMonitorPage />;
  }

  if (feature === 'better-embeds') {
    return <BetterEmbedsPage />;
  }

  if (feature === 'jail') {
    return (
      <ComingSoonPage
        title="Jail System"
        description="Punish misbehaving members"
        icon={Lock}
        detail="The Jail System will let moderators send users to a restricted channel where messages cost credits to send."
      />
    );
  }

  if (feature === 'lottery') {
    return (
      <ComingSoonPage
        title="Lottery"
        description="Run exciting lottery events"
        icon={Ticket}
        detail="The Lottery feature will let you run server-wide lottery events where members can buy tickets for a chance to win big credit prizes."
      />
    );
  }

  if (feature === 'portals') {
    return (
      <ComingSoonPage
        title="Cross-Server Portals"
        description="Connect with other Discord servers"
        icon={Orbit}
        detail="Cross-Server Portals will let you open temporary connections to chat with other servers using Acosmibot."
      />
    );
  }

  // Unknown feature — back to the overview.
  return <Navigate to={`/server/${guildId}/overview`} replace />;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/dashboard" element={<AuthCallback />} />
      <Route path="/u/:identifier" element={<ProfilePage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/leaderboard/:guildId" element={<LeaderboardPage />} />
      <Route path="/achievements" element={<AchievementsPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/servers" element={<GuildSelectPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/card-studio" element={<CardStudioPage />} />
        <Route path="/me" element={<MeRedirect />} />
        {/* Legacy /profile retired → resolve to the owner's public profile. */}
        <Route path="/profile" element={<MeRedirect />} />
        <Route path="/server/:guildId" element={<DashboardShell />}>
          <Route path="embeds" element={<EmbedsListPage />} />
          <Route path="embeds/new" element={<EmbedBuilderPage />} />
          <Route path="embeds/edit/:embedId" element={<EmbedBuilderPage />} />
          <Route path="reaction-roles" element={<ReactionRolesListPage />} />
          <Route path="reaction-roles/new" element={<ReactionRoleBuilderPage />} />
          <Route path="reaction-roles/edit/:rrId" element={<ReactionRoleBuilderPage />} />
          <Route path=":feature" element={<FeatureOutlet />} />
          <Route index element={<Navigate to="overview" replace />} />
        </Route>
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/docs/spotify" element={<Navigate to="/docs/music" replace />} />
      <Route path="/docs/:page" element={<DocsPage />} />
      <Route path="/terms-of-service" element={<TermsOfServicePage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/premium" element={<Navigate to={{ pathname: '/pricing', search: window.location.search }} replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
