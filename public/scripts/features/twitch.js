// ===== TWITCH ALERTS FEATURE =====
// Feature-specific logic for Twitch streaming alerts

// Feature module pattern for SPA compatibility
const TwitchFeature = {
  // ===== FEATURE STATE =====
  state: {
    selectedStreamerIndex: null,
    validationTimeouts: {} // Track timeouts by streamer index for auto-hiding validation
  },

  // ===== INITIALIZATION =====
  async init() {
    console.log('Twitch feature initialized');
    const { DashboardCore, Router } = window;

    // Initialize shared core for SPA
    if (Router) {
      // SPA mode - use lighter init
      await DashboardCore.initForSPA('twitch');
    } else {
      // MPA mode - use full init (for backwards compatibility)
      await DashboardCore.init('twitch');
    }

    // Populate Twitch-specific UI
    populateTwitchUI();

    // Clear streamer selection on Escape key press
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.state.selectedStreamerIndex !== null) {
        this.clearStreamerSelection();
      }
    });
  },

  // ===== CLEANUP =====
  async cleanup() {
    // Clear validation timeouts
    Object.values(this.state.validationTimeouts).forEach(timeout => {
      clearTimeout(timeout);
    });
    this.state.validationTimeouts = {};

    // Clear state
    this.state.selectedStreamerIndex = null;

    // Note: Event listeners attached via onclick in HTML don't need cleanup
    // They're removed automatically when the DOM element is removed
  },

  // ===== EXPOSE FUNCTIONS =====
  addStreamer() { addTwitchStreamerInternal(); },
  removeStreamer(index) { removeTwitchStreamerInternal(index); },
  saveAllChanges() { saveTwitchChangesInternal(); },
  selectStreamer(index) { selectTwitchStreamerInternal(index); },
  clearStreamerSelection() { clearTwitchStreamerSelectionInternal(); },
};

// Helper to get DashboardCore instance
function getDashboardCore() {
  return window.DashboardCore;
}

// ===== UI POPULATION =====
function populateTwitchUI() {
  const config = getDashboardCore().state.guildConfig;

  // Ensure settings exists
  if (!config.settings) {
    config.settings = {};
  }

  // Ensure twitch settings exists
  if (!config.settings.twitch) {
    config.settings.twitch = {};
  }

  // 1. Feature toggle
  const featureToggle = document.getElementById('featureToggle');
  if (featureToggle) {
    featureToggle.checked = config.settings.twitch.enabled !== false;
    featureToggle.addEventListener('change', (e) => {
      config.settings.twitch.enabled = e.target.checked;
      getDashboardCore().markUnsavedChanges();
    });
  }

  // 2. Channel dropdown (GLOBAL)
  const channelSelect = document.getElementById('channelSelect');
  if (channelSelect && config.available_channels) {
    channelSelect.innerHTML = '<option value="">Select a channel...</option>';
    config.available_channels.forEach(channel => {
      const option = document.createElement('option');
      option.value = channel.id;
      option.textContent = `#${channel.name}`;
      channelSelect.appendChild(option);
    });

    // Populate with global default
    channelSelect.value = config.settings.twitch?.announcement_channel_id || '';

    channelSelect.addEventListener('change', handleChannelChange);
  }

  // 3. Ping Roles dropdown (multi-select - PER-STREAMER ONLY)
  const pingRolesSelect = document.getElementById('pingRolesSelect');
  if (pingRolesSelect && config.available_roles) {
    pingRolesSelect.innerHTML = '';

    // Add @everyone and @here options
    const everyoneOption = document.createElement('option');
    everyoneOption.value = 'everyone';
    everyoneOption.textContent = '@everyone';
    pingRolesSelect.appendChild(everyoneOption);

    const hereOption = document.createElement('option');
    hereOption.value = 'here';
    hereOption.textContent = '@here';
    pingRolesSelect.appendChild(hereOption);

    // Add separator
    const separator = document.createElement('option');
    separator.disabled = true;
    separator.textContent = '───────────';
    pingRolesSelect.appendChild(separator);

    // Add all roles (excluding @everyone and managed roles)
    config.available_roles.forEach(role => {
      if (role.id === config.guild_id || role.managed) return;

      const option = document.createElement('option');
      option.value = role.id;
      option.textContent = role.name;
      pingRolesSelect.appendChild(option);
    });

    // Initially disable until a streamer is selected
    pingRolesSelect.disabled = true;

    pingRolesSelect.addEventListener('change', handlePingRolesChange);
  }

  // 4. Announcement Message
  const messageTextarea = document.getElementById('announcementMessageTextarea');
  if (messageTextarea) {
    messageTextarea.value = config.settings.twitch?.announcement_message || '{username} is live!';
    messageTextarea.disabled = true; // Start disabled until a streamer is selected
    messageTextarea.addEventListener('input', handleAnnouncementMessageChange);
  }

  // 5. Streamers list
  const streamers = config.settings.twitch?.tracked_streamers || [];
  
  // Ensure all streamers have the platform property set
  streamers.forEach(streamer => {
    if (!streamer.platform) {
      streamer.platform = 'twitch';
    }
  });

  renderTwitchStreamerList(streamers);

  // 6. Update streamer limit display
  updateTwitchStreamerLimitDisplay();
}

