// ===== YOUTUBE ALERTS FEATURE =====
// Feature-specific logic for YouTube streaming/video alerts

// Feature module pattern for SPA compatibility
// Note: Module name must match FeatureLoader convention: 'youtube' -> 'YoutubeFeature'
const YoutubeFeature = {
  // ===== FEATURE STATE =====
  state: {
    selectedStreamerIndex: null,
    validationTimeouts: {} // Track timeouts by streamer index for auto-hiding validation
  },

  // ===== INITIALIZATION =====
  async init() {
    console.log('YouTube feature initialized');
    const { DashboardCore, Router } = window;

    // Initialize shared core for SPA
    if (Router) {
      // SPA mode - use lighter init
      await DashboardCore.initForSPA('youtube');
    } else {
      // MPA mode - use full init (for backwards compatibility)
      await DashboardCore.init('youtube');
    }

    // Populate YouTube-specific UI
    populateYouTubeUI();
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
  addStreamer() { addYoutubeStreamerInternal(); },
  removeStreamer(index) { removeYoutubeStreamerInternal(index); },
  saveAllChanges() { saveYoutubeChangesInternal(); },
  selectStreamer(index) { selectYoutubeStreamerInternal(index); },
  clearStreamerSelection() { clearYoutubeStreamerSelectionInternal(); },
};

// Helper to get DashboardCore instance
function getDashboardCore() {
  return window.DashboardCore;
}

// ===== UI POPULATION =====
function populateYouTubeUI() {
  const config = getDashboardCore().state.guildConfig;

  console.log('populateYouTubeUI - config:', config);
  console.log('populateYouTubeUI - settings.youtube:', config?.settings?.youtube);

  // Ensure settings exists
  if (!config.settings) {
    config.settings = {};
  }

  // Ensure youtube settings exists (but don't overwrite if it has data)
  if (!config.settings.youtube) {
    config.settings.youtube = {};
  }

  // 1. Feature toggle
  const featureToggle = document.getElementById('featureToggle');
  if (featureToggle) {
    featureToggle.checked = config.settings.youtube.enabled !== false;
    featureToggle.addEventListener('change', (e) => {
      config.settings.youtube.enabled = e.target.checked;
      getDashboardCore().markUnsavedChanges();
    });
  }

  // 2. Channel dropdown (GLOBAL)
  const channelSelect = document.getElementById('channelSelect');
  console.log('populateYouTubeUI - channelSelect element:', channelSelect);
  console.log('populateYouTubeUI - available_channels:', config.available_channels?.length);

  if (channelSelect && config.available_channels) {
    channelSelect.innerHTML = '<option value="">Select a channel...</option>';
    config.available_channels.forEach(channel => {
      // Only include text channels (type 0) and announcement channels (type 5)
      if (channel.type !== 0 && channel.type !== 5) return;

      const option = document.createElement('option');
      option.value = channel.id;
      option.textContent = `#${channel.name}`;
      channelSelect.appendChild(option);
    });

    // Populate with global default
    const announcementChannelId = config.settings.youtube?.announcement_channel_id || '';
    console.log('populateYouTubeUI - setting channel to:', announcementChannelId);
    channelSelect.value = announcementChannelId;

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
    messageTextarea.value = config.settings.youtube?.announcement_message || '{username} uploaded a new video!';
    messageTextarea.disabled = true; // Start disabled until a streamer is selected
    messageTextarea.addEventListener('input', handleAnnouncementMessageChange);
  }

  // 5. Streamers list
  const streamers = config.settings.youtube?.tracked_streamers || [];
  console.log('populateYouTubeUI - tracked_streamers:', streamers);
  renderYoutubeStreamerList(streamers);

  // 6. Update streamer limit display
  updateYoutubeStreamerLimitDisplay();
}

// ===== STREAMER CRUD OPERATIONS =====
function updateYoutubeStreamerLimitDisplay() {
  const config = getDashboardCore().state.guildConfig;
  const streamers = config.settings.youtube?.tracked_streamers || [];
  const premiumTier = config.premium_tier || 'free';
  const maxStreamers = premiumTier === 'premium' ? 5 : 1;

  const limitDisplay = document.getElementById('streamerLimitDisplay');
  if (limitDisplay) {
    limitDisplay.textContent = `${streamers.length} of ${maxStreamers}`;
  }
}

function renderYoutubeStreamerList(streamers) {
  const container = document.getElementById('streamersList');
  const config = getDashboardCore().state.guildConfig;
  const premiumTier = config.premium_tier || 'free';
  const maxStreamers = premiumTier === 'premium' ? 5 : 1;

  console.log('renderStreamerList - container:', container, 'streamers count:', streamers?.length);

  if (!container) return;

  // Render all streamers as input rows
  container.innerHTML = streamers.map((streamer, index) =>
    createYoutubeStreamerInputRow(streamer, index)
  ).join('');

  // Add event listeners for all inputs and rows
  streamers.forEach((streamer, index) => {
    const input = document.getElementById(`streamer-input-${index}`);
    const row = document.getElementById(`streamer-row-${index}`);

    if (input) {
      input.addEventListener('input', (e) => handleYoutubeStreamerInput(index, e.target.value));
      input.addEventListener('blur', (e) => validateYoutubeStreamer(index, e.target.value));
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
        selectYoutubeStreamerInternal(index);
      });
    }
  });

  // Update add button state
  const addBtn = document.querySelector('.btn-add-streamer');
  if (addBtn) {
    addBtn.disabled = streamers.length >= maxStreamers;
  }
}

