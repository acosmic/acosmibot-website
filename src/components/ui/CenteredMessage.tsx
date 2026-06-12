import React from 'react';

/** Centered icon + title (+ optional subtitle) for loading/error/empty states. */
export const CenteredMessage: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}> = ({ icon, title, subtitle }) => (
  <div style={{ textAlign: 'center', padding: '80px 20px' }}>
    <div style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>{icon}</div>
    <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>{title}</h2>
    {subtitle && <p style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
  </div>
);
