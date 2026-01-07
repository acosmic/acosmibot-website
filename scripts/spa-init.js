// ===== SPA INITIALIZATION =====
// Initializes the Single-Page Application on page load

// Wait for DOM to be ready before initializing
document.addEventListener('DOMContentLoaded', initSPA);

async function initSPA() {
  console.log('Initializing SPA...');

  // Verify required modules are loaded
  if (!window.ViewManager || !window.Router || !window.FeatureLoader || !window.DashboardCore) {
    console.error('Required modules not loaded. ViewManager:', !!window.ViewManager,
                  'Router:', !!window.Router, 'FeatureLoader:', !!window.FeatureLoader,
                  'DashboardCore:', !!window.DashboardCore);
    return;
  }

  // Check for redirect from 404.html
  const redirectPath = sessionStorage.getItem('spa_redirect');
  if (redirectPath) {
    console.log('Restoring path from 404 redirect:', redirectPath);
    sessionStorage.removeItem('spa_redirect');
    history.replaceState(null, '', redirectPath);
  }

  // Initialize view manager
  if (!ViewManager.init()) {
    console.error('Failed to initialize ViewManager');
    return;
  }

  // Initialize router
  const initialRoute = Router.init();

  if (!initialRoute) {
    console.error('Failed to parse initial route');
    // Fallback to default route
    Router.navigate('', 'twitch');
    return;
  }

  // Default to 'home' if no feature specified
  const feature = initialRoute.feature || 'home';
  console.log('Initial route:', initialRoute, '-> feature:', feature);

  try {
    // Debug: Check DashboardCore right before calling init
    console.log('About to call DashboardCore.init');
    console.log('DashboardCore:', DashboardCore);
    console.log('DashboardCore type:', typeof DashboardCore);
    console.log('DashboardCore.init:', DashboardCore.init);
    console.log('DashboardCore.init type:', typeof DashboardCore.init);
    console.log('window.DashboardCore:', window.DashboardCore);
    console.log('window.DashboardCore.init type:', typeof window.DashboardCore?.init);

    // Initialize DashboardCore with full init for first load
    await window.DashboardCore.init(feature);

    // Load initial view
    const viewLoaded = await ViewManager.loadView(feature);

    if (!viewLoaded) {
      console.error('Failed to load initial view');
      return;
    }

    console.log('SPA initialized successfully');

  } catch (error) {
    console.error('SPA initialization error:', error);
    ViewManager.showError('Failed to initialize dashboard. Please refresh the page.');
    return;
  }

  // Setup route change handler
  Router.onRouteChange(async (newRoute, oldRoute) => {
    console.log('Route change:', oldRoute, '->', newRoute);
    await handleRouteChange(newRoute, oldRoute);
  });
}

// ===== ROUTE CHANGE HANDLER =====
async function handleRouteChange(newRoute, oldRoute) {
  try {
    // Check for unsaved changes
    if (DashboardCore.state.hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Continue without saving?')) {
        // Revert navigation
        console.log('Navigation cancelled by user');
        Router.revert();
        return;
      }
      // Clear unsaved changes flag if user confirms
      DashboardCore.state.hasUnsavedChanges = false;
    }

    // Unload current view
    await ViewManager.unloadView();

    // Update DashboardCore state with new route
    // Use lighter SPA init since we're already initialized
    await DashboardCore.initForSPA(newRoute.feature);

    // Load new view
    const viewLoaded = await ViewManager.loadView(newRoute.feature);

    if (!viewLoaded) {
      console.error('Failed to load view for:', newRoute.feature);
      ViewManager.showError(`Failed to load ${newRoute.feature} view. Please try again.`);
    }

  } catch (error) {
    console.error('Route change error:', error);
    ViewManager.showError('Failed to navigate. Please refresh the page.');
  }
}
