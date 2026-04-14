import React, { useEffect } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/store/auth';
import { useGuildStore } from '@/store/guild';
import { guildApi } from '@/api/guilds';
import '@/styles/dashboard.css';

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

    // Fetch user if not already loaded
    if (!user) {
      const apiBase = (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';
      const token = useAuthStore.getState().token;
      fetch(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(setUser)
        .catch(() => { /* keep going even if /auth/me fails */ });
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
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <TopBar />
      <Sidebar />
      <main className="dashboard-main-content">
        <Outlet />
      </main>
    </div>
  );
};
