import React from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Placeholder dashboard page for features that aren't built yet
 * (jail, lottery, portals). Mirrors the legacy coming-soon view.
 */
export const ComingSoonPage: React.FC<{
  title: string;
  description: string;
  icon: LucideIcon;
  detail: string;
}> = ({ title, description, icon: Icon, detail }) => (
  <>
    <header className="dashboard-header">
      <div className="header-left">
        <h1>{title}</h1>
        <p className="feature-description">{description}</p>
      </div>
    </header>

    <div className="feature-container">
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '60px 20px', minHeight: '400px',
      }}>
        <div className="coming-soon-bounce" style={{ color: 'var(--primary-color)', marginBottom: '24px' }}>
          <Icon size={72} />
        </div>
        <h2 style={{ fontSize: '28px', color: 'var(--text-primary)', marginBottom: '12px' }}>Coming Soon</h2>
        <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
          We're working hard to bring you this feature. Check back soon!
        </p>
        <div style={{
          background: 'rgba(0, 217, 255, 0.1)', border: '1px solid rgba(0, 217, 255, 0.3)',
          borderRadius: '12px', padding: '20px 30px', maxWidth: '520px',
        }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px', lineHeight: 1.6 }}>
            {detail}
          </p>
        </div>
      </div>
    </div>
  </>
);
