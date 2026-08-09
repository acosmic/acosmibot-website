/**
 * THESIS: Server administration is one connected control matrix, not a pile of unrelated settings cards.
 * OWN-WORLD: Observatory void, opaque instrument panels, cyan routing signals, shaped server coordinates, and quiet topology lines.
 * STORY: Choose a server, select a subsystem, understand its live state, configure it, and commit changes without losing context.
 * FIRST VIEWPORT: A compact server coordinate rail and grouped subsystem rail frame one focused configuration workspace beneath a persistent context bar.
 * FORM: Third-ranked server control matrix structure in the established operational observatory; seed 56ec9964.
 */
import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { PublicNav } from './PublicNav';
import { ServerContextBar } from './ServerContextBar';
import { Sidebar } from './Sidebar';
import { useGuildStore } from '@/store/guild';
import { guildApi } from '@/api/guilds';
import '@/styles/dashboard.css';

export const DashboardShell: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { setGuilds, setSelectedGuildId } = useGuildStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [accessFailed, setAccessFailed] = useState(false);
  const guilds = useGuildStore((state) => state.guilds);

  useEffect(() => {
    // Load guilds
    guildApi.getGuilds()
      .then((nextGuilds) => {
        setGuilds(nextGuilds);
        setAccessLoaded(true);
      })
      .catch((error) => { console.error(error); setAccessFailed(true); });

  }, [setGuilds]);

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

  const activeGuild = guilds.find((guild) => guild.id === guildId);
  const canManage = Boolean(activeGuild?.owner || activeGuild?.permissions?.includes('administrator'));
  if (!accessLoaded && !accessFailed) {
    return <div role="status" aria-live="polite" className="dashboard-shell">Checking server access…</div>;
  }
  if (accessFailed && guildId) {
    return <Navigate to={`/server/${guildId}`} replace />;
  }
  if (accessLoaded && guildId && !canManage) {
    // The member hub is intentionally a different surface from the admin
    // control matrix; API authorization remains the final authority.
    return <Navigate to={`/server/${guildId}`} replace />;
  }

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
