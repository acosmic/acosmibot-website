import React from 'react';

const SUPPORT_URL = 'https://discord.gg/hrj7WhCyEv';

/**
 * Slim footer for the public pages (profile, leaderboard, servers, etc.).
 * Terms and Privacy are static HTML pages outside the SPA, so plain anchors.
 */
export const SiteFooter: React.FC = () => (
  <footer style={{
    borderTop: '1px solid var(--border-light)',
    padding: '20px 24px',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px 16px',
    fontSize: '13px',
    color: 'var(--text-muted)',
  }}>
    <span>© {new Date().getFullYear()} Acosmibot</span>
    <FooterLink href="/terms-of-service">Terms</FooterLink>
    <FooterLink href="/privacy-policy">Privacy</FooterLink>
    <FooterLink href={SUPPORT_URL} external>Support Discord</FooterLink>
  </footer>
);

const FooterLink: React.FC<{ href: string; external?: boolean; children: React.ReactNode }> = ({ href, external, children }) => (
  <a
    href={href}
    {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
  >
    {children}
  </a>
);
