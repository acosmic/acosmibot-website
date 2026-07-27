/**
 * THESIS: Server administration is one connected control matrix, not a pile of unrelated settings cards.
 * OWN-WORLD: Observatory void, opaque instrument panels, cyan routing signals, shaped server coordinates, and quiet topology lines.
 * STORY: Choose a server, select a subsystem, understand its live state, configure it, and commit changes without losing context.
 * FIRST VIEWPORT: A compact server coordinate rail and grouped subsystem rail frame one focused configuration workspace beneath a persistent context bar.
 * FORM: Third-ranked server control matrix structure in the established operational observatory; seed 56ec9964.
 */
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

  useEffect(() => {
    if (!sidebarOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [sidebarOpen]);

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 900px)');
    const closeDrawerAboveMobile = (event: MediaQueryListEvent) => {
      if (!event.matches) setSidebarOpen(false);
    };

    mobileQuery.addEventListener('change', closeDrawerAboveMobile);
    return () => mobileQuery.removeEventListener('change', closeDrawerAboveMobile);
  }, []);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="dashboard-shell server-control-matrix">
      <div className="dashboard-header-stack">
        <PublicNav variant="observatory" />
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
        <div className="dashboard-topology" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <Outlet />
      </main>
    </div>
  );
};
