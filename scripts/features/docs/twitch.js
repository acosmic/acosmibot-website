// ===== TWITCH DOCS FEATURE =====

console.log('twitch.js loading...');

const TwitchDocsFeature = {
  state: {
    initialized: false,
    guildContext: null
  },

  async init(params = {}) {
    console.log('TwitchDocsFeature.init()');
    this.state.guildContext = window.DocsCore?.state?.currentGuildId || null;

    if (this.state.guildContext) {
      this.showConfigureButton();
    }

    this.state.initialized = true;
  },

  async cleanup() {
    console.log('TwitchDocsFeature.cleanup()');
    this.state.initialized = false;
    this.state.guildContext = null;
  },

  showConfigureButton() {
    const configBtn = document.getElementById('configureInServerBtn');
    if (configBtn) {
      configBtn.style.display = 'inline-flex';
      configBtn.onclick = () => {
        window.location.href = `/server/${this.state.guildContext}/twitch`;
      };
    }
  }
};

window.TwitchDocsFeature = TwitchDocsFeature;
console.log('TwitchDocsFeature exported');
