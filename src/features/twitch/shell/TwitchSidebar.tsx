import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, LogOut } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { showToast } from '@/utils/toast';
import type { Role } from '../types';
import { TWITCH_SECTIONS } from '../registry';
import { groupSections, type SectionGroupView } from '../registryUtils';
import { roleLabel } from '../shared/roles';
import { useTwitchAuthStore } from '../shared/authStore';
import { twitchLogout } from '../shared/auth';

interface TwitchSidebarProps {
  channelId: string;
  channelName: string;
  role: Role | null;
  isOpen: boolean;
  onClose: () => void;
}

const NavGroup: React.FC<{ group: SectionGroupView; channelId: string; onNavigate: () => void }> = ({ group, channelId, onNavigate }) => {
  const [open, setOpen] = useState(true);
  const contentId = `tw-nav-${group.id}`;
  const items = (
    <div className="nav-section-content" id={contentId}>
      {group.sections.map((section) => {
        const Icon = section.icon;
        return (
          <NavLink
            key={section.id}
            to={`/twitch/c/${channelId}/${section.id}`}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={onNavigate}
          >
            <span className="nav-icon"><Icon aria-hidden="true" /></span>
            <span className="nav-text">{section.label}</span>
            <span className="nav-signal" aria-hidden="true" />
          </NavLink>
        );
      })}
    </div>
  );

  if (!group.label) return <section className="nav-section">{items}</section>;

  return (
    <section className={`nav-section${open ? '' : ' collapsed'}`}>
      <button
        type="button"
        className="nav-section-header"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        <span>{group.label}</span>
        <ChevronDown className="collapse-arrow" aria-hidden="true" />
      </button>
      {open && items}
    </section>
  );
};

/**
 * Channel navigation (§11.3). Every item comes from the section registry and
 * is filtered by the user's role, so the sidebar only ever lists sections that
 * exist and that this user may open.
 */
export const TwitchSidebar: React.FC<TwitchSidebarProps> = ({ channelId, channelName, role, isOpen, onClose }) => {
  const groups = groupSections(TWITCH_SECTIONS, role);
  const user = useTwitchAuthStore((state) => state.me?.user ?? null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const panel = useRef<HTMLElement>(null);

  // On small screens the sidebar is a drawer: move focus into it when it opens.
  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      panel.current?.querySelector<HTMLElement>('a, button')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await twitchLogout();
      queryClient.removeQueries({ queryKey: ['twitch'] });
      navigate('/twitch', { replace: true });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not sign out. Try again.', 'error');
      setSigningOut(false);
    }
  };

  return (
    <div className="server-navigation">
      <aside
        ref={panel}
        id="twitch-channel-navigation"
        className={`navigation-sidebar${isOpen ? ' open' : ''}`}
        aria-label="Channel navigation"
      >
        <div className="sidebar-nav__identity">
          <span>Channel control</span>
          <strong>{channelName}</strong>
          <small>{role ? `${roleLabel(role)} access` : 'Checking access…'}</small>
        </div>

        <nav className="sidebar-nav" aria-label="Channel sections">
          {groups.map((group) => (
            <NavGroup key={group.id} group={group} channelId={channelId} onNavigate={onClose} />
          ))}
        </nav>

        <footer className="sidebar-nav__footer tw-sidebar-footer">
          <Link to="/twitch/dashboard" onClick={onClose}>
            <ArrowLeft aria-hidden="true" />
            <span>All channels</span>
          </Link>
          {user && (
            <div className="tw-sidebar-footer__account">
              <span>Signed in as <strong>{user.display_name || user.login}</strong></span>
              <button type="button" className="tw-link-button" onClick={() => void signOut()} disabled={signingOut} aria-busy={signingOut}>
                <LogOut aria-hidden="true" />
                {signingOut ? 'Signing out…' : 'Sign out of Twitch'}
              </button>
            </div>
          )}
        </footer>
      </aside>
    </div>
  );
};
