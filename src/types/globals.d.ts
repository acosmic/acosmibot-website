interface Window {
  AppConfig?: {
    apiBaseUrl?: string;
    analyticsMeasurementId?: string | null;
    analyticsManualPageViewsReady?: boolean;
  };
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}
