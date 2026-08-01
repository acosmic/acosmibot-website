import React, { useEffect, useState } from 'react';
import { BarChart3, ShieldCheck, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  ANALYTICS_PREFERENCES_EVENT,
  initializeAnalytics,
  readAnalyticsConsent,
  resolveAnalyticsPage,
  trackEvent,
  trackPageView,
  writeAnalyticsConsent,
  type AnalyticsConsent,
} from '@/lib/analytics';
import '@/styles/analytics-consent.css';

export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const [choice, setChoice] = useState<AnalyticsConsent>(() => readAnalyticsConsent());
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const page = resolveAnalyticsPage(pathname);
    document.title = page.title;
    if (choice === 'granted') {
      initializeAnalytics();
      trackPageView(page);
      if (page.track) {
        try {
          if (sessionStorage.getItem('acosmibot_login_complete') === '1') {
            sessionStorage.removeItem('acosmibot_login_complete');
            trackEvent('login', { method: 'discord' });
          }
        } catch { /* optional analytics event */ }
      }
    }
  }, [choice, pathname]);

  useEffect(() => {
    const openPreferences = () => setPreferencesOpen(true);
    window.addEventListener(ANALYTICS_PREFERENCES_EVENT, openPreferences);
    return () => window.removeEventListener(ANALYTICS_PREFERENCES_EVENT, openPreferences);
  }, []);

  const decide = (nextChoice: Exclude<AnalyticsConsent, null>) => {
    const shouldReload = choice === 'granted' && nextChoice === 'denied';
    writeAnalyticsConsent(nextChoice);
    setChoice(nextChoice);
    setPreferencesOpen(false);
    if (shouldReload) window.location.reload();
  };

  const visible = choice === null || preferencesOpen;

  return (
    <>
      {children}
      {visible && (
        <aside className="analytics-consent" aria-labelledby="analytics-consent-title">
          <div className="analytics-consent__signal" aria-hidden="true">
            <BarChart3 />
          </div>
          <div className="analytics-consent__copy">
            <span><ShieldCheck aria-hidden="true" /> Privacy control</span>
            <h2 id="analytics-consent-title">
              {preferencesOpen ? 'Analytics preferences' : 'Help improve Acosmibot'}
            </h2>
            <p>
              Optional Google Analytics measures sanitized page categories and product actions.
              We never send Discord IDs, server IDs, usernames, form content, or authentication credentials.
            </p>
            <Link to="/privacy-policy">Read the privacy policy</Link>
          </div>
          <div className="analytics-consent__actions">
            <button type="button" className="analytics-consent__accept" onClick={() => decide('granted')}>
              Allow analytics
            </button>
            <button type="button" className="analytics-consent__decline" onClick={() => decide('denied')}>
              Decline
            </button>
          </div>
          {preferencesOpen && choice !== null && (
            <button
              type="button"
              className="analytics-consent__close"
              onClick={() => setPreferencesOpen(false)}
              aria-label="Close analytics preferences"
            >
              <X aria-hidden="true" />
            </button>
          )}
        </aside>
      )}
    </>
  );
};
