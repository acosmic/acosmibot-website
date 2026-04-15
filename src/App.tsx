import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { DashboardShell } from './components/layout/DashboardShell';
import { LegacyFeatureView } from './components/legacy/LegacyFeatureView';
import { GiveawayPage } from './features/giveaway/GiveawayPage';
import { LevelingPage } from './features/leveling/LevelingPage';
import { StreamPlatformFeature } from './features/streaming/StreamPlatformFeature';
import { OverviewPage } from './features/overview/OverviewPage';
import { CustomCommandsPage } from './features/custom-commands/CustomCommandsPage';
import { ModerationPage } from './features/moderation/ModerationPage';
import { AiPage } from './features/ai/AiPage';
import { Platform } from './api/streaming';
import { HomePage } from './pages/HomePage';
import { GuildSelectPage } from './pages/GuildSelectPage';
import { DocsPage } from './pages/docs/DocsPage';

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
  
  return <LegacyFeatureView feature={feature || 'overview'} />;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/dashboard" element={<GuildSelectPage />} />
      <Route path="/server/:guildId" element={<DashboardShell />}>
        <Route path=":feature" element={<FeatureOutlet />} />
        <Route index element={<Navigate to="overview" replace />} />
      </Route>
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/docs/:page" element={<DocsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;