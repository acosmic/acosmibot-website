import { Routes, Route, Navigate, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { DashboardShell } from './components/layout/DashboardShell';
import { LegacyFeatureView } from './components/legacy/LegacyFeatureView';
import { GiveawayPage } from './features/giveaway/GiveawayPage';
import { LevelingPage } from './features/leveling/LevelingPage';
import { StreamPlatformFeature } from './features/streaming/StreamPlatformFeature';
import { OverviewPage } from './features/overview/OverviewPage';
import { CustomCommandsPage } from './features/custom-commands/CustomCommandsPage';
import { ModerationPage } from './features/moderation/ModerationPage';
import { AiPage } from './features/ai/AiPage';
import { SlotsPage } from './features/slots/SlotsPage';
import { PolymorphPage } from './features/polymorph/PolymorphPage';
import { Platform } from './api/streaming';
import { HomePage } from './pages/HomePage';
import { GuildSelectPage } from './pages/GuildSelectPage';
import { DocsPage } from './pages/docs/DocsPage';
import { useAuthStore } from './store/auth';
import { AdminPage } from './pages/admin/AdminPage';

/** Catches the ?token= param from the API OAuth redirect and saves it, then sends to /servers */
const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setToken } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setToken(token);
    }
    navigate('/servers', { replace: true });
  }, []);

  return null;
};

const FeatureOutlet = () => {
  const { feature } = useParams<{ feature: string }>();
  
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
  
  if (feature === 'ai') {
    return <AiPage />;
  }

  if (feature === 'slots') {
    return <SlotsPage />;
  }

  if (feature === 'polymorph') {
    return <PolymorphPage />;
  }

  return <LegacyFeatureView feature={feature || 'overview'} />;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/dashboard" element={<AuthCallback />} />
      <Route path="/servers" element={<GuildSelectPage />} />
      <Route path="/server/:guildId" element={<DashboardShell />}>
        <Route path=":feature" element={<FeatureOutlet />} />
        <Route index element={<Navigate to="overview" replace />} />
      </Route>
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/docs/:page" element={<DocsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
