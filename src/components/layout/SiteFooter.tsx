import React from 'react';
import { Link } from 'react-router-dom';
import { COMPANY_BRAND, SUPPORT_DISCORD_URL as SUPPORT_URL, SUPPORT_EMAIL_HREF } from '@/lib/company';
import { openAnalyticsPreferences } from '@/lib/analytics';

/** Slim footer for the public pages (profile, leaderboard, servers, etc.). */
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
    <span>© {new Date().getFullYear()} {COMPANY_BRAND}</span>
    <FooterLink href="/terms-of-service">Terms</FooterLink>
    <FooterLink href="/privacy-policy">Privacy</FooterLink>
    <button
      type="button"
      onClick={openAnalyticsPreferences}
      style={{
        minHeight: '44px',
        display: 'inline-flex',
        alignItems: 'center',
        padding: '8px 0',
        border: 0,
        background: 'transparent',
        color: 'var(--text-secondary)',
        font: 'inherit',
        cursor: 'pointer',
      }}
    >
      Cookie choices
    </button>
    <FooterLink href={SUPPORT_URL} external>Support Discord</FooterLink>
    <FooterLink href={SUPPORT_EMAIL_HREF} external>Email support</FooterLink>
  </footer>
);

const FooterLink: React.FC<{ href: string; external?: boolean; children: React.ReactNode }> = ({ href, external, children }) => {
  const style = {
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 0',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
  };
  if (external) {
    return <a href={href} target="_blank" rel="noreferrer" style={style}>{children}</a>;
  }
  return <Link to={href} style={style}>{children}</Link>;
};
