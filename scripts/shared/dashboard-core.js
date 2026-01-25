// ===== DASHBOARD CORE MODULE =====
// Shared functionality across all guild dashboard pages
// Handles: Authentication, Guild Loading, Navigation, Config Management

console.log('dashboard-core.js loading...');

class DashboardCore {
  constructor() {
    this.API_BASE_URL = 'https://api.acosmibot.com';
    this.state = {
      userGuilds: [],
      currentGuildId: null,
      guildConfig: null,
      originalSettings: null, // Store original settings to detect real changes
      currentUser: null,
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
      isNavigating: false, // Flag to prevent double unsaved changes popup
      customCommandsCount: 0 // Track number of custom commands for nav indicator
    };
  }

  // ===== MAIN INITIALIZATION =====
  async init(featureName) {
    this.loadGuildFromURL();

    // Validate guild ID exists
    if (!this.state.currentGuildId) {
      this.showError('No guild specified');
      window.location.href = '/overview';
      return;
    }

    // Load user data and guilds
    await this.loadCurrentUser();
    await this.loadUserGuilds();

    // Load guild config
    await this.loadGuildConfig(this.state.currentGuildId);

    // Render server branding
    this.renderServerBranding();

    // Setup navigation
    this.setupNavigation(featureName);

    // Update notification icon
    this.updateNotificationIcon();

    // Setup global event listeners
    this.setupEventListeners();

    return this.state;
  }

  // ===== SPA REINITIALIZATION =====
  async initForSPA(featureName) {
    // Lighter initialization for SPA route changes
    // Only reload what's necessary

    const previousGuildId = this.state.currentGuildId;
    this.loadGuildFromURL();

    // If guild changed, reload guild config and update indicator
    if (this.state.currentGuildId !== previousGuildId) {
      await this.loadGuildConfig(this.state.currentGuildId);
      this.updateActiveGuildIndicator();
      this.renderServerBranding();
    } else {
      // Even if guild didn't change, render branding for the current feature page
      this.renderServerBranding();
    }

    // Always re-setup navigation to update active feature
    this.setupNavigation(featureName);

    // Update notification icon
    this.updateNotificationIcon();

    return this.state;
  }

  // ===== URL PARSING =====
  loadGuildFromURL() {
    // Parse /server/{guild_id}/{feature} URL pattern
    const pathParts = window.location.pathname.split('/');

    if (pathParts[1] === 'server' && pathParts[2]) {
      this.state.currentGuildId = pathParts[2];
    } else {
      // Fallback: check query params for backwards compatibility
      const urlParams = new URLSearchParams(window.location.search);
      this.state.currentGuildId = urlParams.get('guild');
    }
  }

