import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { clearExpiredSession } from '@/lib/auth';
import '@/styles/admin.css';

/**
 * Route gate for owner pages (/admin and everything under it). The API enforces the same
 * rule on every admin route; this only keeps the pages from rendering for anyone else.
 */
export const RequireSuperAdmin: React.FC = () => {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const apiBase = (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';
    fetch(`${apiBase}/api/admin/check`, { credentials: 'include' })
      .then(r => {
        if (r.status === 401) clearExpiredSession();
        return r.json();
      })
      .then(d => {
        // The panel and every /api/admin route require super-admin; a plain
        // 'admin' row (or anyone else) is bounced here too.
        if (!d.is_super_admin) navigate('/');
        else setAuthChecked(true);
      })
      .catch(() => navigate('/'));
  }, [navigate]);

  if (!authChecked) {
    return (
      <div className="admin-access-check" role="status" aria-live="polite">
        <div className="admin-access-check__orbit" aria-hidden="true">
          <span /><span />
          <img src="/images/acosmibot-logo.png" alt="" />
        </div>
        <div>
          <span><LockKeyhole aria-hidden="true" /> Owner boundary</span>
          <strong>Verifying control access…</strong>
        </div>
      </div>
    );
  }

  return <Outlet />;
};
