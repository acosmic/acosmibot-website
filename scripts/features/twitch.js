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
    // Initialize shared core for SPA
    if (window.Router) {
      // SPA mode - use lighter init
      await DashboardCore.initForSPA('twitch');
    } else {
      // MPA mode - use full init (for backwards compatibility)
      await DashboardCore.init('twitch');
    }

    // Populate Twitch-specific UI
    populateTwitchUI();
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
};

// ===== UI POPULATION =====
function populateTwitchUI() {
  const config = DashboardCore.state.guildConfig;

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
      DashboardCore.markUnsavedChanges();
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
  renderStreamerList(streamers);
}

// ===== STREAMER CRUD OPERATIONS =====
function renderStreamerList(streamers) {
  const container = document.getElementById('streamersList');
  const maxStreamers = 10;

  if (!container) return;

  // Render all streamers as input rows
  container.innerHTML = streamers.map((streamer, index) =>
    createStreamerInputRow(streamer, index)
  ).join('');

  // Add event listeners for all inputs and rows
  streamers.forEach((streamer, index) => {
    const input = document.getElementById(`streamer-input-${index}`);
    const row = document.getElementById(`streamer-row-${index}`);

    if (input) {
      input.addEventListener('input', (e) => handleStreamerInput(index, e.target.value));
      input.addEventListener('blur', (e) => validateStreamer(index, e.target.value));
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
        selectStreamer(index);
      });
    }
  });

  // Update add button state
  const addBtn = document.querySelector('.btn-add-streamer');
  if (addBtn) {
    addBtn.disabled = streamers.length >= maxStreamers;
  }
}