function createYoutubeStreamerInputRow(streamer, index) {
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
  const isSelected = YoutubeFeature.state.selectedStreamerIndex === index;
  const selectedClass = isSelected ? 'selected' : '';

  return `
    <div class="stream-input-group ${selectedClass}" id="streamer-row-${index}">
      <input
        type="text"
        class="stream-input"
        id="streamer-input-${index}"
        placeholder="YouTube Channel Name"
        value="${escapeHtml(streamer.username || '')}"
      />
      <div class="validation-indicator ${validationClass}">
        ${validationIcon}
      </div>
      <button class="edit-btn" onclick="selectYoutubeStreamer(${index})">✎</button>
      <button class="delete-btn" onclick="removeYoutubeStreamer(${index})">×</button>
    </div>
  `;
}

function addYoutubeStreamerInternal() {
  const config = getDashboardCore().state.guildConfig;

  // Ensure settings structure exists
  if (!config.settings) {
    config.settings = {};
  }
  if (!config.settings.youtube) {
    config.settings.youtube = {};
  }
  if (!config.settings.youtube.tracked_streamers) {
    config.settings.youtube.tracked_streamers = [];
  }

  const newStreamer = {
    username: '',
    channel_id: null,
    isValid: false,
    mention_role_ids: [],
    mention_everyone: false,
    mention_here: false,
    custom_message: null,
    platform: 'youtube',
    skip_vod_check: false
  };

  const streamers = config.settings.youtube.tracked_streamers;
  streamers.push(newStreamer);

  renderYoutubeStreamerList(streamers);
  updateYoutubeStreamerLimitDisplay();
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

function handleYoutubeStreamerInput(index, value) {
  const config = getDashboardCore().state.guildConfig;
  if (!config.settings?.youtube?.tracked_streamers) return;

  const streamers = config.settings.youtube.tracked_streamers;
  streamers[index].username = value;

  // Clear previous validation when username changes
  if (streamers[index].isValid) {
    streamers[index].isValid = false;
    renderYoutubeStreamerList(streamers);
  }

  // Clear validation timeout if it exists
  if (YoutubeFeature.state.validationTimeouts[index]) {
    clearTimeout(YoutubeFeature.state.validationTimeouts[index]);
    delete YoutubeFeature.state.validationTimeouts[index];
  }

  // Update selected streamer name indicator if this streamer is selected
  if (YoutubeFeature.state.selectedStreamerIndex === index) {
    const nameSpan = document.getElementById('selectedStreamerNameIndicator');
    if (nameSpan) {
      nameSpan.textContent = value || 'New Channel';
    }
  }

  getDashboardCore().markUnsavedChanges();
}

async function validateYoutubeStreamer(index, username) {
  const config = getDashboardCore().state.guildConfig;
  if (!config.settings?.youtube?.tracked_streamers) return;
  if (!username || username.trim() === '') return;

  const streamers = config.settings.youtube.tracked_streamers;
  const streamer = streamers[index];

  // Clear any existing timeout for this streamer
  if (YoutubeFeature.state.validationTimeouts[index]) {
    clearTimeout(YoutubeFeature.state.validationTimeouts[index]);
    delete YoutubeFeature.state.validationTimeouts[index];
  }

  // Set validating state
  streamer.validating = true;
  streamer.hideValidation = false; // Show validation during process
  renderYoutubeStreamerList(streamers);

  try {
    const token = localStorage.getItem('discord_token');
    const response = await fetch(`${getDashboardCore().API_BASE_URL}/api/youtube/validate-channel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ identifier: username.trim() })
    });

    const data = await response.json();

    streamer.validating = false;

    if (data.success && data.valid) {
      streamer.isValid = true;
      streamer.username = username.trim();
      streamer.channel_id = data.channel_id || null;
      streamer.hideValidation = false; // Show valid checkmark initially

      // Set timeout to hide validation after 3 seconds
      YoutubeFeature.state.validationTimeouts[index] = setTimeout(() => {
        streamer.hideValidation = true;
        renderYoutubeStreamerList(streamers);
        delete YoutubeFeature.state.validationTimeouts[index];
      }, 3000);
    } else {
      streamer.isValid = false;
      streamer.hideValidation = false; // Keep showing invalid state
    }

    renderYoutubeStreamerList(streamers);
  } catch (error) {
    console.error('Validation error:', error);
    streamer.validating = false;
    streamer.isValid = false;
    streamer.hideValidation = false;
    renderYoutubeStreamerList(streamers);
  }
}

function removeYoutubeStreamerInternal(index) {
  const config = getDashboardCore().state.guildConfig;
  if (!config.settings?.youtube?.tracked_streamers) {
    console.error('No streamers to remove');
    return;
  }

  const streamers = config.settings.youtube.tracked_streamers;
  streamers.splice(index, 1);

  // Clear selection if the deleted streamer was selected
  if (YoutubeFeature.state.selectedStreamerIndex === index) {
    clearYoutubeStreamerSelectionInternal();
  } else if (YoutubeFeature.state.selectedStreamerIndex !== null && YoutubeFeature.state.selectedStreamerIndex > index) {
    // Adjust selected index if it was after the deleted streamer
    YoutubeFeature.state.selectedStreamerIndex--;
  }

  renderYoutubeStreamerList(streamers);
  updateYoutubeStreamerLimitDisplay();
  getDashboardCore().markUnsavedChanges();
}

// ===== PER-STREAMER SETTINGS =====
function selectYoutubeStreamerInternal(index) {
  const config = getDashboardCore().state.guildConfig;
  if (!config.settings?.youtube?.tracked_streamers) return;

  const streamers = config.settings.youtube.tracked_streamers;
  const streamer = streamers[index];
  if (!streamer) return;

  // Update selected index
  YoutubeFeature.state.selectedStreamerIndex = index;

  // Update UI to show selection
  renderYoutubeStreamerList(streamers);

  // Populate form fields with this streamer's data
  populateYoutubeFormFieldsForStreamer(streamer);

  // Show selected streamer indicator
  const indicator = document.getElementById('selectedStreamerIndicator');
  const nameSpan = document.getElementById('selectedStreamerNameIndicator');
  if (indicator && nameSpan) {
    nameSpan.textContent = streamer.username || 'New Channel';
    indicator.style.display = 'flex';
  }
}

function populateYoutubeFormFieldsForStreamer(streamer) {
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
                   config.settings.youtube?.announcement_message ||
                   '{username} uploaded a new video!';
    messageTextarea.value = message;
  }
}

function clearYoutubeStreamerSelectionInternal() {
  const config = getDashboardCore().state.guildConfig;
  YoutubeFeature.state.selectedStreamerIndex = null;

  // Hide selected streamer indicator
  const indicator = document.getElementById('selectedStreamerIndicator');
  if (indicator) {
    indicator.style.display = 'none';
  }

  // Re-render to remove selected class
  if (config.settings?.youtube?.tracked_streamers) {
    renderStreamerList(config.settings.youtube.tracked_streamers);
  }

  // Reset form fields to global defaults
  populateYoutubeFormFieldsWithGlobalDefaults();
}

function populateYoutubeFormFieldsWithGlobalDefaults() {
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
    messageTextarea.value = config.settings.youtube?.announcement_message || '{username} uploaded a new video!';
  }
}

// ===== FORM FIELD CHANGE HANDLERS =====
function handleChannelChange(e) {
  const config = getDashboardCore().state.guildConfig;
  const channelId = e.target.value || null;

  // Channel is ALWAYS global - applies to all streamers
  if (!config.settings.youtube) config.settings.youtube = {};
  config.settings.youtube.announcement_channel_id = channelId;

  getDashboardCore().markUnsavedChanges();
}

function handlePingRolesChange(e) {
  const config = getDashboardCore().state.guildConfig;

  // Ping Roles are PER-STREAMER only - must have a streamer selected
  if (YoutubeFeature.state.selectedStreamerIndex === null) return;

  const selectedOptions = Array.from(e.target.selectedOptions);

  const mentionEveryone = selectedOptions.some(opt => opt.value === 'everyone');
  const mentionHere = selectedOptions.some(opt => opt.value === 'here');
  const roleIds = selectedOptions
    .filter(opt => opt.value !== 'everyone' && opt.value !== 'here' && !opt.disabled)
    .map(opt => opt.value);

  // Update selected streamer's mentions
  const streamers = config.settings.youtube.tracked_streamers;
  streamers[YoutubeFeature.state.selectedStreamerIndex].mention_everyone = mentionEveryone;
  streamers[YoutubeFeature.state.selectedStreamerIndex].mention_here = mentionHere;
  streamers[YoutubeFeature.state.selectedStreamerIndex].mention_role_ids = roleIds;

  getDashboardCore().markUnsavedChanges();
}

function handleAnnouncementMessageChange(e) {
  const config = getDashboardCore().state.guildConfig;
  const message = e.target.value;

  if (YoutubeFeature.state.selectedStreamerIndex !== null) {
    // Update selected streamer's custom message
    const streamers = config.settings.youtube.tracked_streamers;
    streamers[YoutubeFeature.state.selectedStreamerIndex].custom_message = message;
  } else {
    // Update global message
    if (!config.settings.youtube) config.settings.youtube = {};
    config.settings.youtube.announcement_message = message;
  }

  getDashboardCore().markUnsavedChanges();
}

// ===== SAVE FUNCTIONALITY =====
async function saveYoutubeChangesInternal() {
  const config = getDashboardCore().state.guildConfig;

  if (!config.settings) {
    config.settings = {};
  }

  // Save via DashboardCore
  const success = await getDashboardCore().saveGuildConfig({
    youtube: config.settings.youtube
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

// Make functions globally accessible for onclick handlers (YouTube-specific namespace to avoid collision)
window.addYoutubeStreamer = function() { YoutubeFeature.addStreamer(); };
window.removeYoutubeStreamer = function(index) { YoutubeFeature.removeStreamer(index); };
window.saveYoutubeChanges = function() { YoutubeFeature.saveAllChanges(); };
window.selectYoutubeStreamer = function(index) { YoutubeFeature.selectStreamer(index); };
window.clearYoutubeStreamerSelection = function() { YoutubeFeature.clearStreamerSelection(); };

// Export feature module for SPA
window.YoutubeFeature = YoutubeFeature;

// MPA backwards compatibility - auto-init if not in SPA mode
if (!window.Router) {
  document.addEventListener('DOMContentLoaded', async () => {
    await YoutubeFeature.init();
  });
}
