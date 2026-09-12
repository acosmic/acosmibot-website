import React from 'react';
import { FlaskConical } from 'lucide-react';
import { isTestEnvironment } from '@/lib/runtimeConfig';
import '@/styles/environment-banner.css';

/** A persistent, text-first guard against confusing rehearsal traffic with production. */
export const EnvironmentBanner: React.FC = () => {
  if (!isTestEnvironment()) return null;
  return (
    <div className="environment-banner" role="status" aria-label="Test environment">
      <FlaskConical aria-hidden="true" />
      <strong>TEST ENVIRONMENT</strong>
      <span>Production analytics, invitations, and payments are disabled.</span>
    </div>
  );
};