function createStreamerInputRow(streamer, index) {
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
  } else if (streamer.username && !streamer.isValid && !hideValidation) {
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
      <button class="edit-btn" onclick="selectStreamer(${index})">✎</button>
      <button class="delete-btn" onclick="removeStreamer(${index})">×</button>
    </div>
  `;
}

function addStreamer() {
  const config = DashboardCore.state.guildConfig;

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

  renderStreamerList(streamers);
  DashboardCore.markUnsavedChanges();

  // Focus the username input for the new streamer (but don't auto-select)
  const newIndex = streamers.length - 1;
  setTimeout(() => {
    const input = document.getElementById(`streamer-input-${newIndex}`);
    if (input) {
      input.focus();
    }
  }, 100);
}

function handleStreamerInput(index, value) {
  const config = DashboardCore.state.guildConfig;
  if (!config.settings?.twitch?.tracked_streamers) return;

  const streamers = config.settings.twitch.tracked_streamers;
  streamers[index].username = value;

  // Clear previous validation when username changes
  if (streamers[index].isValid) {
    streamers[index].isValid = false;
    renderStreamerList(streamers);
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

  DashboardCore.markUnsavedChanges();
}

async function validateStreamer(index, username) {
  const config = DashboardCore.state.guildConfig;
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
  renderStreamerList(streamers);

  try {
    const token = localStorage.getItem('discord_token');
    const response = await fetch(`${DashboardCore.API_BASE_URL}/api/twitch/validate-username`, {
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
        renderStreamerList(streamers);
        delete TwitchFeature.state.validationTimeouts[index];
      }, 3000);
    } else {
      streamer.isValid = false;
      streamer.hideValidation = false; // Keep showing invalid state
    }

    renderStreamerList(streamers);
  } catch (error) {
    console.error('Validation error:', error);
    streamer.validating = false;
    streamer.isValid = false;
    streamer.hideValidation = false;
    renderStreamerList(streamers);
  }
}

function removeStreamer(index) {
  const config = DashboardCore.state.guildConfig;
  if (!config.settings?.twitch?.tracked_streamers) {
    console.error('No streamers to remove');
    return;
  }

  const streamers = config.settings.twitch.tracked_streamers;
  streamers.splice(index, 1);

  // Clear selection if the deleted streamer was selected
  if (TwitchFeature.state.selectedStreamerIndex === index) {
    clearStreamerSelection();
  } else if (TwitchFeature.state.selectedStreamerIndex !== null && TwitchFeature.state.selectedStreamerIndex > index) {
    // Adjust selected index if it was after the deleted streamer
    TwitchFeature.state.selectedStreamerIndex--;
  }

  renderStreamerList(streamers);
  DashboardCore.markUnsavedChanges();
}

// ===== PER-STREAMER SETTINGS =====
function selectStreamer(index) {
  const config = DashboardCore.state.guildConfig;
  if (!config.settings?.twitch?.tracked_streamers) return;

  const streamers = config.settings.twitch.tracked_streamers;
  const streamer = streamers[index];
  if (!streamer) return;

  // Update selected index
  TwitchFeature.state.selectedStreamerIndex = index;

  // Update UI to show selection
  renderStreamerList(streamers);

  // Populate form fields with this streamer's data
  populateFormFieldsForStreamer(streamer);

  // Show selected streamer indicator
  const indicator = document.getElementById('selectedStreamerIndicator');
  const nameSpan = document.getElementById('selectedStreamerNameIndicator');
  if (indicator && nameSpan) {
    nameSpan.textContent = streamer.username || 'New Streamer';
    indicator.style.display = 'flex';
  }
}

function populateFormFieldsForStreamer(streamer) {
  const config = DashboardCore.state.guildConfig;
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

function clearStreamerSelection() {
  const config = DashboardCore.state.guildConfig;
  TwitchFeature.state.selectedStreamerIndex = null;

  // Hide selected streamer indicator
  const indicator = document.getElementById('selectedStreamerIndicator');
  if (indicator) {
    indicator.style.display = 'none';
  }

  // Re-render to remove selected class
  if (config.settings?.twitch?.tracked_streamers) {
    renderStreamerList(config.settings.twitch.tracked_streamers);
  }

  // Reset form fields to global defaults
  populateFormFieldsWithGlobalDefaults();
}

function populateFormFieldsWithGlobalDefaults() {
  const config = DashboardCore.state.guildConfig;
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
  const config = DashboardCore.state.guildConfig;
  const channelId = e.target.value || null;

  // Channel is ALWAYS global - applies to all streamers
  if (!config.settings.twitch) config.settings.twitch = {};
  config.settings.twitch.announcement_channel_id = channelId;

  DashboardCore.markUnsavedChanges();
}

function handlePingRolesChange(e) {
  const config = DashboardCore.state.guildConfig;

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

  DashboardCore.markUnsavedChanges();
}

function handleAnnouncementMessageChange(e) {
  const config = DashboardCore.state.guildConfig;
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

  DashboardCore.markUnsavedChanges();
}

// ===== SAVE FUNCTIONALITY =====
async function saveAllChanges() {
  const config = DashboardCore.state.guildConfig;

  if (!config.settings) {
    config.settings = {};
  }

  // Save via DashboardCore
  const success = await DashboardCore.saveGuildConfig({
    twitch: config.settings.twitch
  });

  if (success) {
    // Update save button UI
    const saveBtn = document.getElementById('saveButton');
    if (saveBtn) {
      saveBtn.disabled = true;
      DashboardCore.clearUnsavedChanges();
    }
  }
}

// ===== UTILITY =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Make functions globally accessible for onclick handlers
window.addStreamer = addStreamer;
window.removeStreamer = removeStreamer;
window.saveAllChanges = saveAllChanges;
window.selectStreamer = selectStreamer;
window.clearStreamerSelection = clearStreamerSelection;

// Export feature module for SPA
window.TwitchFeature = TwitchFeature;

// MPA backwards compatibility - auto-init if not in SPA mode
if (!window.Router) {
  document.addEventListener('DOMContentLoaded', async () => {
    await TwitchFeature.init();
  });
}
