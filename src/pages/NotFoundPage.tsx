import React from 'react';
import { Link } from 'react-router-dom';
import { ProfileNav } from '@/components/profile/ProfileNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { useHydrateAuthUser } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';

/** Shown for any route the SPA doesn't know, instead of silently
 *  redirecting to the home page. */
export const NotFoundPage: React.FC = () => {
  const authUser = useAuthStore((s) => s.user);
  useHydrateAuthUser();

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ProfileNav user={authUser} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', fontWeight: 800, color: 'var(--primary-color)', lineHeight: 1 }}>404</div>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '24px', margin: '16px 0 8px' }}>Page not found</h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', marginBottom: '28px' }}>
          The page you're looking for doesn't exist or may have moved.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/" style={{
            background: 'var(--primary-color)', color: '#000', fontWeight: 700,
            borderRadius: '10px', padding: '10px 24px', fontSize: '14px', textDecoration: 'none',
          }}>
            Go Home
          </Link>
          <Link to="/servers" style={{
            border: '1px solid var(--border-light)', color: 'var(--text-primary)',
            borderRadius: '10px', padding: '10px 24px', fontSize: '14px', textDecoration: 'none',
          }}>
            Your Servers
          </Link>
          <Link to="/docs/introduction" style={{
            border: '1px solid var(--border-light)', color: 'var(--text-primary)',
            borderRadius: '10px', padding: '10px 24px', fontSize: '14px', textDecoration: 'none',
          }}>
            Docs
          </Link>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
};
