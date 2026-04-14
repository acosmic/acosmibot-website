// ===== LEVELING DOCS FEATURE =====
// Documentation for leveling system

console.log('leveling.js loading...');

const LevelingDocsFeature = {
  state: {
    initialized: false,
    guildContext: null
  },

  async init(params = {}) {
    console.log('LevelingDocsFeature.init()');

    this.state.guildContext = window.DocsCore?.state?.currentGuildId || null;

    if (this.state.guildContext) {
      this.showConfigureButton();
    }

    this.state.initialized = true;
  },

  async cleanup() {
    console.log('LevelingDocsFeature.cleanup()');
    this.state.initialized = false;
    this.state.guildContext = null;
  },

  showConfigureButton() {
    const configBtn = document.getElementById('configureInServerBtn');
    if (configBtn) {
      configBtn.style.display = 'inline-flex';
      configBtn.onclick = () => {
        window.location.href = `/server/${this.state.guildContext}/leveling`;
      };
    }
  }
};

window.LevelingDocsFeature = LevelingDocsFeature;
console.log('LevelingDocsFeature exported');