// ===== STREAMER CRUD OPERATIONS =====
function updateTwitchStreamerLimitDisplay() {
  const config = getDashboardCore().state.guildConfig;
  const streamers = config.settings.twitch?.tracked_streamers || [];
  const premiumTier = config.premium_tier || 'free';
  const maxStreamers = (premiumTier === 'premium' || premiumTier === 'premium_plus_ai') ? 5 : 1;

  console.log('[Twitch] Limit calculation:', {
    premium_tier: premiumTier,
    current_streamers: streamers.length,
    max_streamers: maxStreamers
  });

  const limitDisplay = document.getElementById('streamerLimitDisplay');
  if (limitDisplay) {
    limitDisplay.textContent = `${streamers.length} of ${maxStreamers}`;
  }
}

function renderTwitchStreamerList(streamers) {
  const container = document.getElementById('streamersList');
  const config = getDashboardCore().state.guildConfig;
  const premiumTier = config.premium_tier || 'free';
  const maxStreamers = (premiumTier === 'premium' || premiumTier === 'premium_plus_ai') ? 5 : 1;

  if (!container) return;

  // Render all streamers as input rows
  container.innerHTML = streamers.map((streamer, index) =>
    createTwitchStreamerInputRow(streamer, index)
  ).join('');

  // Add event listeners for all inputs and rows
  streamers.forEach((streamer, index) => {
    const input = document.getElementById(`streamer-input-${index}`);
    const row = document.getElementById(`streamer-row-${index}`);

    if (input) {
      input.addEventListener('input', (e) => handleTwitchStreamerInput(index, e.target.value));
      input.addEventListener('blur', (e) => validateTwitchStreamer(index, e.target.value));
    }

    if (row) {
      row.addEventListener('click', (e) => {
        // Don't select if clicking on input, validation indicator, edit button, or delete button
        if (e.target.tagName === 'INPUT' ||
            e.target.tagName === 'BUTTON' ||
            e.target.classList.contains('validation-indicator') ||
            e.target.classList.contains('edit-btn')) {
          return;
        }
        selectTwitchStreamerInternal(index);
      });
    }
  });

  // Update add button state
  const addBtn = document.querySelector('.btn-add-streamer');
  if (addBtn) {
    addBtn.disabled = streamers.length >= maxStreamers;
  }
}

function createTwitchStreamerInputRow(streamer, index) {
  // Determine validation status
  let validationClass = '';
  let validationIcon = '';

  // Check if validation should be hidden (auto-hide after 3 seconds for valid state)
  const hideValidation = streamer.isValid && streamer.hideValidation;

  if (streamer.isValid && !hideValidation) {
    validationClass = 'valid';
    validationIcon = '✓';
  } else if (streamer.username && streamer.validating) {
    validationClass = 'validating';
    validationIcon = '...';
  } else if (streamer.username && streamer.isValid === false && !hideValidation) {
    validationClass = 'invalid';
    validationIcon = '✗';
  }

  // Determine if this row is selected
  const isSelected = TwitchFeature.state.selectedStreamerIndex === index;
  const selectedClass = isSelected ? 'selected' : '';

  return `
    <div class="stream-input-group ${selectedClass}" id="streamer-row-${index}">
      <input
        type="text"
        class="stream-input"
        id="streamer-input-${index}"
        placeholder="Twitch Username"
        value="${escapeHtml(streamer.username || '')}"
      />
      <div class="validation-indicator ${validationClass}">
        ${validationIcon}
      </div>
      <button class="edit-btn" onclick="selectTwitchStreamer(${index})">✎</button>
      <button class="delete-btn" onclick="removeTwitchStreamer(${index})">×</button>
    </div>
  `;
}

