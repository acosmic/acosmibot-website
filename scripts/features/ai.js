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

    // Initialize shared core for SPA FIRST (to load config)
    if (Router) {
      // SPA mode - use lighter init
      await DashboardCore.initForSPA('ai');
    } else {
      // MPA mode - use full init (for backwards compatibility)
      await DashboardCore.init('ai');
    }

    // Check tier requirement after config is loaded
    const tierCheck = await this.checkTierAccess();
    if (!tierCheck.hasAccess) {
      this.showUpgradeCTA();
      return;
    }

    this.state.hasPremiumPlusAI = true;

    // Populate AI-specific UI
    this.populateAIUI();
    this.state.initialized = true;
  },

  // ===== TIER ACCESS CHECK =====
  async checkTierAccess() {
    // Use DashboardCore to get config (which should already be loaded by init)
    const config = window.DashboardCore.state.guildConfig;
    const tier = config?.premium_tier || 'free';

    console.log('[AI Feature] Tier check:', {
      guildId: config?.guild_id,
      premium_tier: tier,
      hasAccess: tier === 'premium_plus_ai',
      full_config: config
    });

    this.state.tierInfo = { tier: tier };

    return {
      hasAccess: tier === 'premium_plus_ai',
      tier: tier
    };
  },

  // ===== SHOW UPGRADE MODAL =====
  showUpgradeCTA() {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.3s ease;
    `;

    modal.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
        border: 2px solid #00D9FF;
        border-radius: 16px;
        padding: 40px;
        max-width: 500px;
        text-align: center;
        color: white;
        box-shadow: 0 8px 32px rgba(0, 217, 255, 0.3);
        animation: slideUp 0.3s ease;
      ">
        <div style="font-size: 64px; margin-bottom: 20px;">🤖</div>
        <h2 style="
          font-size: 28px;
          margin-bottom: 16px;
          background: linear-gradient(135deg, #00D9FF, #9333EA);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        ">AI Features Require Premium + AI</h2>
        <p style="
          font-size: 16px;
          color: #b0b0b0;
          margin-bottom: 12px;
          line-height: 1.6;
        ">
          Unlock advanced AI customization to personalize your server's AI assistant with custom personalities, model selection, and channel restrictions.
        </p>
        <p style="
          font-size: 14px;
          color: #888;
          margin-bottom: 24px;
        ">
          Premium + AI tier required
        </p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <a href="/premium" style="
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #00D9FF, #0099CC);
            color: #1A1A1A;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 217, 255, 0.3);
          " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(0, 217, 255, 0.4)';"
             onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0, 217, 255, 0.3)';">
            Upgrade to Premium + AI
          </a>
          <button onclick="this.closest('div').parentElement.parentElement.remove(); window.Router.navigate(window.DashboardCore.state.currentGuildId, 'overview');" style="
            padding: 14px 32px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 16px;
            transition: all 0.3s ease;
          " onmouseover="this.style.background='rgba(255, 255, 255, 0.15)';"
             onmouseout="this.style.background='rgba(255, 255, 255, 0.1)';">
            Go Back
          </button>
        </div>
      </div>
    `;

    // Add animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        // Navigate back to overview
        if (window.Router && window.DashboardCore) {
          window.Router.navigate(window.DashboardCore.state.currentGuildId, 'overview');
        }
      }
    });

    document.body.appendChild(modal);

    // Don't initialize the settings UI
    const settingsContainer = document.getElementById('aiSettingsContainer');
    if (settingsContainer) {
      settingsContainer.style.display = 'none';
    }

    // Hide the inline upgrade banner
    const upgradeBanner = document.getElementById('aiUpgradeCTA');
    if (upgradeBanner) {
      upgradeBanner.style.display = 'none';
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
      const isEnabled = aiSettings.enabled !== false;
      toggle.checked = isEnabled;

      console.log('[AI Feature] Master toggle setup:', {
        aiSettings_enabled: aiSettings.enabled,
        toggle_checked: isEnabled
      });

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
