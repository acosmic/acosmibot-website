import React from 'react';
import { ProfileNav } from '@/components/profile/ProfileNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { useAuthStore } from '@/store/auth';
import { useHydrateAuthUser } from '@/lib/auth';

/** Shared shell + typography for the Terms / Privacy pages. */
export const LegalLayout: React.FC<{
  title: string;
  subtitle: string;
  lastUpdated: string;
  children: React.ReactNode;
}> = ({ title, subtitle, lastUpdated, children }) => {
  const user = useAuthStore((s) => s.user);
  useHydrateAuthUser();

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ProfileNav user={user} />
      <main style={{ flex: 1, padding: '40px 24px', maxWidth: '860px', margin: '0 auto', width: '100%' }}>
        <header style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{title}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: '8px 0 0' }}>{subtitle}</p>
        </header>
        <div className="legal-content" style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7 }}>
          {children}
        </div>
        <div style={{ marginTop: '32px', fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Last Updated: {lastUpdated}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export const LegalSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section style={{
    background: 'var(--bg-card)', border: '1px solid var(--border-light)',
    borderRadius: '14px', padding: '22px 24px', marginBottom: '16px',
  }}>
    <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>{title}</h2>
    {children}
  </section>
);

export const LegalSubheading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '16px 0 8px' }}>{children}</h3>
);

export const HighlightBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    background: 'rgba(0,217,255,0.06)', border: '1px solid var(--border-cyan)',
    borderRadius: '10px', padding: '12px 16px', margin: '12px 0 0',
  }}>
    {children}
  </div>
);
