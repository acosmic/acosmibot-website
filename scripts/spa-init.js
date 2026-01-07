// ===== SPA INITIALIZATION =====
// Initializes the Single-Page Application on page load

// Wait for DOM to be ready before initializing
document.addEventListener('DOMContentLoaded', initSPA);

async function initSPA() {
  console.log('Initializing SPA...');

  // Get module references from window (avoids class vs instance confusion)
  const { ViewManager, Router, FeatureLoader, DashboardCore } = window;

  // Verify required modules are loaded
  if (!ViewManager || !Router || !FeatureLoader || !DashboardCore) {
    console.error('Required modules not loaded. ViewManager:', !!ViewManager,
                  'Router:', !!Router, 'FeatureLoader:', !!FeatureLoader,
                  'DashboardCore:', !!DashboardCore);
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
    // Initialize DashboardCore with full init for first load
    await DashboardCore.init(feature);

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

  // Setup route change handler (pass module references)
  Router.onRouteChange(async (newRoute, oldRoute) => {
    console.log('Route change:', oldRoute, '->', newRoute);
    await handleRouteChange(newRoute, oldRoute, { ViewManager, Router, DashboardCore });
  });
}

// ===== ROUTE CHANGE HANDLER =====
async function handleRouteChange(newRoute, oldRoute, { ViewManager, Router, DashboardCore }) {
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

    // Default to 'home' if no feature specified
    const feature = newRoute.feature || 'home';

    // Update DashboardCore state with new route
    // Use lighter SPA init since we're already initialized
    await DashboardCore.initForSPA(feature);

    // Load new view
    const viewLoaded = await ViewManager.loadView(feature);

    if (!viewLoaded) {
      console.error('Failed to load view for:', feature);
      ViewManager.showError(`Failed to load ${feature} view. Please try again.`);
    }

  } catch (error) {
    console.error('Route change error:', error);
    ViewManager.showError('Failed to navigate. Please refresh the page.');
  }
}