function addTwitchStreamerInternal() {
  const config = getDashboardCore().state.guildConfig;

  // Ensure settings structure exists
  if (!config.settings) {
    config.settings = {};
  }
  if (!config.settings.twitch) {
    config.settings.twitch = {};
  }
  if (!config.settings.twitch.tracked_streamers) {
    config.settings.twitch.tracked_streamers = [];
  }

  const newStreamer = {
    platform: 'twitch',
    username: '',
    isValid: false,
    mention_role_ids: [],
    mention_everyone: false,
    mention_here: false,
    custom_message: null,
    skip_vod_check: false
  };

  const streamers = config.settings.twitch.tracked_streamers;
  streamers.push(newStreamer);

  renderTwitchStreamerList(streamers);
  updateTwitchStreamerLimitDisplay();
  getDashboardCore().markUnsavedChanges();

  // Focus the username input for the new streamer (but don't auto-select)
  const newIndex = streamers.length - 1;
  setTimeout(() => {
    const input = document.getElementById(`streamer-input-${newIndex}`);
    if (input) {
      input.focus();
    }
  }, 100);
}

function handleTwitchStreamerInput(index, value) {
  const config = getDashboardCore().state.guildConfig;
  if (!config.settings?.twitch?.tracked_streamers) return;

  const streamers = config.settings.twitch.tracked_streamers;
  streamers[index].username = value;

  // Clear previous validation when username changes
  if (streamers[index].isValid) {
    streamers[index].isValid = false;
    renderTwitchStreamerList(streamers);
  }

  // Clear validation timeout if it exists
  if (TwitchFeature.state.validationTimeouts[index]) {
    clearTimeout(TwitchFeature.state.validationTimeouts[index]);
    delete TwitchFeature.state.validationTimeouts[index];
  }

  // Update selected streamer name indicator if this streamer is selected
  if (TwitchFeature.state.selectedStreamerIndex === index) {
    const nameSpan = document.getElementById('selectedStreamerNameIndicator');
    if (nameSpan) {
      nameSpan.textContent = value || 'New Streamer';
    }
  }

  getDashboardCore().markUnsavedChanges();
}

async function validateTwitchStreamer(index, username) {
  const config = getDashboardCore().state.guildConfig;
  if (!config.settings?.twitch?.tracked_streamers) return;
  if (!username || username.trim() === '') return;

  const streamers = config.settings.twitch.tracked_streamers;
  const streamer = streamers[index];

  // Clear any existing timeout for this streamer
  if (TwitchFeature.state.validationTimeouts[index]) {
    clearTimeout(TwitchFeature.state.validationTimeouts[index]);
    delete TwitchFeature.state.validationTimeouts[index];
  }

  // Set validating state
  streamer.validating = true;
  streamer.hideValidation = false; // Show validation during process
  renderTwitchStreamerList(streamers);

  try {
    const token = localStorage.getItem('discord_token');
    const response = await fetch(`${getDashboardCore().API_BASE_URL}/api/twitch/validate-username`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username: username.trim() })
    });

    const data = await response.json();

    streamer.validating = false;

    if (data.success && data.valid) {
      streamer.isValid = true;
      streamer.username = username.trim();
      streamer.hideValidation = false; // Show valid checkmark initially

      // Set timeout to hide validation after 3 seconds
      TwitchFeature.state.validationTimeouts[index] = setTimeout(() => {
        streamer.hideValidation = true;
        renderTwitchStreamerList(streamers);
        delete TwitchFeature.state.validationTimeouts[index];
      }, 3000);
    } else {
      streamer.isValid = false;
      streamer.hideValidation = false; // Show invalid state initially

      // Set timeout to hide validation after 3 seconds
      TwitchFeature.state.validationTimeouts[index] = setTimeout(() => {
        streamer.hideValidation = true;
        renderTwitchStreamerList(streamers);
        delete TwitchFeature.state.validationTimeouts[index];
      }, 3000);
    }

    renderTwitchStreamerList(streamers);
  } catch (error) {
    console.error('Validation error:', error);
    streamer.validating = false;
    streamer.isValid = false;
    streamer.hideValidation = false;

    // Set timeout to hide validation after 3 seconds
    TwitchFeature.state.validationTimeouts[index] = setTimeout(() => {
      streamer.hideValidation = true;
      renderTwitchStreamerList(streamers);
      delete TwitchFeature.state.validationTimeouts[index];
    }, 3000);

    renderTwitchStreamerList(streamers);
  }
}

