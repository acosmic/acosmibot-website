// ===== QUICK START DOCS FEATURE =====

console.log('quick-start.js loading...');

const QuickStartDocsFeature = {
  state: {
    initialized: false,
    guildContext: null
  },

  async init(params = {}) {
    console.log('QuickStartDocsFeature.init()');
    this.state.guildContext = window.DocsCore?.state?.currentGuildId || null;
    this.state.initialized = true;
  },

  async cleanup() {
    console.log('QuickStartDocsFeature.cleanup()');
    this.state.initialized = false;
    this.state.guildContext = null;
  }
};

window.QuickStartDocsFeature = QuickStartDocsFeature;
console.log('QuickStartDocsFeature exported');
