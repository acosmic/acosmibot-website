interface Window {
  __ACOSMIBOT_RUNTIME_CONFIG__?: Record<string, unknown>;
  AppConfig?: {
    environment?: 'production' | 'staging' | 'test' | 'development';
    siteOrigin?: string;
    apiBaseUrl?: string;
    originBaseUrl?: string;
    inviteUrl?: string | null;
    paymentUrl?: string | null;
    analyticsMeasurementId?: string | null;
    analyticsManualPageViewsReady?: boolean;
    statusUrl?: string;
    renderCardUrl?: string;
    cdnBaseUrl?: string;
  };
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}
