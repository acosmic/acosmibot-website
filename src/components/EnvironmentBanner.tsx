import React, { useLayoutEffect, useRef } from 'react';
import { FlaskConical } from 'lucide-react';
import { isTestEnvironment } from '@/lib/runtimeConfig';
import '@/styles/environment-banner.css';

/** A persistent, text-first guard against confusing rehearsal traffic with production. */
export const EnvironmentBanner: React.FC = () => {
  const bannerRef = useRef<HTMLDivElement>(null);
  const enabled = isTestEnvironment();
  useLayoutEffect(() => {
    const banner = bannerRef.current;
    if (!enabled || !banner) return;
    const root = document.documentElement;
    const measure = () => root.style.setProperty('--environment-banner-height', `${banner.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(banner);
    root.dataset.testEnvironment = 'true';
    return () => {
      observer.disconnect();
      root.style.removeProperty('--environment-banner-height');
      delete root.dataset.testEnvironment;
    };
  }, [enabled]);
  if (!enabled) return null;
  return (
    <div ref={bannerRef} className="environment-banner" role="status" aria-label="Test environment">
      <FlaskConical aria-hidden="true" />
      <strong>TEST ENVIRONMENT</strong>
      <span>Isolated test data. No live payments or production analytics.</span>
    </div>
  );
};
