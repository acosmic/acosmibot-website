import { Routes, Route, Navigate, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { Lock, Orbit, Ticket } from 'lucide-react';
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
import { SlotsPage } from './features/slots/SlotsPage';
import { PolymorphPage } from './features/polymorph/PolymorphPage';
import { GuildAnalyticsPage } from './features/analytics/GuildAnalyticsPage';
import { ActivityMonitorPage } from './features/activity-monitor/ActivityMonitorPage';
import { EmbedsListPage } from './features/embeds/EmbedsListPage';
import { EmbedBuilderPage } from './features/embeds/EmbedBuilderPage';
import { ReactionRolesListPage } from './features/reaction-roles/ReactionRolesListPage';
import { ReactionRoleBuilderPage } from './features/reaction-roles/ReactionRoleBuilderPage';
import { Platform } from './api/streaming';
import { HomePage } from './pages/HomePage';
import { PremiumPage } from './pages/PremiumPage';
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

/** Catches the ?token= param from the API OAuth redirect and saves it, then
 *  returns the user to wherever they started login (e.g. a /u/<name> profile),
 *  falling back to the server selector. */
const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setToken } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setToken(token);
    }
    let dest = '/servers';
    try {
      const saved = localStorage.getItem('postLoginRedirect');
      if (saved) {
        dest = saved;
        localStorage.removeItem('postLoginRedirect');
      }
    } catch { /* ignore storage errors */ }
    navigate(dest, { replace: true });
  }, []);

  return null;
};

/** /me → redirect to the logged-in user's public profile (/u/<username>). */
const MeRedirect = () => {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();

  useEffect(() => {
    if (user?.username) {
      navigate(`/u/${user.username}`, { replace: true });
      return;
    }
    if (!token) {
      navigate('/', { replace: true });
      return;
    }
    const apiBase = (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';
    fetch(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => navigate(`/u/${data.username}`, { replace: true }))
      .catch(() => navigate('/', { replace: true }));
  }, [user, token, navigate]);

  return null;
};

const FeatureOutlet = () => {
  const { feature, guildId } = useParams<{ feature: string; guildId: string }>();

  // Premium lives at the top-level /premium page; carry the guild over so the
  // server picker preselects it.
  if (feature === 'premium') {
    return <Navigate to={`/premium?guild=${guildId}`} replace />;
  }

  if (feature === 'overview') {
    return <OverviewPage />;
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

  if (feature === 'slots') {
    return <SlotsPage />;
  }

  if (feature === 'polymorph') {
    return <PolymorphPage />;
  }

  if (feature === 'analytics') {
    return <GuildAnalyticsPage />;
  }

  if (feature === 'activity-monitor') {
    return <ActivityMonitorPage />;
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
      <Route path="/servers" element={<GuildSelectPage />} />
      <Route path="/u/:identifier" element={<ProfilePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/card-studio" element={<CardStudioPage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/leaderboard/:guildId" element={<LeaderboardPage />} />
      <Route path="/achievements" element={<AchievementsPage />} />
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
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/docs/:page" element={<DocsPage />} />
      <Route path="/terms-of-service" element={<TermsOfServicePage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="/premium" element={<PremiumPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