function removeTwitchStreamerInternal(index) {
  const config = getDashboardCore().state.guildConfig;
  if (!config.settings?.twitch?.tracked_streamers) {
    console.error('No streamers to remove');
    return;
  }

  const streamers = config.settings.twitch.tracked_streamers;
  streamers.splice(index, 1);

  // Clear selection if the deleted streamer was selected
  if (TwitchFeature.state.selectedStreamerIndex === index) {
    clearTwitchStreamerSelectionInternal();
  } else if (TwitchFeature.state.selectedStreamerIndex !== null && TwitchFeature.state.selectedStreamerIndex > index) {
    // Adjust selected index if it was after the deleted streamer
    TwitchFeature.state.selectedStreamerIndex--;
  }

  renderTwitchStreamerList(streamers);
  updateTwitchStreamerLimitDisplay();
  getDashboardCore().markUnsavedChanges();
}

// ===== PER-STREAMER SETTINGS =====
function selectTwitchStreamerInternal(index) {
  const config = getDashboardCore().state.guildConfig;
  if (!config.settings?.twitch?.tracked_streamers) return;

  const streamers = config.settings.twitch.tracked_streamers;
  const streamer = streamers[index];
  if (!streamer) return;

  // Update selected index
  TwitchFeature.state.selectedStreamerIndex = index;

  // Update UI to show selection
  renderTwitchStreamerList(streamers);

  // Populate form fields with this streamer's data
  populateTwitchFormFieldsForStreamer(streamer);

  // Show selected streamer indicator
  const indicator = document.getElementById('selectedStreamerIndicator');
  const nameSpan = document.getElementById('selectedStreamerNameIndicator');
  if (indicator && nameSpan) {
    nameSpan.textContent = streamer.username || 'New Streamer';
    indicator.style.display = 'flex';
  }
}

function populateTwitchFormFieldsForStreamer(streamer) {
  const config = getDashboardCore().state.guildConfig;
  const pingRolesSelect = document.getElementById('pingRolesSelect');
  const messageTextarea = document.getElementById('announcementMessageTextarea');

  // Channel dropdown DOES NOT change - it's always global
  // No need to update it when selecting a streamer

  // Enable and populate Ping Roles for this streamer
  if (pingRolesSelect) {
    pingRolesSelect.disabled = false;

    // Clear all selections
    Array.from(pingRolesSelect.options).forEach(opt => opt.selected = false);

    // Select @everyone if enabled
    if (streamer.mention_everyone) {
      const everyoneOpt = pingRolesSelect.querySelector('option[value="everyone"]');
      if (everyoneOpt) everyoneOpt.selected = true;
    }

    // Select @here if enabled
    if (streamer.mention_here) {
      const hereOpt = pingRolesSelect.querySelector('option[value="here"]');
      if (hereOpt) hereOpt.selected = true;
    }

    // Select roles
    const roleIds = streamer.mention_role_ids || [];
    roleIds.forEach(roleId => {
      const roleOpt = pingRolesSelect.querySelector(`option[value="${roleId}"]`);
      if (roleOpt) roleOpt.selected = true;
    });
  }

  // Announcement Message: Use streamer's custom message or fall back to global
  if (messageTextarea) {
    messageTextarea.disabled = false; // Enable for streamer editing
    const message = streamer.custom_message ||
                   config.settings.twitch?.announcement_message ||
                   '{username} is live!';
    messageTextarea.value = message;
  }
}

function clearTwitchStreamerSelectionInternal() {
  const config = getDashboardCore().state.guildConfig;
  TwitchFeature.state.selectedStreamerIndex = null;

  // Hide selected streamer indicator
  const indicator = document.getElementById('selectedStreamerIndicator');
  if (indicator) {
    indicator.style.display = 'none';
  }

  // Re-render to remove selected class
  if (config.settings?.twitch?.tracked_streamers) {
    renderTwitchStreamerList(config.settings.twitch.tracked_streamers);
  }

  // Reset form fields to global defaults
  populateTwitchFormFieldsWithGlobalDefaults();
}

