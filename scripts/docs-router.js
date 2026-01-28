// ===== DOCS ROUTER MODULE =====
// Handles routing for documentation SPA
// URL Pattern: /docs/{section}?guild={guildId}

console.log('docs-router.js loading...');

class DocsRouter {
  constructor() {
    this.currentSection = null;
    this.currentGuildId = null;
    this.isNavigating = false;
  }

  init() {
    console.log('DocsRouter.init() called');

    // Parse initial URL
    const { section, guildId } = this.parseURL();
    this.currentSection = section;
    this.currentGuildId = guildId;

    // Setup popstate listener for browser back/forward
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.section) {
        this.loadSection(e.state.section, e.state.guildId, false); // false = don't push state
      } else {
        // Fallback: parse URL
        const { section, guildId } = this.parseURL();
        this.loadSection(section, guildId, false);
      }
    });

    // Load initial section
    this.loadSection(section, guildId, true);
  }

  parseURL(url = window.location.pathname) {
    const pathParts = url.split('/').filter(p => p);

    // Expected format: /docs/{section}
    let section = 'introduction'; // default
    if (pathParts[0] === 'docs' && pathParts[1]) {
      section = pathParts[1];
    }

    // Parse query params for guild context
    const urlParams = new URLSearchParams(window.location.search);
    const guildId = urlParams.get('guild') || null;

    return { section, guildId };
  }

  async loadSection(section, guildId = null, pushState = true) {
    if (this.isNavigating) return;
    this.isNavigating = true;

    try {
      console.log(`Loading section: ${section}, guildId: ${guildId}`);

      // Update current state
      this.currentSection = section;
      this.currentGuildId = guildId;

      // Update URL if needed
      if (pushState) {
        const url = guildId ? `/docs/${section}?guild=${guildId}` : `/docs/${section}`;
        window.history.pushState({ section, guildId }, '', url);
      }

      // Update DocsCore state
      if (window.DocsCore) {
        await window.DocsCore.initForSPA(section);
      }

      // Load view
      await this.loadView(section);

      // Load feature module
      await this.loadFeature(section);

    } catch (error) {
      console.error('Error loading section:', error);
      this.showError('Failed to load documentation section');
    } finally {
      this.isNavigating = false;
    }
  }

  async loadView(section) {
    if (!window.ViewManager) {
      console.error('ViewManager not loaded');
      return;
    }

    // Map section names to view files
    const viewPath = this.getViewPath(section);

    try {
      await window.ViewManager.loadView(viewPath);
    } catch (error) {
      console.error(`Failed to load view for section: ${section}`, error);
      // Fallback to 404 or error view
      await window.ViewManager.loadView('/docs/views/error-view.html');
    }
  }

  getViewPath(section) {
    // Map section names to view file paths
    return `/docs/views/${section}-view.html`;
  }

  async loadFeature(section) {
    if (!window.FeatureLoader) {
      console.error('FeatureLoader not loaded');
      return;
    }

    // Map section names to feature module paths
    const featurePath = this.getFeaturePath(section);

    try {
      await window.FeatureLoader.loadFeature(featurePath, section);
    } catch (error) {
      console.warn(`No feature module for section: ${section}`, error);
      // Not all sections need feature modules, so this is not critical
    }
  }

  getFeaturePath(section) {
    // Map section names to feature module paths
    return `/scripts/features/docs/${section}.js`;
  }

  navigate(section, guildId = null) {
    this.loadSection(section, guildId, true);
  }

  showError(message) {
    console.error(message);
    const container = document.getElementById('view-container');
    if (container) {
      container.innerHTML = `
        <div class="error-view">
          <h1>Error</h1>
          <p>${message}</p>
          <button onclick="window.DocsRouter.navigate('introduction')">Go to Home</button>
        </div>
      `;
    }
  }
}

// Export as singleton
window.DocsRouter = new DocsRouter();
console.log('DocsRouter exported:', window.DocsRouter);
