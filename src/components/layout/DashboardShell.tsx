import React, { useEffect } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/store/auth';
import { useGuildStore } from '@/store/guild';
import { guildApi } from '@/api/guilds';

export const DashboardShell: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user, setUser } = useAuthStore();
  const { setGuilds, setSelectedGuildId } = useGuildStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    // Load user data if not present
    if (!user) {
      // In a real app, we'd fetch user data here
      // For now, let's assume it's loaded elsewhere or fetch it
    }

    // Load guilds
    guildApi.getGuilds().then(setGuilds).catch(console.error);

  }, [isAuthenticated, navigate, user, setUser, setGuilds]);

  useEffect(() => {
    if (guildId) {
      setSelectedGuildId(guildId);
    }
  }, [guildId, setSelectedGuildId]);

  return (
    <div className="dashboard-layout vh-100 d-flex flex-column" style={{ background: 'var(--bg-primary)' }}>
      <TopBar />
      <div className="d-flex flex-grow-1 overflow-hidden">
        <Sidebar />
        <main className="flex-grow-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
