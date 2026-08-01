// Environment-aware API configuration
// Must be loaded before any other scripts that use API_BASE_URL
window.AppConfig = (function() {
    const host = window.location.hostname;
    let apiBaseUrl;
    if (host === 'localhost' || host === '127.0.0.1') {
        apiBaseUrl = 'http://localhost:5000';
    } else {
        apiBaseUrl = 'https://api.acosmibot.com';
    }
    const analyticsMeasurementId = host === 'localhost' || host === '127.0.0.1'
        ? null
        : 'G-7PFS5W20SN';
    // Fail closed until the GA4 stream has automatic browser-history page views
    // disabled. The SPA sends its own sanitized page locations after consent.
    const analyticsManualPageViewsReady = true;
    return { apiBaseUrl, analyticsMeasurementId, analyticsManualPageViewsReady };
})();
