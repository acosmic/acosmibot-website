// ===== INTRODUCTION DOCS FEATURE =====
// Landing page for documentation

console.log('introduction.js loading...');

const IntroductionDocsFeature = {
  state: {
    initialized: false,
    guildContext: null
  },

  async init(params = {}) {
    console.log('IntroductionDocsFeature.init()');

    // Get optional guild context
    this.state.guildContext = window.DocsCore?.state?.currentGuildId || null;

    // If guild context exists, show "Configure in /server" button
    if (this.state.guildContext) {
      this.showConfigureButton();
    }

    this.state.initialized = true;
  },

  async cleanup() {
    console.log('IntroductionDocsFeature.cleanup()');
    this.state.initialized = false;
    this.state.guildContext = null;
  },

  showConfigureButton() {
    const configBtn = document.getElementById('configureInServerBtn');
    if (configBtn) {
      configBtn.style.display = 'inline-flex';
      configBtn.onclick = () => {
        window.location.href = `/server/${this.state.guildContext}/overview`;
      };
    }
  }
};

// Export to window
window.IntroductionDocsFeature = IntroductionDocsFeature;
console.log('IntroductionDocsFeature exported:', window.IntroductionDocsFeature);
