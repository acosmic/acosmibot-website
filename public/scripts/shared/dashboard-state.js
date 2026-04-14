// ===== DASHBOARD STATE MANAGEMENT =====
// Pub/Sub pattern for cross-component state updates

class DashboardState {
  constructor() {
    this.listeners = new Map();
  }

  // Get current guild config (cached in DashboardCore)
  getGuildConfig() {
    return window.DashboardCore?.state?.guildConfig || null;
  }

  // Update guild config and notify listeners
  updateGuildConfig(updates) {
    if (!window.DashboardCore) {
      console.error('DashboardCore not initialized');
      return;
    }

    window.DashboardCore.state.guildConfig = {
      ...window.DashboardCore.state.guildConfig,
      ...updates
    };

    window.DashboardCore.markUnsavedChanges();
    this.notifyListeners('config-changed');
  }

  // Subscribe to state changes
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // Unsubscribe from state changes
  unsubscribe(event, callback) {
    if (!this.listeners.has(event)) return;

    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  // Notify all listeners of an event
  notifyListeners(event, data = null) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  // Save state to localStorage for cross-page persistence
  persistToLocal(key, value) {
    try {
      const tempState = JSON.parse(localStorage.getItem('dashboard_temp_state') || '{}');
      tempState[key] = value;
      localStorage.setItem('dashboard_temp_state', JSON.stringify(tempState));
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }

  // Restore state from localStorage
  restoreFromLocal(key) {
    try {
      const tempState = JSON.parse(localStorage.getItem('dashboard_temp_state') || '{}');
      return tempState[key] || null;
    } catch (error) {
      console.error('Failed to restore state:', error);
      return null;
    }
  }

  // Clear temp state
  clearLocal() {
    localStorage.removeItem('dashboard_temp_state');
  }

  // Get current guild ID
  getCurrentGuildId() {
    return window.DashboardCore?.state?.currentGuildId || null;
  }

  // Get current user
  getCurrentUser() {
    return window.DashboardCore?.state?.currentUser || null;
  }

  // Get available channels for current guild
  getAvailableChannels() {
    const config = this.getGuildConfig();
    return config?.available_channels || [];
  }

  // Get available roles for current guild
  getAvailableRoles() {
    const config = this.getGuildConfig();
    return config?.available_roles || [];
  }

  // Get available emojis for current guild
  getAvailableEmojis() {
    const config = this.getGuildConfig();
    return config?.available_emojis || [];
  }
}

// Export as singleton
window.DashboardState = new DashboardState();
