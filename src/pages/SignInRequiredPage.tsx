import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { DiscordLogo } from '@/components/ui/DiscordLogo';
import { startLogin } from '@/lib/auth';
import '@/styles/sign-in.css';

/** Friendly name for the page a signed-out visitor tried to open. */
const destinationLabel = (pathname: string): string => {
  if (pathname.startsWith('/server/')) return 'this server dashboard';
  if (pathname === '/servers') return 'your servers';
  if (pathname === '/settings') return 'your settings';
  if (pathname === '/credits') return 'your AI Credits wallet';
  if (pathname === '/card-studio') return 'Card Studio';
  if (pathname === '/admin') return 'the admin panel';
  return 'this page';
};

/**
 * Shown in place of a protected page when the visitor is signed out. Login
 * remembers the requested path (see `startLogin`), so after Discord
 * authorisation the visitor lands back on the page they asked for instead of
 * the homepage.
 */
export const SignInRequiredPage: React.FC = () => {
  const { pathname } = useLocation();

  return (
    <div className="sign-in-page">
      <PublicNav variant="observatory" />
      <main className="sign-in-main">
        <section className="sign-in-card" aria-labelledby="sign-in-title">
          <span className="sign-in-card__icon" aria-hidden="true"><LockKeyhole /></span>
          <h1 id="sign-in-title">Log in to continue</h1>
          <p>
            Log in with Discord to open {destinationLabel(pathname)}. You'll come straight back here afterwards.
          </p>
          <div className="sign-in-card__actions">
            <button type="button" className="sign-in-action sign-in-action--primary" onClick={startLogin}>
              <DiscordLogo size={18} />
              Log in with Discord
            </button>
            <Link className="sign-in-action" to="/">
              <ArrowLeft aria-hidden="true" />
              Back to home
            </Link>
          </div>
          <small>Acosmibot only reads your Discord profile and the list of servers you're in.</small>
        </section>
      </main>
    </div>
  );
};
