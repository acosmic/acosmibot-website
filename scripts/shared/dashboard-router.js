// ===== DASHBOARD ROUTER MODULE =====
// Client-side routing with History API for SPA navigation

class DashboardRouter {
  constructor() {
    this.currentRoute = null;
    this.routeChangeCallbacks = [];
    this.isNavigating = false;
  }

  // ===== INITIALIZATION =====
  init() {
    // Set up popstate listener for browser back/forward
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.guildId && e.state.feature) {
        this.handleRouteChange(e.state.guildId, e.state.feature, false);
      } else {
        // Parse URL if no state
        const route = this.parseURL();
        if (route) {
          this.handleRouteChange(route.guildId, route.feature, false);
        }
      }
    });

    // Parse and store initial route
    this.currentRoute = this.parseURL();

    // Set initial history state if not already set
    if (this.currentRoute && !history.state) {
      history.replaceState({
        guildId: this.currentRoute.guildId,
        feature: this.currentRoute.feature
      }, '', window.location.pathname);
    }

    return this.currentRoute;
  }

  // ===== URL PARSING =====
  parseURL(url = window.location.pathname) {
    // Parse /server/{guild_id}/{feature} pattern
    const pathParts = url.split('/').filter(p => p);

    if (pathParts[0] === 'server' && pathParts[1]) {
      const guildId = pathParts[1];
      const feature = pathParts[2] || 'twitch'; // Default to twitch

      return {
        guildId,
        feature,
        path: `/server/${guildId}/${feature}`
      };
    }

    return null;
  }

  // ===== NAVIGATION =====
  navigate(guildId, feature) {
    if (this.isNavigating) {
      console.log('Navigation already in progress');
      return;
    }

    // Check if we're already at this route
    if (this.currentRoute &&
        this.currentRoute.guildId === guildId &&
        this.currentRoute.feature === feature) {
      console.log('Already at this route');
      return;
    }

    const path = `/server/${guildId}/${feature}`;

    // Push new state to history
    history.pushState({ guildId, feature }, '', path);

    // Handle the route change
    this.handleRouteChange(guildId, feature, true);
  }

  // ===== ROUTE CHANGE HANDLING =====
  async handleRouteChange(guildId, feature, isPush) {
    if (this.isNavigating) return;

    this.isNavigating = true;

    const oldRoute = this.currentRoute;
    const newRoute = {
      guildId,
      feature,
      path: `/server/${guildId}/${feature}`
    };

    this.currentRoute = newRoute;

    // Notify all listeners
    for (const callback of this.routeChangeCallbacks) {
      try {
        await callback(newRoute, oldRoute);
      } catch (error) {
        console.error('Route change callback error:', error);
      }
    }

    this.isNavigating = false;
  }

  // ===== EVENT SUBSCRIPTION =====
  onRouteChange(callback) {
    if (typeof callback === 'function') {
      this.routeChangeCallbacks.push(callback);
    }
  }

  // ===== UTILITY =====
  getCurrentRoute() {
    return this.currentRoute;
  }

  revert() {
    // Revert to previous history state
    history.back();
  }
}

// Export as singleton
window.Router = new DashboardRouter();
