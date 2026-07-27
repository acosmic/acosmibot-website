import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Palette, Settings, Trophy, UserRound } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

const ROUTES = [
  { id: 'profile', label: 'Profile', href: '', icon: UserRound },
  { id: 'achievements', label: 'Achievements', href: '/achievements', icon: Trophy },
  { id: 'settings', label: 'Settings', href: '/settings', icon: Settings },
  { id: 'studio', label: 'Card Studio', href: '/card-studio', icon: Palette },
] as const;

export const MemberNav: React.FC = () => {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const profileHref = user?.username ? `/u/${user.username}` : '/me';

  return (
    <nav className="member-nav" aria-label="Member pages">
      <div className="member-nav__inner">
        <span className="member-nav__label">Member signal</span>
        <div className="member-nav__routes">
          {ROUTES.map((route) => {
            const href = route.id === 'profile' ? profileHref : route.href;
            const active = route.id === 'profile'
              ? location.pathname.startsWith('/u/') || location.pathname === '/me'
              : location.pathname === route.href;
            const Icon = route.icon;
            return (
              <Link
                key={route.id}
                to={href}
                className={active ? 'is-active' : ''}
                aria-current={active ? 'page' : undefined}
              >
                <Icon aria-hidden="true" />
                <span>{route.label}</span>
                <i aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
