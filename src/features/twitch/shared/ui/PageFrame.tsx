import React from 'react';
import { PublicNav } from '@/components/layout/PublicNav';
import '@/styles/dashboard.css';
import '../styles/twitch.css';

/**
 * Frame for Twitch pages outside the channel dashboard (landing, channel
 * picker, public channel pages): the site header and one centred 1080px
 * column on the dashboard canvas, so tokens, buttons and fields match.
 */
export const TwitchPageFrame: React.FC<{ children: React.ReactNode; className?: string; labelledBy?: string }> = ({ children, className, labelledBy }) => (
  <div className={`dashboard-shell twitch-page${className ? ` ${className}` : ''}`}>
    <PublicNav variant="observatory" />
    <main className="tw-page-main" aria-labelledby={labelledBy}>
      <div className="tw-page-main__inner">{children}</div>
    </main>
  </div>
);
