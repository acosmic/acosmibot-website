import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Radio } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { StreamAlertsPanel } from './StreamAlertsPanel';
import '@/styles/admin.css';

/** /admin/stream-alerts: the stream alert dashboard on its own page (it used to be an admin tab). */
export const StreamAlertsPage: React.FC = () => (
  <div className="admin-page stream-alerts-page">
    <PublicNav variant="observatory" />

    <main className="admin-main">
      <header className="admin-header">
        <div>
          <p className="admin-kicker">Stream tools</p>
          <h1>Stream alerts.</h1>
          <p>Test, preview and control the alerts and channel point effects that play in OBS.</p>
        </div>
        <div className="admin-header__status">
          <span className="admin-header__lock"><Radio aria-hidden="true" /></span>
          <div>
            <strong>Super admins only</strong>
            <span><Link className="stream-alerts-page__back" to="/admin"><ArrowLeft aria-hidden="true" /> Back to admin</Link></span>
          </div>
        </div>
      </header>

      <div className="admin-surface">
        <StreamAlertsPanel />
      </div>
    </main>
  </div>
);
