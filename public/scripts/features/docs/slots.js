const SlotsDocsFeature = {
  state: { initialized: false, guildContext: null },
  async init() {
    this.state.guildContext = window.DocsCore?.state?.currentGuildId;
    if (this.state.guildContext) {
      const btn = document.getElementById('configureInServerBtn');
      if (btn) {
        btn.style.display = 'inline-flex';
        btn.onclick = () => window.location.href = `/server/${this.state.guildContext}/slots`;
      }
    }
    this.state.initialized = true;
  },
  async cleanup() { this.state.initialized = false; }
};
window.SlotsDocsFeature = SlotsDocsFeature;