  // ===== USER AUTHENTICATION & LOADING =====
  async loadCurrentUser() {
    try {
      const token = localStorage.getItem('discord_token');
      if (!token) {
        window.location.href = '/';
        return;
      }

      const response = await fetch(`${this.API_BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        console.error('Failed to load user:', response.status);
        return;
      }

      const user = await response.json();
      if (user && !user.error) {
        this.state.currentUser = user;
        this.renderUserAvatar(user);
      }
    } catch (error) {
      console.error('User loading error:', error);
      // Non-critical error, continue anyway
    }
  }

  renderUserAvatar(user) {
    const avatarElement = document.getElementById('userAvatarNav');
    if (!avatarElement) return;

    if (user.avatar) {
      // Check if avatar is already a full URL or just a hash
      const avatarUrl = user.avatar.startsWith('http')
        ? user.avatar
        : `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
      avatarElement.style.backgroundImage = `url('${avatarUrl}')`;
    } else {
      // Fallback: first letter of username
      avatarElement.textContent = (user.username || user.global_name || 'U').charAt(0).toUpperCase();
      avatarElement.style.display = 'flex';
      avatarElement.style.alignItems = 'center';
      avatarElement.style.justifyContent = 'center';
      avatarElement.style.fontSize = '14px';
      avatarElement.style.fontWeight = 'bold';
      avatarElement.style.color = 'white';
    }

    avatarElement.title = user.global_name || user.username || 'User';

    // Add click handler for menu
    avatarElement.addEventListener('click', () => this.showUserMenu());
    avatarElement.style.position = 'relative';
  }

  updateNotificationIcon() {
    const notificationBtn = document.getElementById('notificationBtn');
    if (!notificationBtn) return;

    // Check if there are notifications (placeholder logic - always false for now)
    const hasNotifications = false; // TODO: Implement actual notification checking

    if (hasNotifications) {
      notificationBtn.classList.add('hasNotifications');
    } else {
      notificationBtn.classList.remove('hasNotifications');
    }
  }

  renderServerBranding() {
    const config = this.state.guildConfig;
    if (!config) return;

    // Check if server branding element exists
    let brandingElement = document.getElementById('serverBranding');

    // If it doesn't exist, create it and insert it before the dashboard-header
    if (!brandingElement) {
      const header = document.querySelector('.dashboard-header');
      if (!header) return;

      brandingElement = document.createElement('div');
      brandingElement.id = 'serverBranding';
      brandingElement.className = 'server-branding';
      header.parentNode.insertBefore(brandingElement, header);
    }

    // Build server icon
    let iconHtml = '';
    if (config.guild_icon) {
      const iconUrl = `https://cdn.discordapp.com/icons/${config.guild_id}/${config.guild_icon}.png?size=128`;
      iconHtml = `<div class="server-branding-icon" style="background-image: url('${iconUrl}')"></div>`;
    } else {
      const initial = (config.guild_name || 'S').charAt(0).toUpperCase();
      iconHtml = `<div class="server-branding-icon">${initial}</div>`;
    }

    // Render branding
    brandingElement.innerHTML = `
      ${iconHtml}
      <div class="server-branding-name">${this.escapeHtml(config.guild_name || 'Server')}</div>
    `;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ===== GUILD LOADING & RENDERING =====
  async loadUserGuilds() {
    try {
      const token = localStorage.getItem('discord_token');
      if (!token) {
        window.location.href = '/';
        return;
      }

      const response = await fetch(`${this.API_BASE_URL}/api/user/guilds`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        this.state.userGuilds = data.guilds;
        this.renderGuildIcons();
      } else {
        throw new Error('Failed to load guilds');
      }
    } catch (error) {
      console.error('Guild loading error:', error);
      this.showError('Failed to load your servers');
    }
  }

  renderGuildIcons() {
    const container = document.getElementById('guildIconList');
    if (!container) return;

    container.innerHTML = '';

    // Filter to only show guilds where user is owner or has admin permissions
    const manageableGuilds = this.state.userGuilds.filter(guild => {
      const isOwner = guild.owner === true;
      const isAdmin = guild.permissions && guild.permissions.includes('administrator');
      return isOwner || isAdmin;
    });

    manageableGuilds.forEach(guild => {
      const iconDiv = document.createElement('div');
      iconDiv.className = `guild-icon ${guild.id === this.state.currentGuildId ? 'active' : ''}`;
      iconDiv.dataset.guildId = guild.id;
      iconDiv.title = guild.name;

      if (guild.icon) {
        const iconUrl = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
        iconDiv.style.backgroundImage = `url('${iconUrl}')`;
        iconDiv.style.backgroundSize = 'cover';
        iconDiv.style.backgroundPosition = 'center';
      } else {
        // Fallback: first letter
        iconDiv.textContent = guild.name.charAt(0).toUpperCase();
        iconDiv.style.display = 'flex';
        iconDiv.style.alignItems = 'center';
        iconDiv.style.justifyContent = 'center';
        iconDiv.style.fontSize = '20px';
        iconDiv.style.fontWeight = 'bold';
        iconDiv.style.color = 'white';
      }

      iconDiv.addEventListener('click', () => this.switchGuild(guild.id));
      container.appendChild(iconDiv);
    });
  }

  updateActiveGuildIndicator() {
    // Update the active class on guild icons without re-rendering
    const container = document.getElementById('guildIconList');
    if (!container) return;

    container.querySelectorAll('.guild-icon').forEach(icon => {
      const isActive = icon.dataset.guildId === this.state.currentGuildId;
      icon.classList.toggle('active', isActive);
    });
  }

  switchGuild(guildId) {
    // Prevent double popup during navigation
    if (this.state.isNavigating) return;

    if (this.state.hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Continue without saving?')) {
        return;
      }
    }

    this.state.isNavigating = true;
    this.state.hasUnsavedChanges = false; // Clear flag after user confirmed

    // Get current feature from URL
    const pathParts = window.location.pathname.split('/');
    const currentFeature = pathParts[3] || 'dashboard'; // Default to dashboard if not specified

    // Navigate to same feature in new guild
    if (window.Router) {
      // SPA navigation
      window.Router.navigate(guildId, currentFeature);
    } else {
      // Fallback to full page load for MPA
      window.location.href = `/server/${guildId}/${currentFeature}`;
    }

    // Reset navigation flag after a short delay
    setTimeout(() => {
      this.state.isNavigating = false;
    }, 100);
  }

  // ===== CONFIG LOADING =====
  async loadGuildConfig(guildId) {
    try {
      this.showLoading(true);
      const token = localStorage.getItem('discord_token');

      const response = await fetch(`${this.API_BASE_URL}/api/guilds/${guildId}/config-hybrid`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 403) {
          window.location.href = `/guild-stats.html?guild=${guildId}`;
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      this.state.guildConfig = data.data; // Access the nested 'data' property

      // Ensure settings exists
      if (!this.state.guildConfig.settings) {
        this.state.guildConfig.settings = {};
      }

      // Store original settings for change detection
      this.state.originalSettings = JSON.parse(JSON.stringify(this.state.guildConfig.settings));

      // Fetch custom commands count for nav indicator
      await this.loadCustomCommandsCount(guildId);

    } catch (error) {
      console.error('Config loading error:', error);
      this.showError('Failed to load guild configuration');
    } finally {
      this.showLoading(false);
    }
  }

  // Fetch custom commands count
  async loadCustomCommandsCount(guildId) {
    try {
      const token = localStorage.getItem('discord_token');
      const response = await fetch(`${this.API_BASE_URL}/api/guilds/${guildId}/custom-commands`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.state.customCommandsCount = data.count || 0;
        }
      }
    } catch (error) {
      console.error('Error fetching custom commands count:', error);
      this.state.customCommandsCount = 0;
    }
  }

  // ===== CONFIG SAVING =====
  async saveGuildConfig(updatedSettings) {
    if (this.state.isSaving) return;

    try {
      this.state.isSaving = true;
      this.showLoading(true);

      // Merge updated settings with existing settings
      if (!this.state.guildConfig.settings) {
        this.state.guildConfig.settings = {};
      }

      this.state.guildConfig.settings = {
        ...this.state.guildConfig.settings,
        ...updatedSettings
      };

      const token = localStorage.getItem('discord_token');
      const response = await fetch(`${this.API_BASE_URL}/api/guilds/${this.state.currentGuildId}/config-hybrid`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ settings: this.state.guildConfig.settings })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Success - update original settings to match current
      this.state.originalSettings = JSON.parse(JSON.stringify(this.state.guildConfig.settings));
      this.clearUnsavedChanges();
      this.showSuccess('Changes saved successfully!');

      // Update sidenav indicators to reflect new enabled/disabled states
      this.updateNavIndicators();

      return true;

    } catch (error) {
      console.error('Save error:', error);
      this.showError('Failed to save changes. Please try again.');
      return false;
    } finally {
      this.state.isSaving = false;
      this.showLoading(false);
    }
  }

