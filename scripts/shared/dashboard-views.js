// ===== DASHBOARD VIEW MANAGER MODULE =====
// Dynamically loads and renders feature view templates

console.log('dashboard-views.js loading...');

class DashboardViewManager {
  constructor() {
    this.viewContainer = null;
    this.templateCache = {};
    this.currentView = null;
    this.isLoading = false;
  }

  // ===== INITIALIZATION =====
  init() {
    this.viewContainer = document.getElementById('view-container');
    if (!this.viewContainer) {
      console.error('View container #view-container not found');
      return false;
    }
    return true;
  }

  // ===== VIEW LOADING =====
  async loadView(feature, routeParams = {}) {
    if (this.isLoading) {
      console.log('View loading already in progress');
      return false;
    }

    this.isLoading = true;

    try {
      // Get template HTML
      const html = await this.getTemplate(feature);

      if (!html) {
        throw new Error(`Failed to load template for ${feature}`);
      }

      // Render the view
      this.renderView(html);

      // Load feature-specific script with route parameters
      // routeParams includes: subRoute, params (embedId, etc.), feature, guildId
      await window.FeatureLoader.load(feature, routeParams);

      this.currentView = feature;
      this.isLoading = false;
      return true;

    } catch (error) {
      console.error('View loading error:', error);
      this.showError(`Failed to load ${feature} view`);
      this.isLoading = false;
      return false;
    }
  }

  // ===== TEMPLATE FETCHING =====
  async getTemplate(feature) {
    // Check cache first
    if (this.templateCache[feature]) {
      return this.templateCache[feature];
    }

    try {
      const response = await fetch(`/server/views/${feature}-view.html`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();

      // Cache the template
      this.templateCache[feature] = html;

      return html;

    } catch (error) {
      console.error(`Template fetch error for ${feature}:`, error);
      return null;
    }
  }

  // ===== VIEW RENDERING =====
  renderView(html) {
    if (!this.viewContainer) {
      console.error('View container not initialized');
      return;
    }

    // Inject HTML into container
    this.viewContainer.innerHTML = html;
  }

  // ===== VIEW CLEANUP =====
  async unloadView() {
    if (!this.currentView) return;

    try {
      // Cleanup feature-specific resources
      await window.FeatureLoader.unload(this.currentView);

      // Clear view container
      if (this.viewContainer) {
        this.viewContainer.innerHTML = '';
      }

      this.currentView = null;

    } catch (error) {
      console.error('View unload error:', error);
    }
  }

  // ===== TEMPLATE PRELOADING =====
  async preloadViews(features) {
    const promises = features.map(feature => this.getTemplate(feature));
    await Promise.all(promises);
    console.log(`Preloaded ${features.length} view templates`);
  }

  // ===== UTILITY =====
  showError(message) {
    if (this.viewContainer) {
      this.viewContainer.innerHTML = `
        <div class="view-error">
          <h2>Error Loading View</h2>
          <p>${message}</p>
          <button onclick="location.reload()">Reload Page</button>
        </div>
      `;
    }
  }

  clearCache() {
    this.templateCache = {};
  }

  getCurrentView() {
    return this.currentView;
  }
}

// Export as singleton
window.ViewManager = new DashboardViewManager();
console.log('ViewManager exported:', window.ViewManager);
console.log('ViewManager.init type:', typeof window.ViewManager.init);