function populateTwitchFormFieldsWithGlobalDefaults() {
  const config = getDashboardCore().state.guildConfig;
  const pingRolesSelect = document.getElementById('pingRolesSelect');
  const messageTextarea = document.getElementById('announcementMessageTextarea');

  // Channel doesn't need to be reset - it's always global and doesn't change with selection

  if (pingRolesSelect) {
    // Disable ping roles when no streamer is selected (it's per-streamer only)
    pingRolesSelect.disabled = true;
    Array.from(pingRolesSelect.options).forEach(opt => opt.selected = false);
  }

  if (messageTextarea) {
    messageTextarea.disabled = true; // Disable when no selection
    // Reset to global default message
    messageTextarea.value = config.settings.twitch?.announcement_message || '{username} is live!';
  }
}

// ===== FORM FIELD CHANGE HANDLERS =====
function handleChannelChange(e) {
  const config = getDashboardCore().state.guildConfig;
  const channelId = e.target.value || null;

  // Channel is ALWAYS global - applies to all streamers
  if (!config.settings.twitch) config.settings.twitch = {};
  config.settings.twitch.announcement_channel_id = channelId;

  getDashboardCore().markUnsavedChanges();
}

function handlePingRolesChange(e) {
  const config = getDashboardCore().state.guildConfig;

  // Ping Roles are PER-STREAMER only - must have a streamer selected
  if (TwitchFeature.state.selectedStreamerIndex === null) return;

  const selectedOptions = Array.from(e.target.selectedOptions);

  const mentionEveryone = selectedOptions.some(opt => opt.value === 'everyone');
  const mentionHere = selectedOptions.some(opt => opt.value === 'here');
  const roleIds = selectedOptions
    .filter(opt => opt.value !== 'everyone' && opt.value !== 'here' && !opt.disabled)
    .map(opt => opt.value);

  // Update selected streamer's mentions
  const streamers = config.settings.twitch.tracked_streamers;
  streamers[TwitchFeature.state.selectedStreamerIndex].mention_everyone = mentionEveryone;
  streamers[TwitchFeature.state.selectedStreamerIndex].mention_here = mentionHere;
  streamers[TwitchFeature.state.selectedStreamerIndex].mention_role_ids = roleIds;

  getDashboardCore().markUnsavedChanges();
}

function handleAnnouncementMessageChange(e) {
  const config = getDashboardCore().state.guildConfig;
  const message = e.target.value;

  if (TwitchFeature.state.selectedStreamerIndex !== null) {
    // Update selected streamer's custom message
    const streamers = config.settings.twitch.tracked_streamers;
    streamers[TwitchFeature.state.selectedStreamerIndex].custom_message = message;
  } else {
    // Update global message
    if (!config.settings.twitch) config.settings.twitch = {};
    config.settings.twitch.announcement_message = message;
  }

  getDashboardCore().markUnsavedChanges();
}

// ===== SAVE FUNCTIONALITY =====
async function saveTwitchChangesInternal() {
  const config = getDashboardCore().state.guildConfig;

  if (!config.settings) {
    config.settings = {};
  }

  // Save via DashboardCore
  const success = await getDashboardCore().saveGuildConfig({
    twitch: config.settings.twitch
  });

  if (success) {
    // Update save button UI
    const saveBtn = document.getElementById('saveButton');
    if (saveBtn) {
      saveBtn.disabled = true;
      getDashboardCore().clearUnsavedChanges();
    }
  }
}

// ===== UTILITY =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Make functions globally accessible for onclick handlers (Twitch-specific namespace to avoid collision)
window.addTwitchStreamer = function() { TwitchFeature.addStreamer(); };
window.removeTwitchStreamer = function(index) { TwitchFeature.removeStreamer(index); };
window.saveTwitchChanges = function() { TwitchFeature.saveAllChanges(); };
window.selectTwitchStreamer = function(index) { TwitchFeature.selectStreamer(index); };
window.clearTwitchStreamerSelection = function() { TwitchFeature.clearStreamerSelection(); };

// Export feature module for SPA
window.TwitchFeature = TwitchFeature;

// MPA backwards compatibility - auto-init if not in SPA mode
if (!window.Router) {
  document.addEventListener('DOMContentLoaded', async () => {
    await TwitchFeature.init();
  });
}
