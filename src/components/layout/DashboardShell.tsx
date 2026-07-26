import React, { useEffect, useState } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { PublicNav } from './PublicNav';
import { ServerContextBar } from './ServerContextBar';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/store/auth';
import { useGuildStore } from '@/store/guild';
import { guildApi } from '@/api/guilds';
import '@/styles/dashboard.css';

export const DashboardShell: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { setGuilds, setSelectedGuildId } = useGuildStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    // Load guilds
    guildApi.getGuilds().then(setGuilds).catch(console.error);

  }, [isAuthenticated, navigate, setGuilds]);

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
    <div className="dashboard-shell">
      <div className="dashboard-header-stack">
        <PublicNav />
        <ServerContextBar
          onMenuClick={() => setSidebarOpen((open) => !open)}
          menuOpen={sidebarOpen}
        />
      </div>
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
