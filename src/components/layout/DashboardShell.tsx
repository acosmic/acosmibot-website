import React, { useEffect, useState } from 'react';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <TopBar onMenuClick={() => setSidebarOpen(o => !o)} menuOpen={sidebarOpen} />
      {/* Backdrop — closes sidebar when tapped */}
      {sidebarOpen && (
        <div className="sidebar-backdrop open" onClick={closeSidebar} />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <main className="dashboard-main-content">
        <Outlet />
      </main>
    </div>
  );
};
