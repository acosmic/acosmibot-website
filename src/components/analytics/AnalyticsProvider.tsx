import React, { useEffect, useRef, useState } from 'react';
import { Cookie, ShieldCheck, X } from 'lucide-react';
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
  const [draftAnalytics, setDraftAnalytics] = useState(choice === 'granted');
  const preferencesTitleRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

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
    const openPreferences = () => {
      returnFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      setDraftAnalytics(choice === 'granted');
      setPreferencesOpen(true);
    };
    window.addEventListener(ANALYTICS_PREFERENCES_EVENT, openPreferences);
    return () => window.removeEventListener(ANALYTICS_PREFERENCES_EVENT, openPreferences);
  }, [choice]);

  useEffect(() => {
    if (preferencesOpen) preferencesTitleRef.current?.focus();
  }, [preferencesOpen]);

  useEffect(() => {
    if (!preferencesOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPreferencesOpen(false);
      window.requestAnimationFrame(() => returnFocusRef.current?.focus());
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [preferencesOpen]);

  const decide = (nextChoice: Exclude<AnalyticsConsent, null>) => {
    const shouldReload = choice === 'granted' && nextChoice === 'denied';
    writeAnalyticsConsent(nextChoice);
    setChoice(nextChoice);
    setPreferencesOpen(false);
    if (shouldReload) window.location.reload();
  };

  const visible = choice === null || preferencesOpen;

  const openPreferences = () => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setDraftAnalytics(choice === 'granted');
    setPreferencesOpen(true);
  };

  const closePreferences = () => {
    setPreferencesOpen(false);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  };

  return (
    <>
      {children}
      {visible && (
        <aside
          className={`analytics-consent${preferencesOpen ? ' analytics-consent--preferences' : ''}`}
          aria-labelledby="analytics-consent-title"
        >
          {!preferencesOpen ? (
            <>
              <div className="analytics-consent__signal" aria-hidden="true">
                <Cookie />
              </div>
              <div className="analytics-consent__copy">
                <span><ShieldCheck aria-hidden="true" /> Cookie choices</span>
                <h2 id="analytics-consent-title">Your privacy, your choice</h2>
                <p>
                  Required cookies keep Acosmibot secure. With your permission, optional analytics
                  cookies help us understand which sanitized page categories and product actions are useful.
                </p>
                <Link to="/privacy-policy">Privacy and cookie policy</Link>
              </div>
              <div className="analytics-consent__actions" aria-label="Cookie consent choices">
                <button type="button" className="analytics-consent__choice" onClick={() => decide('denied')}>
                  Reject non-essential
                </button>
                <button type="button" className="analytics-consent__manage" onClick={openPreferences}>
                  Manage choices
                </button>
                <button type="button" className="analytics-consent__choice" onClick={() => decide('granted')}>
                  Accept all
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="analytics-consent__copy analytics-consent__preferences-heading">
                <span><ShieldCheck aria-hidden="true" /> Cookie choices</span>
                <h2 id="analytics-consent-title" ref={preferencesTitleRef} tabIndex={-1}>Manage cookie choices</h2>
                <p>Required cookies are always active. Choose whether Acosmibot may use optional analytics cookies.</p>
              </div>

              <div className="analytics-consent__categories">
                <div className="analytics-consent__category">
                  <div>
                    <h3>Required</h3>
                    <p>Authentication, security, and your saved privacy choice.</p>
                  </div>
                  <span className="analytics-consent__required">Always active</span>
                </div>
                <div className="analytics-consent__category">
                  <div>
                    <h3>Analytics</h3>
                    <p>Sanitized Google Analytics page categories and product actions. No account or server identifiers.</p>
                  </div>
                  <label className="analytics-consent__switch">
                    <span className="analytics-consent__sr-only">Allow analytics cookies</span>
                    <input
                      type="checkbox"
                      checked={draftAnalytics}
                      onChange={(event) => setDraftAnalytics(event.target.checked)}
                    />
                    <span className="analytics-consent__switch-track" aria-hidden="true" />
                  </label>
                </div>
              </div>

              <div className="analytics-consent__actions analytics-consent__preference-actions">
                <button type="button" className="analytics-consent__choice" onClick={() => decide('denied')}>
                  Reject non-essential
                </button>
                <button
                  type="button"
                  className="analytics-consent__save"
                  onClick={() => decide(draftAnalytics ? 'granted' : 'denied')}
                >
                  Save choices
                </button>
                <button type="button" className="analytics-consent__choice" onClick={() => decide('granted')}>
                  Accept all
                </button>
              </div>
              <Link className="analytics-consent__policy" to="/privacy-policy">Privacy and cookie policy</Link>
            </>
          )}

          {preferencesOpen && (
            <button
              type="button"
              className="analytics-consent__close"
              onClick={closePreferences}
              aria-label={choice === null ? 'Back to cookie notice' : 'Close cookie preferences'}
            >
              <X aria-hidden="true" />
            </button>
          )}
        </aside>
      )}
    </>
  );
};
