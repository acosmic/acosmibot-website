// Runtime configuration is injected by the container adapter when it serves
// this file. Azure Static Web Apps continues to use the production defaults.
// A test deployment is identified by the injected environment and never
// receives a production endpoint implicitly.
window.AppConfig = (function() {
    const host = window.location.hostname;
    const local = host === 'localhost' || host === '127.0.0.1';
    const injected = window.__ACOSMIBOT_RUNTIME_CONFIG__ || {};
    const environment = injected.environment || (local ? 'development' : 'production');
    const configured = (key, fallback) => Object.prototype.hasOwnProperty.call(injected, key)
        ? injected[key]
        : fallback;
    const production = environment !== 'test' && environment !== 'staging';
    return {
        environment,
        siteOrigin: configured('siteOrigin', production ? 'https://acosmibot.com' : window.location.origin),
        apiBaseUrl: configured('apiBaseUrl', production ? (local ? 'http://localhost:5000' : 'https://api.acosmibot.com') : undefined),
        originBaseUrl: configured('originBaseUrl', production ? window.location.origin : undefined),
        inviteUrl: configured('inviteUrl', production ? 'https://discord.com/oauth2/authorize?client_id=1186802023799214223&permissions=8&integration_type=0&scope=bot' : null),
        paymentUrl: configured('paymentUrl', production ? 'https://donate.stripe.com/bJe3co1sfayvcMD16xgnK00' : null),
        analyticsMeasurementId: configured('analyticsMeasurementId', production && !local ? 'G-7PFS5W20SN' : null),
        analyticsManualPageViewsReady: configured('analyticsManualPageViewsReady', production),
        statusUrl: configured('statusUrl', production ? '/api/status' : undefined),
        renderCardUrl: configured('renderCardUrl', production ? ((local ? 'http://localhost:5000' : 'https://api.acosmibot.com') + '/api/render-card') : undefined),
        cdnBaseUrl: configured('cdnBaseUrl', production ? 'https://cdn.acosmibot.com' : undefined),
    };
})();
