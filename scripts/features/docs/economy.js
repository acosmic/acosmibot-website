// ===== ECONOMY DOCS FEATURE =====

console.log('economy.js loading...');

const EconomyDocsFeature = {
  state: {
    initialized: false,
    guildContext: null
  },

  async init(params = {}) {
    console.log('EconomyDocsFeature.init()');
    this.state.guildContext = window.DocsCore?.state?.currentGuildId || null;

    if (this.state.guildContext) {
      this.showConfigureButton();
    }

    this.state.initialized = true;
  },

  async cleanup() {
    console.log('EconomyDocsFeature.cleanup()');
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

window.EconomyDocsFeature = EconomyDocsFeature;
console.log('EconomyDocsFeature exported');
