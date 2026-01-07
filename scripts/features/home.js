// ===== DASHBOARD HOME FEATURE =====
// Landing page for the server dashboard

const HomeFeature = {
  async init() {
    console.log('Home feature initialized');
    // Initialize shared core for SPA
    if (window.Router) {
      await DashboardCore.initForSPA('home');
    } else {
      await DashboardCore.init('home');
    }
  },

  async cleanup() {
    console.log('Home feature cleanup');
    // No cleanup needed for home
  }
};

// Export feature module for SPA
window.HomeFeature = HomeFeature;
