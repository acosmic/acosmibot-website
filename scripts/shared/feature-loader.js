// ===== FEATURE LOADER MODULE =====
// Dynamically loads and manages feature-specific JavaScript files

class FeatureLoader {
  constructor() {
    this.loadedFeatures = new Set();
    this.featureScripts = {};
    this.currentFeature = null;
  }

  // ===== SCRIPT LOADING =====
  async load(feature) {
    // Check if already loaded
    if (this.loadedFeatures.has(feature)) {
      console.log(`Feature ${feature} already loaded, reinitializing...`);
      await this.initFeature(feature);
      return true;
    }

    try {
      // Load the script
      await this.loadScript(feature);

      // Mark as loaded
      this.loadedFeatures.add(feature);

      // Initialize the feature
      await this.initFeature(feature);

      this.currentFeature = feature;
      return true;

    } catch (error) {
      console.error(`Feature loading error for ${feature}:`, error);
      return false;
    }
  }

  // ===== SCRIPT ELEMENT LOADING =====
  loadScript(feature) {
    return new Promise((resolve, reject) => {
      const scriptUrl = `/scripts/features/${feature}.js`;

      // Check if script is already in DOM
      const existingScript = document.querySelector(`script[src="${scriptUrl}"]`);
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;

      script.onload = () => {
        console.log(`Loaded script: ${scriptUrl}`);
        this.featureScripts[feature] = script;
        resolve();
      };

      script.onerror = () => {
        reject(new Error(`Failed to load script: ${scriptUrl}`));
      };

      document.body.appendChild(script);
    });
  }

  // ===== FEATURE INITIALIZATION =====
  async initFeature(feature) {
    // Look for feature module with init method
    const featureModuleName = this.getFeatureModuleName(feature);
    const featureModule = window[featureModuleName];

    if (featureModule && typeof featureModule.init === 'function') {
      try {
        await featureModule.init();
        console.log(`Initialized feature: ${feature}`);
      } catch (error) {
        console.error(`Feature init error for ${feature}:`, error);
        throw error;
      }
    } else {
      console.warn(`No init method found for feature: ${feature}`);
    }
  }

  // ===== FEATURE CLEANUP =====
  async unload(feature) {
    if (!this.loadedFeatures.has(feature)) {
      return;
    }

    // Look for feature module with cleanup method
    const featureModuleName = this.getFeatureModuleName(feature);
    const featureModule = window[featureModuleName];

    if (featureModule && typeof featureModule.cleanup === 'function') {
      try {
        await featureModule.cleanup();
        console.log(`Cleaned up feature: ${feature}`);
      } catch (error) {
        console.error(`Feature cleanup error for ${feature}:`, error);
      }
    }

    this.currentFeature = null;
  }

  // ===== UTILITY =====
  getFeatureModuleName(feature) {
    // Convert kebab-case to PascalCase + 'Feature'
    // Example: 'twitch' -> 'TwitchFeature'
    // Example: 'reaction-roles' -> 'ReactionRolesFeature'
    const pascalCase = feature
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');

    return `${pascalCase}Feature`;
  }

  isLoaded(feature) {
    return this.loadedFeatures.has(feature);
  }

  getCurrentFeature() {
    return this.currentFeature;
  }

  // ===== CLEANUP ALL =====
  async unloadAll() {
    for (const feature of this.loadedFeatures) {
      await this.unload(feature);
    }
  }
}

// Export as singleton
window.FeatureLoader = new FeatureLoader();
