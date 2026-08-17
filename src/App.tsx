import { Routes, Route, Navigate, Outlet, useParams, useNavigate } from 'react-router-dom';
import { Suspense, useEffect } from 'react';
import { LoaderCircle, Orbit, Ticket } from 'lucide-react';
import { ComingSoonPage } from './components/ui/ComingSoonPage';
import type { Platform } from './api/streaming';
import { useAuthStore } from './store/auth';
import { refreshSession } from './lib/auth';
import { CenteredMessage } from './components/ui/CenteredMessage';
import { RouteErrorBoundary } from './components/ui/RouteErrorBoundary';
import { lazyRoute } from './lib/versionSkew';

const DashboardShell = lazyRoute(() => import('./components/layout/DashboardShell').then(module => ({ default: module.DashboardShell })));
const GiveawayPage = lazyRoute(() => import('./features/giveaway/GiveawayPage').then(module => ({ default: module.GiveawayPage })));
const LevelingPage = lazyRoute(() => import('./features/leveling/LevelingPage').then(module => ({ default: module.LevelingPage })));
const StreamPlatformFeature = lazyRoute(() => import('./features/streaming/StreamPlatformFeature').then(module => ({ default: module.StreamPlatformFeature })));
const OverviewPage = lazyRoute(() => import('./features/overview/OverviewPage').then(module => ({ default: module.OverviewPage })));
const CustomCommandsPage = lazyRoute(() => import('./features/custom-commands/CustomCommandsPage').then(module => ({ default: module.CustomCommandsPage })));
const ModerationPage = lazyRoute(() => import('./features/moderation/ModerationPage').then(module => ({ default: module.ModerationPage })));
const JailPage = lazyRoute(() => import('./features/jail/JailPage').then(module => ({ default: module.JailPage })));
const BannedUsersPage = lazyRoute(() => import('./features/banned-users/BannedUsersPage').then(module => ({ default: module.BannedUsersPage })));
const AiPage = lazyRoute(() => import('./features/ai/AiPage').then(module => ({ default: module.AiPage })));
const GamesPage = lazyRoute(() => import('./features/games/GamesPage').then(module => ({ default: module.GamesPage })));
const PolymorphPage = lazyRoute(() => import('./features/polymorph/PolymorphPage').then(module => ({ default: module.PolymorphPage })));
const GuildAnalyticsPage = lazyRoute(() => import('./features/analytics/GuildAnalyticsPage').then(module => ({ default: module.GuildAnalyticsPage })));
const MusicPage = lazyRoute(() => import('./features/music/MusicPage').then(module => ({ default: module.MusicPage })));
const ActivityMonitorPage = lazyRoute(() => import('./features/activity-monitor/ActivityMonitorPage').then(module => ({ default: module.ActivityMonitorPage })));
const BetterEmbedsPage = lazyRoute(() => import('./features/better-embeds/BetterEmbedsPage').then(module => ({ default: module.BetterEmbedsPage })));
const BillingPage = lazyRoute(() => import('./features/billing/BillingPage').then(module => ({ default: module.BillingPage })));
const EmbedsListPage = lazyRoute(() => import('./features/embeds/EmbedsListPage').then(module => ({ default: module.EmbedsListPage })));
const EmbedBuilderPage = lazyRoute(() => import('./features/embeds/EmbedBuilderPage').then(module => ({ default: module.EmbedBuilderPage })));
const ReactionRolesListPage = lazyRoute(() => import('./features/reaction-roles/ReactionRolesListPage').then(module => ({ default: module.ReactionRolesListPage })));
const ReactionRoleBuilderPage = lazyRoute(() => import('./features/reaction-roles/ReactionRoleBuilderPage').then(module => ({ default: module.ReactionRoleBuilderPage })));
const HomePage = lazyRoute(() => import('./pages/HomePage').then(module => ({ default: module.HomePage })));
const PricingPage = lazyRoute(() => import('./pages/PremiumPage').then(module => ({ default: module.PricingPage })));
const GuildSelectPage = lazyRoute(() => import('./pages/GuildSelectPage').then(module => ({ default: module.GuildSelectPage })));
const MemberServerHubPage = lazyRoute(() => import('./pages/MemberServerHubPage').then(module => ({ default: module.MemberServerHubPage })));
const ProfilePage = lazyRoute(() => import('./pages/ProfilePage').then(module => ({ default: module.ProfilePage })));
const SettingsPage = lazyRoute(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })));
const AICreditsPage = lazyRoute(() => import('./pages/AICreditsPage').then(module => ({ default: module.AICreditsPage })));
const CardStudioPage = lazyRoute(() => import('./pages/CardStudioPage').then(module => ({ default: module.CardStudioPage })));
const LeaderboardPage = lazyRoute(() => import('./pages/LeaderboardPage').then(module => ({ default: module.LeaderboardPage })));
const AchievementsPage = lazyRoute(() => import('./pages/AchievementsPage').then(module => ({ default: module.AchievementsPage })));
const DocsPage = lazyRoute(() => import('./pages/docs/DocsPage').then(module => ({ default: module.DocsPage })));
const FeatureLandingPage = lazyRoute(() => import('./pages/features/FeatureLandingPage').then(module => ({ default: module.FeatureLandingPage })));
const TermsOfServicePage = lazyRoute(() => import('./pages/legal/TermsOfServicePage').then(module => ({ default: module.TermsOfServicePage })));
const PrivacyPolicyPage = lazyRoute(() => import('./pages/legal/PrivacyPolicyPage').then(module => ({ default: module.PrivacyPolicyPage })));
const NotFoundPage = lazyRoute(() => import('./pages/NotFoundPage').then(module => ({ default: module.NotFoundPage })));
const AdminPage = lazyRoute(() => import('./pages/admin/AdminPage').then(module => ({ default: module.AdminPage })));
const MemoryOperationsPage = lazyRoute(() => import('./pages/admin/MemoryOperationsPage').then(module => ({ default: module.MemoryOperationsPage })));
const MemoryMemberPage = lazyRoute(() => import('./pages/MemoryMemberPage').then(module => ({ default: module.MemoryMemberPage })));

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

  if (feature === 'memory') {
    return <MemoryMemberPage />;
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
    return <JailPage />;
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
    <RouteErrorBoundary>
      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<HomePage />} />
      <Route path="/dashboard" element={<AuthCallback />} />
      <Route path="/u/:identifier" element={<ProfilePage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/leaderboard/:guildId" element={<LeaderboardPage />} />
      <Route path="/achievements" element={<AchievementsPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/servers" element={<GuildSelectPage />} />
        <Route path="/server/:guildId" element={<MemberServerHubPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/credits" element={<AICreditsPage />} />
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
        </Route>
        <Route path="/admin/ai-memory/constellation" element={<MemoryOperationsPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/docs/spotify" element={<Navigate to="/docs/music" replace />} />
      <Route path="/docs/:page" element={<DocsPage />} />
      <Route path="/features/ai-discord-bot" element={<FeatureLandingPage slug="ai-discord-bot" />} />
      <Route path="/features/discord-leveling-bot" element={<FeatureLandingPage slug="discord-leveling-bot" />} />
      <Route path="/features/discord-economy-bot" element={<FeatureLandingPage slug="discord-economy-bot" />} />
      <Route path="/features/discord-games-bot" element={<FeatureLandingPage slug="discord-games-bot" />} />
      <Route path="/terms-of-service" element={<TermsOfServicePage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/premium" element={<Navigate to={{ pathname: '/pricing', search: window.location.search }} replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}

export default App;
