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
        this.handleRouteChange(e.state.guildId, e.state.feature, e.state.subRoute || null, false);
      } else {
        // Parse URL if no state
        const route = this.parseURL();
        if (route) {
          this.handleRouteChange(route.guildId, route.feature, route.subRoute || null, false);
        }
      }
    });

    // Parse and store initial route
    this.currentRoute = this.parseURL();

    // Set initial history state if not already set
    if (this.currentRoute && !history.state) {
      history.replaceState({
        guildId: this.currentRoute.guildId,
        feature: this.currentRoute.feature,
        subRoute: this.currentRoute.subRoute || null
      }, '', window.location.pathname);
    }

    return this.currentRoute;
  }

  // ===== URL PARSING =====
  parseURL(url = window.location.pathname) {
    // Parse /server/{guild_id}/{feature}/{sub_route} pattern
    const pathParts = url.split('/').filter(p => p);

    if (pathParts[0] === 'server' && pathParts[1]) {
      const guildId = pathParts[1];
      // Feature is optional - null means show dashboard home/landing
      const feature = pathParts[2] || null;

      // Parse sub-routes (e.g., embeds/new, embeds/edit/123)
      let subRoute = null;
      let params = {};

      if (pathParts.length > 3) {
        // Reconstruct sub-route from remaining parts
        subRoute = pathParts.slice(3).join('/');

        // Extract parameters for specific patterns
        if (feature === 'embeds') {
          if (pathParts[3] === 'edit' && pathParts[4]) {
            params.embedId = pathParts[4];
          }
        }
      }

      return {
        guildId,
        feature,
        subRoute,
        params,
        path: feature ? `/server/${guildId}/${feature}${subRoute ? '/' + subRoute : ''}` : `/server/${guildId}`
      };
    }

    return null;
  }

  // ===== NAVIGATION =====
  navigate(guildId, feature, subRoute = null) {
    if (this.isNavigating) {
      console.log('Navigation already in progress');
      return;
    }

    // Check if we're already at this route
    if (this.currentRoute &&
        this.currentRoute.guildId === guildId &&
        this.currentRoute.feature === feature &&
        this.currentRoute.subRoute === subRoute) {
      console.log('Already at this route');
      return;
    }

    const path = `/server/${guildId}/${feature}${subRoute ? '/' + subRoute : ''}`;

    // Push new state to history
    history.pushState({ guildId, feature, subRoute }, '', path);

    // Handle the route change
    this.handleRouteChange(guildId, feature, subRoute, true);
  }

  // ===== ROUTE CHANGE HANDLING =====
  async handleRouteChange(guildId, feature, subRoute, isPush) {
    if (this.isNavigating) return;

    this.isNavigating = true;

    const oldRoute = this.currentRoute;

    // Parse full route to get params
    const parsedRoute = this.parseURL(`/server/${guildId}/${feature}${subRoute ? '/' + subRoute : ''}`);

    const newRoute = {
      guildId,
      feature,
      subRoute: subRoute || null,
      params: parsedRoute?.params || {},
      path: `/server/${guildId}/${feature}${subRoute ? '/' + subRoute : ''}`
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
