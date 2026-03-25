// Environment-aware API configuration
// Must be loaded before any other scripts that use API_BASE_URL
const AppConfig = (function() {
    const host = window.location.hostname;
    let apiBaseUrl;
    if (host === 'localhost' || host === '127.0.0.1') {
        apiBaseUrl = 'http://localhost:5000';
    } else {
        apiBaseUrl = 'https://api.acosmibot.com';
    }
    return { apiBaseUrl };
})();
