// ===== AI CUSTOMIZATION FEATURE =====
// Feature-specific logic for AI personality and behavior configuration

// Feature module pattern for SPA compatibility
const AIFeature = {
  // ===== FEATURE STATE =====
  state: {
    initialized: false,
    hasPremiumPlusAI: false,
    tierInfo: null
  },

  // ===== INITIALIZATION =====
  async init() {
    console.log('AI feature initialized');
    const { DashboardCore, Router } = window;

    // Check tier requirement first
    const tierCheck = await this.checkTierAccess();
    if (!tierCheck.hasAccess) {
      this.showUpgradeCTA();
      return;
    }

    this.state.hasPremiumPlusAI = true;

    // Initialize shared core for SPA
    if (Router) {
      // SPA mode - use lighter init
      await DashboardCore.initForSPA('ai');
    } else {
      // MPA mode - use full init (for backwards compatibility)
      await DashboardCore.init('ai');
    }

    // Populate AI-specific UI
    this.populateAIUI();
    this.state.initialized = true;
  },

  // ===== TIER ACCESS CHECK =====
  async checkTierAccess() {
    const guildId = this.getGuildId();
    const token = localStorage.getItem('discord_token');

    if (!token || !guildId) {
      return { hasAccess: false, tier: null };
    }

    try {
      const response = await fetch(
        `https://api.acosmibot.com/api/guilds/${guildId}/subscription`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        console.error('Failed to fetch subscription tier');
        return { hasAccess: false, tier: null };
      }

      const tierInfo = await response.json();
      this.state.tierInfo = tierInfo;

      return {
        hasAccess: tierInfo.tier === 'premium_plus_ai',
        tier: tierInfo.tier
      };
    } catch (error) {
      console.error('Error checking tier access:', error);
      return { hasAccess: false, tier: null };
    }
  },

  // ===== SHOW UPGRADE CTA =====
  showUpgradeCTA() {
    const upgradeCTA = document.getElementById('aiUpgradeCTA');
    const settingsContainer = document.getElementById('aiSettingsContainer');

    if (upgradeCTA) {
      upgradeCTA.style.display = 'block';
    }
    if (settingsContainer) {
      settingsContainer.style.display = 'none';
    }
  },

  // ===== CLEANUP =====
  async cleanup() {
    console.log('AI feature cleanup');
    this.state.initialized = false;
    this.state.hasPremiumPlusAI = false;
    // Event listeners attached via addEventListener need cleanup
    this.removeEventListeners();
  },

  // ===== HELPER TO GET GUILD ID =====
  getGuildId() {
    const pathParts = window.location.pathname.split('/');
    if (pathParts[1] === 'server' && pathParts[2]) {
      return pathParts[2];
    }
    return null;
  },

  // ===== UI POPULATION =====
  populateAIUI() {
    const config = window.DashboardCore.state.guildConfig;

    // Ensure settings structures exist
    if (!config.settings) {
      config.settings = {};
    }
    if (!config.settings.ai) {
      config.settings.ai = {
        enabled: true,
        model: 'gpt-4o-mini',
        channel_mode: 'exclude',
        excluded_channels: [],
        allowed_channels: [],
        instructions: 'You are a helpful AI assistant in this Discord server.'
      };
    }

    const aiSettings = config.settings.ai;

    // 1. Master feature toggle
    this.setupMasterToggle(aiSettings);

    // 2. AI Model Selection
    this.setupModelSelection(aiSettings);

    // 3. AI Instructions
    this.setupInstructions(aiSettings);

    // 4. Channel Mode Selection
    this.setupChannelMode(aiSettings);

    // 5. Channel Lists
    this.setupChannelLists(config, aiSettings);

    // Show/hide settings container
    const settingsContainer = document.getElementById('aiSettingsContainer');
    if (settingsContainer) {
      settingsContainer.style.display = 'block';
    }
  },

  // ===== MASTER TOGGLE SETUP =====
  setupMasterToggle(aiSettings) {
    const toggle = document.getElementById('ai-enabled-toggle');
    if (toggle) {
      toggle.checked = aiSettings.enabled !== false;
      toggle.addEventListener('change', (e) => {
        aiSettings.enabled = e.target.checked;
        window.DashboardCore.markUnsavedChanges();
        this.updateMasterToggleState(e.target.checked);
      });
    }
  },

  // ===== MODEL SELECTION SETUP =====
  setupModelSelection(aiSettings) {
    const modelSelect = document.getElementById('aiModelSelect');
    if (modelSelect) {
      modelSelect.value = aiSettings.model || 'gpt-4o-mini';
      modelSelect.addEventListener('change', (e) => {
        const selectedModel = e.target.value;

        // Validate tier access for selected model
        if (this.canUseModel(selectedModel)) {
          aiSettings.model = selectedModel;
          window.DashboardCore.markUnsavedChanges();
        } else {
          // Revert to previous value
          modelSelect.value = aiSettings.model;
          this.showError('Your tier does not support this model');
        }
      });
    }
  },

  // ===== MODEL ACCESS VALIDATION =====
  canUseModel(modelName) {
    // For now, all models are available to premium_plus_ai tier
    // This can be extended later if different tiers have different model access
    return this.state.hasPremiumPlusAI;
  },

  // ===== INSTRUCTIONS SETUP =====
  setupInstructions(aiSettings) {
    const textarea = document.getElementById('aiInstructions');
    const charCount = document.getElementById('instructionsCharCount');

    if (textarea) {
      textarea.value = aiSettings.instructions || 'You are a helpful AI assistant in this Discord server.';

      // Update character count
      this.updateCharacterCount(textarea.value.length);

      textarea.addEventListener('input', (e) => {
        const text = e.target.value;

        // Enforce max length
        if (text.length > 2000) {
          e.target.value = text.substring(0, 2000);
          return;
        }

        aiSettings.instructions = text;
        this.updateCharacterCount(text.length);
        window.DashboardCore.markUnsavedChanges();
      });
    }
  },

  // ===== CHARACTER COUNT UPDATE =====
  updateCharacterCount(count) {
    const charCountElement = document.getElementById('instructionsCharCount');
    if (charCountElement) {
      charCountElement.textContent = count;

      const parent = charCountElement.parentElement;
      parent.classList.remove('warning', 'danger');

      if (count > 1800) {
        parent.classList.add('danger');
      } else if (count > 1500) {
        parent.classList.add('warning');
      }
    }
  },

  // ===== CHANNEL MODE SETUP =====
  setupChannelMode(aiSettings) {
    const excludeRadio = document.getElementById('channelModeExclude');
    const includeRadio = document.getElementById('channelModeInclude');

    if (excludeRadio && includeRadio) {
      const currentMode = aiSettings.channel_mode || 'exclude';

      if (currentMode === 'exclude') {
        excludeRadio.checked = true;
      } else {
        includeRadio.checked = true;
      }

      // Update sections visibility
      this.updateChannelModeSections(currentMode);

      // Add event listeners
      excludeRadio.addEventListener('change', (e) => {
        if (e.target.checked) {
          aiSettings.channel_mode = 'exclude';
          this.updateChannelModeSections('exclude');
          window.DashboardCore.markUnsavedChanges();
        }
      });

      includeRadio.addEventListener('change', (e) => {
        if (e.target.checked) {
          aiSettings.channel_mode = 'include';
          this.updateChannelModeSections('include');
          window.DashboardCore.markUnsavedChanges();
        }
      });
    }
  },

  // ===== CHANNEL MODE SECTIONS UPDATE =====
  updateChannelModeSections(mode) {
    const excludedSection = document.getElementById('excludedChannelsSection');
    const allowedSection = document.getElementById('allowedChannelsSection');

    if (mode === 'exclude') {
      if (excludedSection) excludedSection.style.display = 'block';
      if (allowedSection) allowedSection.style.display = 'none';
    } else {
      if (excludedSection) excludedSection.style.display = 'none';
      if (allowedSection) allowedSection.style.display = 'block';
    }
  },

  // ===== CHANNEL LISTS SETUP =====
  setupChannelLists(config, aiSettings) {
    const excludedList = document.getElementById('excludedChannelsList');
    const allowedList = document.getElementById('allowedChannelsList');

    if (!config.available_channels) return;

    // Filter to only text and announcement channels
    const textChannels = config.available_channels.filter(
      channel => channel.type === 0 || channel.type === 5
    );

    // Populate excluded channels
    if (excludedList) {
      excludedList.innerHTML = '';
      textChannels.forEach(channel => {
        const item = this.createChannelCheckbox(
          channel,
          aiSettings.excluded_channels || [],
          'excluded'
        );
        excludedList.appendChild(item);
      });
    }

    // Populate allowed channels
    if (allowedList) {
      allowedList.innerHTML = '';
      textChannels.forEach(channel => {
        const item = this.createChannelCheckbox(
          channel,
          aiSettings.allowed_channels || [],
          'allowed'
        );
        allowedList.appendChild(item);
      });
    }
  },

  // ===== CREATE CHANNEL CHECKBOX =====
  createChannelCheckbox(channel, selectedChannels, listType) {
    const label = document.createElement('label');
    label.className = 'channel-checkbox-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = channel.id;
    checkbox.checked = selectedChannels.includes(channel.id);

    checkbox.addEventListener('change', (e) => {
      const config = window.DashboardCore.state.guildConfig;
      const aiSettings = config.settings.ai;

      const channelId = e.target.value;
      const isChecked = e.target.checked;

      if (listType === 'excluded') {
        if (!aiSettings.excluded_channels) {
          aiSettings.excluded_channels = [];
        }
        if (isChecked) {
          if (!aiSettings.excluded_channels.includes(channelId)) {
            aiSettings.excluded_channels.push(channelId);
          }
        } else {
          aiSettings.excluded_channels = aiSettings.excluded_channels.filter(
            id => id !== channelId
          );
        }
      } else {
        if (!aiSettings.allowed_channels) {
          aiSettings.allowed_channels = [];
        }
        if (isChecked) {
          if (!aiSettings.allowed_channels.includes(channelId)) {
            aiSettings.allowed_channels.push(channelId);
          }
        } else {
          aiSettings.allowed_channels = aiSettings.allowed_channels.filter(
            id => id !== channelId
          );
        }
      }

      window.DashboardCore.markUnsavedChanges();
    });

    const channelName = document.createElement('span');
    channelName.textContent = `# ${channel.name}`;

    label.appendChild(checkbox);
    label.appendChild(channelName);

    return label;
  },

  // ===== MASTER TOGGLE STATE UPDATE =====
  updateMasterToggleState(enabled) {
    const settingsContainer = document.getElementById('aiSettingsContainer');
    if (!settingsContainer) return;

    const formElements = settingsContainer.querySelectorAll(
      'input, select, textarea, button'
    );

    formElements.forEach(el => {
      // Don't disable the master toggle itself
      if (el.id !== 'ai-enabled-toggle') {
        el.disabled = !enabled;
      }
    });

    if (enabled) {
      settingsContainer.classList.remove('disabled');
    } else {
      settingsContainer.classList.add('disabled');
    }
  },

  // ===== EVENT LISTENER CLEANUP =====
  removeEventListeners() {
    // Event listeners are attached to elements that will be removed from DOM
    // so they will be automatically cleaned up
  },

  // ===== ERROR DISPLAY =====
  showError(message) {
    if (window.DashboardCore && window.DashboardCore.showError) {
      window.DashboardCore.showError(message);
    } else {
      alert(message);
    }
  },

  // ===== SAVE FUNCTIONALITY =====
  async saveChanges() {
    const config = window.DashboardCore.state.guildConfig;

    if (!config.settings || !config.settings.ai) {
      this.showError('No AI settings to save');
      return;
    }

    // Validate instructions length
    if (config.settings.ai.instructions && config.settings.ai.instructions.length > 2000) {
      this.showError('Instructions must be under 2000 characters');
      return;
    }

    // Save via DashboardCore
    const success = await window.DashboardCore.saveGuildConfig({
      ai: config.settings.ai
    });

    if (success) {
      // Update save button UI
      const saveBtn = document.getElementById('saveButton');
      if (saveBtn) {
        saveBtn.disabled = true;
        window.DashboardCore.clearUnsavedChanges();
      }
    }
  }
};

// Make saveChanges globally accessible for onclick handlers
window.AIFeature = AIFeature;

// MPA backwards compatibility - auto-init if not in SPA mode
if (!window.Router) {
  document.addEventListener('DOMContentLoaded', async () => {
    await AIFeature.init();
  });
}