  // ===== NAVIGATION SETUP =====
  setupNavigation(currentFeature) {
    const navContainer = document.getElementById('dashboardNavigation');
    if (!navContainer) return;

    // Inject navigation HTML
    navContainer.innerHTML = this.getNavigationHTML();

    // Setup click handlers
    document.querySelectorAll('.nav-item').forEach(item => {
      const feature = item.dataset.feature;
      const isComingSoon = item.dataset.comingSoon === 'true';

      if (feature === currentFeature) {
        item.classList.add('active');
      }

      item.addEventListener('click', () => {
        if (isComingSoon) {
          window.showComingSoonModal(feature);
        } else {
          this.navigateToFeature(feature);
        }
      });
    });

    // Setup section collapse handlers
    document.querySelectorAll('.nav-section-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.parentElement;
        section.classList.toggle('collapsed');
      });
    });

    // Update nav indicators based on enabled features
    this.updateNavIndicators();
  }

  getNavigationHTML() {
    return `
      <div class="nav-section">
        <div class="nav-section-header">
          <svg class="collapse-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
          <span>GENERAL</span>
        </div>
        <a href="/overview" class="nav-item nav-link-external">
          <span class="nav-icon nav-icon-overview"></span>
          <span class="nav-text">Overview</span>
        </a>
        <div class="nav-item" data-feature="dashboard">
          <span class="nav-icon nav-icon-dashboard"></span>
          <span class="nav-text">Dashboard</span>
        </div>
        <div class="nav-item" data-feature="membership" data-coming-soon="true">
          <span class="nav-icon nav-icon-membership"></span>
          <span class="nav-text">Membership</span>
        </div>
      </div>

      <div class="nav-section">
        <div class="nav-section-header">
          <svg class="collapse-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
          <span>SYSTEMS</span>
        </div>
        <div class="nav-item" data-feature="leveling">
          <span class="nav-icon nav-icon-leveling"></span>
          <span class="nav-text">Leveling</span>
          <span class="nav-indicator"></span>
        </div>
        <div class="nav-item" data-feature="welcomes" data-coming-soon="true">
          <span class="nav-icon nav-icon-welcomes"></span>
          <span class="nav-text">Welcomes and Goodbyes</span>
        </div>
        <div class="nav-item" data-feature="reputation" data-coming-soon="true">
          <span class="nav-icon nav-icon-reputation"></span>
          <span class="nav-text">Reputation</span>
        </div>
      </div>

      <div class="nav-section">
        <div class="nav-section-header">
          <svg class="collapse-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
          <span>UTILITIES</span>
        </div>
        <div class="nav-item" data-feature="embeds">
          <span class="nav-icon nav-icon-embeds"></span>
          <span class="nav-text">Embeds</span>
          <span class="nav-indicator"></span>
        </div>
        <div class="nav-item" data-feature="reaction-roles">
          <span class="nav-icon nav-icon-reactionroles"></span>
          <span class="nav-text">Reaction Roles</span>
          <span class="nav-indicator"></span>
        </div>
        <div class="nav-item" data-feature="custom-commands">
          <span class="nav-icon nav-icon-customcommands"></span>
          <span class="nav-text">Custom Commands</span>
          <span class="nav-indicator"></span>
        </div>
        <div class="nav-item" data-feature="moderation">
          <span class="nav-icon nav-icon-moderation"></span>
          <span class="nav-text">Moderation</span>
          <span class="nav-indicator"></span>
        </div>
      </div>

      <div class="nav-section">
        <div class="nav-section-header">
          <svg class="collapse-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
          <span>SOCIAL ALERTS</span>
        </div>
        <div class="nav-item" data-feature="twitch">
          <span class="nav-icon nav-icon-twitch"></span>
          <span class="nav-text">Twitch</span>
          <span class="nav-indicator"></span>
        </div>
        <div class="nav-item" data-feature="youtube">
          <span class="nav-icon nav-icon-youtube"></span>
          <span class="nav-text">YouTube</span>
          <span class="nav-indicator"></span>
        </div>
        <div class="nav-item" data-feature="kick">
          <span class="nav-icon nav-icon-kick"></span>
          <span class="nav-text">Kick</span>
          <span class="nav-indicator"></span>
        </div>
        <div class="nav-item" data-feature="reddit" data-coming-soon="true">
          <span class="nav-icon nav-icon-reddit"></span>
          <span class="nav-text">Reddit</span>
        </div>
      </div>

      <div class="nav-section">
        <div class="nav-section-header">
          <svg class="collapse-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
          <span>CHAOS</span>
        </div>
        <div class="nav-item" data-feature="polymorph">
          <span class="nav-icon nav-icon-polymorph"></span>
          <span class="nav-text">Polymorph</span>
          <span class="nav-indicator"></span>
        </div>
        <div class="nav-item" data-feature="portals">
          <span class="nav-dot"></span>
          <span class="nav-text">Portals</span>
          <span class="nav-indicator"></span>
        </div>
        <div class="nav-item" data-feature="jail">
          <span class="nav-dot"></span>
          <span class="nav-text">Jail</span>
          <span class="nav-indicator"></span>
        </div>
      </div>

      <div class="nav-section">
        <div class="nav-section-header">
          <svg class="collapse-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
          <span>GAMES AND GAMBLING</span>
        </div>
        <div class="nav-item" data-feature="slots">
          <span class="nav-icon nav-icon-slots"></span>
          <span class="nav-text">Slots</span>
          <span class="nav-indicator"></span>
        </div>
        <div class="nav-item" data-feature="lottery">
          <span class="nav-icon nav-icon-lottery"></span>
          <span class="nav-text">Lottery</span>
          <span class="nav-indicator"></span>
        </div>
      </div>
    `;
  }

  // Feature to config path mapping
  getFeatureConfigPath(feature) {
    const configPaths = {
      'leveling': 'leveling.enabled',
      'twitch': 'twitch.enabled',
      'youtube': 'youtube.enabled',
      'kick': 'kick.enabled',
      'polymorph': 'polymorph.enabled',
      'portals': 'cross_server_portal.enabled',
      'jail': 'jail.enabled',
      'slots': 'games.slots-config.enabled',
      'lottery': 'lottery.enabled',
      'embeds': 'embeds.enabled',
      'reaction-roles': 'reaction_roles.enabled',
      'moderation': 'moderation.enabled'
      // Note: custom-commands handled specially in isFeatureEnabled()
    };
    return configPaths[feature] || null;
  }

  // Check if a feature is enabled in config
  isFeatureEnabled(feature) {
    // Special case: custom commands are enabled if any commands exist
    if (feature === 'custom-commands') {
      return this.state.customCommandsCount > 0;
    }

    const configPath = this.getFeatureConfigPath(feature);
    if (!configPath || !this.state.guildConfig?.settings) {
      return false;
    }

    // Navigate the config path (e.g., 'games.slots-config.enabled')
    const parts = configPath.split('.');
    let value = this.state.guildConfig.settings;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return false;
      }
    }

    return value === true;
  }

  // Update all nav indicators based on config
  updateNavIndicators() {
    const navItems = document.querySelectorAll('.nav-item[data-feature]');

    navItems.forEach(item => {
      const feature = item.dataset.feature;
      const indicator = item.querySelector('.nav-indicator');

      if (indicator) {
        const isEnabled = this.isFeatureEnabled(feature);
        indicator.classList.toggle('active', isEnabled);
      }
    });
  }

  navigateToFeature(feature) {
    // Prevent double popup during navigation
    if (this.state.isNavigating) return;

    if (this.state.hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Continue without saving?')) {
        return;
      }
    }

    this.state.isNavigating = true;
    this.state.hasUnsavedChanges = false; // Clear flag after user confirmed

    if (window.Router) {
      // SPA navigation
      window.Router.navigate(this.state.currentGuildId, feature);
    } else {
      // Fallback to full page load for MPA
      window.location.href = `/server/${this.state.currentGuildId}/${feature}`;
    }

    // Reset navigation flag after a short delay
    setTimeout(() => {
      this.state.isNavigating = false;
    }, 100);
  }

  // Load feature with sub-route support
  // Used by features to navigate to sub-routes (e.g., embeds/new, embeds/edit/123)
  loadFeature(route) {
    // Prevent double popup during navigation
    if (this.state.isNavigating) return;

    if (this.state.hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Continue without saving?')) {
        return;
      }
    }

    this.state.isNavigating = true;
    this.state.hasUnsavedChanges = false;

    if (window.Router) {
      // Parse route to extract feature and sub-route
      // e.g., "embeds/new" -> feature: "embeds", subRoute: "new"
      const parts = route.split('/');
      const feature = parts[0];
      const subRoute = parts.slice(1).join('/');

      // SPA navigation with sub-route
      window.Router.navigate(this.state.currentGuildId, feature, subRoute || null);
    } else {
      // Fallback to full page load
      window.location.href = `/server/${this.state.currentGuildId}/${route}`;
    }

    // Reset navigation flag
    setTimeout(() => {
      this.state.isNavigating = false;
    }, 100);
  }

  // ===== EVENT LISTENERS =====
  setupEventListeners() {
    // Warn before page unload with unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (this.state.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    });
  }

  // ===== STATE MANAGEMENT HELPERS =====
  markUnsavedChanges() {
    // Check if current settings actually differ from original
    const currentSettings = JSON.stringify(this.state.guildConfig.settings);
    const originalSettings = JSON.stringify(this.state.originalSettings);

    if (currentSettings === originalSettings) {
      // Settings match original, clear unsaved changes
      this.clearUnsavedChanges();
      return;
    }

    this.state.hasUnsavedChanges = true;
    const saveBtn = document.getElementById('saveButton');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.classList.add('has-changes');
      const indicator = saveBtn.querySelector('.unsaved-indicator');
      if (indicator) indicator.style.display = 'inline';
    }
  }

  clearUnsavedChanges() {
    this.state.hasUnsavedChanges = false;
    const saveBtn = document.getElementById('saveButton');
    if (saveBtn) {
      saveBtn.classList.remove('has-changes');
      const indicator = saveBtn.querySelector('.unsaved-indicator');
      if (indicator) indicator.style.display = 'none';
    }
  }

  // ===== UTILITY FUNCTIONS =====
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showLoading(show) {
    this.state.isLoading = show;
    // TODO: Add loading spinner overlay
    console.log('Loading:', show);
  }

  showNotification(message, type = 'success') {
    // Create notification container if it doesn't exist
    let container = document.getElementById('notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container';
      container.className = 'notification-container';
      document.body.appendChild(container);
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Add to container
    container.appendChild(notification);

    // Trigger slide-in animation
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      // Remove from DOM after animation completes
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  // Show user dropdown menu
  showUserMenu() {
    // Remove existing menu if it exists
    const existingMenu = document.querySelector('.user-menu');
    if (existingMenu) {
      existingMenu.remove();
      return;
    }

    const menu = document.createElement('div');
    menu.className = 'user-menu';

    const user = this.state.currentUser;

    menu.innerHTML = `
      <div class="user-info">
        <div class="user-name">${user.global_name || user.username || 'User'}</div>
        <div class="user-stats">Level ${user.level || 1} • ${this.formatNumber(user.currency || 0)} Credits</div>
      </div>
      <a href="/overview">Overview</a>
      <a href="#" onclick="window.DashboardCore.showProfile(); return false;">Profile</a>
      <div style="border-top: 1px solid var(--border-light); margin: 5px 0;"></div>
      <a href="#" onclick="window.DashboardCore.logout(); return false;" class="logout-btn">🚪 Logout</a>
    `;

    // Position menu
    const avatarEl = document.getElementById('userAvatarNav');
    if (avatarEl) {
      avatarEl.appendChild(menu);

      // Close menu when clicking outside
      setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
          if (!menu.contains(e.target) && !avatarEl.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
          }
        });
      }, 100);
    }
  }

  // Profile placeholder
  showProfile() {
    alert('Profile page coming soon!');
  }

  // Logout
  logout() {
    localStorage.removeItem('discord_token');
    this.state.currentUser = null;

    // Remove any existing menu
    const menu = document.querySelector('.user-menu');
    if (menu) menu.remove();

    alert('Successfully logged out!');

    // Redirect to home
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  }

  // Format number with K/M suffix
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  }
}

// Export as singleton
window.DashboardCore = new DashboardCore();
console.log('DashboardCore exported:', window.DashboardCore);
console.log('DashboardCore.init type:', typeof window.DashboardCore.init);
