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
    } else if (pathParts[0] === 'docs' && !pathParts[1]) {
      // /docs without section - redirect to introduction
      section = 'introduction';
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
    const viewContainer = document.getElementById('view-container');
    if (!viewContainer) {
      console.error('View container not found');
      return;
    }

    // Map section names to view files
    const viewPath = `/docs/views/${section}-view.html`;

    try {
      const response = await fetch(viewPath);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      viewContainer.innerHTML = html;

    } catch (error) {
      console.error(`Failed to load view for section: ${section}`, error);
      viewContainer.innerHTML = `
        <div class="docs-page-container">
          <div class="error-view" style="text-align: center; padding: 60px 20px;">
            <h1 style="color: var(--text-primary); margin-bottom: 16px;">Page Not Found</h1>
            <p style="color: var(--text-secondary); margin-bottom: 24px;">The documentation page "${section}" doesn't exist yet.</p>
            <button class="btn-configure" onclick="window.DocsRouter.navigate('introduction')">Go to Introduction</button>
          </div>
        </div>
      `;
    }
  }

  async loadFeature(section) {
    // Load feature module if it exists
    const featurePath = `/scripts/features/docs/${section}.js`;

    try {
      // Check if module already loaded
      const featureName = `${this.capitalize(section)}DocsFeature`;
      if (window[featureName]) {
        // Initialize existing module
        if (window[featureName].init) {
          await window[featureName].init();
        }
        return;
      }

      // Dynamically load the script
      const script = document.createElement('script');
      script.src = featurePath;
      script.async = true;

      await new Promise((resolve, reject) => {
        script.onload = () => {
          console.log(`Loaded feature module: ${featurePath}`);
          resolve();
        };
        script.onerror = () => {
          // Not critical if module doesn't exist
          console.log(`No feature module for section: ${section}`);
          resolve();
        };
        document.head.appendChild(script);
      });

      // Initialize the feature if it was loaded
      if (window[featureName] && window[featureName].init) {
        await window[featureName].init();
      }

    } catch (error) {
      console.warn(`Error loading feature module for ${section}:`, error);
      // Not critical, continue anyway
    }
  }

  capitalize(str) {
    return str.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
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
