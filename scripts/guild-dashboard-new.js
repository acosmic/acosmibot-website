// ===== CONSTANTS =====
const API_BASE_URL = 'https://api.acosmibot.com';

// ===== STATE MANAGEMENT =====
let state = {
  userGuilds: [],
  currentGuildId: null,
  guildConfig: null,
  currentUser: null,
  hasUnsavedChanges: false,
  isSaving: false,
  isLoading: false,
  selectedStreamerIndex: null,
  validationTimeouts: {} // Track timeouts by streamer index for auto-hiding validation
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', initDashboard);

async function initDashboard() {
  // 1. Get guild ID from URL query params
  const urlParams = new URLSearchParams(window.location.search);
  state.currentGuildId = urlParams.get('guild');

  // 2. Validate guild ID exists
  if (!state.currentGuildId) {
    showError('No guild specified');
    window.location.href = '/overview';
    return;
  }

  // 3. Load user data and avatar
  await loadCurrentUser();

  // 4. Load user's guilds and current config
  await loadUserGuilds();
  await loadGuildConfig(state.currentGuildId);

  // 5. Setup event listeners
  setupEventListeners();
}

// ===== USER DATA LOADING =====
async function loadCurrentUser() {
  try {
    const token = localStorage.getItem('discord_token');
    if (!token) {
      window.location.href = '/auth/login';
      return;
    }

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      console.error('Failed to load user:', response.status);
      return;
    }

    const user = await response.json();
    if (user && !user.error) {
      state.currentUser = user;
      renderUserAvatar(user);
    }
  } catch (error) {
    console.error('User loading error:', error);
    // Non-critical error, continue anyway
  }
}

function renderUserAvatar(user) {
  const avatarElement = document.querySelector('.user-avatar');
  if (!avatarElement) return;

  if (user.avatar) {
    // Check if avatar is already a full URL or just a hash
    const avatarUrl = user.avatar.startsWith('http')
      ? user.avatar
      : `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
    avatarElement.style.backgroundImage = `url('${avatarUrl}')`;
    avatarElement.style.backgroundSize = 'cover';
    avatarElement.style.backgroundPosition = 'center';
  } else {
    // Fallback: first letter of username
    avatarElement.textContent = (user.username || user.global_name || 'U').charAt(0).toUpperCase();
    avatarElement.style.display = 'flex';
    avatarElement.style.alignItems = 'center';
    avatarElement.style.justifyContent = 'center';
    avatarElement.style.fontSize = '20px';
    avatarElement.style.fontWeight = 'bold';
    avatarElement.style.color = 'white';
  }

  avatarElement.title = user.global_name || user.username || 'User';
}

// ===== GUILD LOADING & RENDERING =====
async function loadUserGuilds() {
  try {
    const token = localStorage.getItem('discord_token');
    if (!token) {
      window.location.href = '/auth/login';
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/user/guilds`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (data.success) {
      state.userGuilds = data.guilds;
      renderGuildIcons();
    } else {
      throw new Error('Failed to load guilds');
    }
  } catch (error) {
    console.error('Guild loading error:', error);
    showError('Failed to load your servers');
  }
}

function renderGuildIcons() {
  const container = document.getElementById('guildIconList');
  if (!container) return;

  container.innerHTML = '';

  state.userGuilds.forEach(guild => {
    const iconDiv = document.createElement('div');
    iconDiv.className = `guild-icon ${guild.id === state.currentGuildId ? 'active' : ''}`;
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

    iconDiv.addEventListener('click', () => switchGuild(guild.id));
    container.appendChild(iconDiv);
  });
}

async function switchGuild(guildId) {
  if (state.hasUnsavedChanges) {
    if (!confirm('You have unsaved changes. Continue without saving?')) {
      return;
    }
  }

  // Clear streamer selection when switching guilds
  clearStreamerSelection();

  // Update URL without page reload
  window.history.pushState({}, '', `?guild=${guildId}`);
  state.currentGuildId = guildId;

  // Update active indicator
  document.querySelectorAll('.guild-icon').forEach(icon => {
    icon.classList.toggle('active', icon.dataset.guildId === guildId);
  });

  // Load new config
  await loadGuildConfig(guildId);
}

// ===== CONFIG LOADING & UI POPULATION =====
async function loadGuildConfig(guildId) {
  try {
    showLoading(true);
    const token = localStorage.getItem('discord_token');

    const response = await fetch(`${API_BASE_URL}/api/guilds/${guildId}/config-hybrid`, {
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
    state.guildConfig = data.data; // Access the nested 'data' property

    // Populate all UI elements
    populateUI(state.guildConfig);

  } catch (error) {
    console.error('Config loading error:', error);
    showError('Failed to load guild configuration');
  } finally {
    showLoading(false);
  }
}

function populateUI(config) {
  // Ensure settings exists
  if (!config.settings) {
    config.settings = {};
  }

  // Ensure twitch settings exists
  if (!config.settings.twitch) {
    config.settings.twitch = {};
  }

  // 1. Feature toggle
  const featureToggle = document.querySelector('.toggle-switch input');
  if (featureToggle) {
    featureToggle.checked = config.settings.twitch.enabled !== false;
    featureToggle.addEventListener('change', (e) => {
      config.settings.twitch.enabled = e.target.checked;
      markUnsavedChanges();
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
  const isSelected = state.selectedStreamerIndex === index;
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
  // Ensure settings structure exists
  if (!state.guildConfig.settings) {
    state.guildConfig.settings = {};
  }
  if (!state.guildConfig.settings.twitch) {
    state.guildConfig.settings.twitch = {};
  }
  if (!state.guildConfig.settings.twitch.tracked_streamers) {
    state.guildConfig.settings.twitch.tracked_streamers = [];
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

  const streamers = state.guildConfig.settings.twitch.tracked_streamers;
  streamers.push(newStreamer);

  renderStreamerList(streamers);
  markUnsavedChanges();

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
  if (!state.guildConfig.settings?.twitch?.tracked_streamers) return;

  const streamers = state.guildConfig.settings.twitch.tracked_streamers;
  streamers[index].username = value;

  // Clear previous validation when username changes
  if (streamers[index].isValid) {
    streamers[index].isValid = false;
    renderStreamerList(streamers);
  }

  // Clear validation timeout if it exists
  if (state.validationTimeouts[index]) {
    clearTimeout(state.validationTimeouts[index]);
    delete state.validationTimeouts[index];
  }

  // Update selected streamer name indicator if this streamer is selected
  if (state.selectedStreamerIndex === index) {
    const nameSpan = document.getElementById('selectedStreamerNameIndicator');
    if (nameSpan) {
      nameSpan.textContent = value || 'New Streamer';
    }
  }

  markUnsavedChanges();
}

async function validateStreamer(index, username) {
  if (!state.guildConfig.settings?.twitch?.tracked_streamers) return;
  if (!username || username.trim() === '') return;

  const streamers = state.guildConfig.settings.twitch.tracked_streamers;
  const streamer = streamers[index];

  // Clear any existing timeout for this streamer
  if (state.validationTimeouts[index]) {
    clearTimeout(state.validationTimeouts[index]);
    delete state.validationTimeouts[index];
  }

  // Set validating state
  streamer.validating = true;
  streamer.hideValidation = false; // Show validation during process
  renderStreamerList(streamers);

  try {
    const token = localStorage.getItem('discord_token');
    const response = await fetch(`${API_BASE_URL}/api/twitch/validate-username`, {
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
      state.validationTimeouts[index] = setTimeout(() => {
        streamer.hideValidation = true;
        renderStreamerList(streamers);
        delete state.validationTimeouts[index];
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
  if (!state.guildConfig.settings?.twitch?.tracked_streamers) {
    console.error('No streamers to remove');
    return;
  }

  const streamers = state.guildConfig.settings.twitch.tracked_streamers;
  streamers.splice(index, 1);

  // Clear selection if the deleted streamer was selected
  if (state.selectedStreamerIndex === index) {
    clearStreamerSelection();
  } else if (state.selectedStreamerIndex !== null && state.selectedStreamerIndex > index) {
    // Adjust selected index if it was after the deleted streamer
    state.selectedStreamerIndex--;
  }

  renderStreamerList(streamers);
  markUnsavedChanges();
}

// ===== SAVE FUNCTIONALITY =====
function markUnsavedChanges() {
  state.hasUnsavedChanges = true;
  const saveBtn = document.getElementById('saveButton');
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.classList.add('has-changes');
    const indicator = saveBtn.querySelector('.unsaved-indicator');
    if (indicator) indicator.style.display = 'inline';
  }
}

async function saveAllChanges() {
  if (state.isSaving) return;

  try {
    state.isSaving = true;
    const saveBtn = document.getElementById('saveButton');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '💾 Saving...';
    saveBtn.disabled = true;

    // Ensure settings structure exists before saving
    if (!state.guildConfig.settings) {
      state.guildConfig.settings = {};
    }

    const token = localStorage.getItem('discord_token');
    const response = await fetch(`${API_BASE_URL}/api/guilds/${state.currentGuildId}/config-hybrid`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ settings: state.guildConfig.settings })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Success
    state.hasUnsavedChanges = false;
    saveBtn.classList.remove('has-changes');
    const indicator = saveBtn.querySelector('.unsaved-indicator');
    if (indicator) indicator.style.display = 'none';

    showSuccess('Changes saved successfully!');

  } catch (error) {
    console.error('Save error:', error);
    showError('Failed to save changes. Please try again.');
  } finally {
    state.isSaving = false;
    const saveBtn = document.getElementById('saveButton');
    saveBtn.innerHTML = '<span class="save-icon">💾</span> Save Changes <span class="unsaved-indicator" style="display: none;">●</span>';
    saveBtn.disabled = !state.hasUnsavedChanges;
  }
}

// ===== PER-STREAMER SETTINGS =====
function selectStreamer(index) {
  if (!state.guildConfig.settings?.twitch?.tracked_streamers) return;

  const streamers = state.guildConfig.settings.twitch.tracked_streamers;
  const streamer = streamers[index];
  if (!streamer) return;

  // Update selected index
  state.selectedStreamerIndex = index;

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
                   state.guildConfig.settings.twitch?.announcement_message ||
                   '{username} is live!';
    messageTextarea.value = message;
  }
}

function clearStreamerSelection() {
  state.selectedStreamerIndex = null;

  // Hide selected streamer indicator
  const indicator = document.getElementById('selectedStreamerIndicator');
  if (indicator) {
    indicator.style.display = 'none';
  }

  // Re-render to remove selected class
  if (state.guildConfig.settings?.twitch?.tracked_streamers) {
    renderStreamerList(state.guildConfig.settings.twitch.tracked_streamers);
  }

  // Reset form fields to global defaults
  populateFormFieldsWithGlobalDefaults();
}

function populateFormFieldsWithGlobalDefaults() {
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
    messageTextarea.value = state.guildConfig.settings.twitch?.announcement_message || '{username} is live!';
  }
}

// ===== FORM FIELD CHANGE HANDLERS =====
function handleChannelChange(e) {
  const channelId = e.target.value || null;

  // Channel is ALWAYS global - applies to all streamers
  if (!state.guildConfig.settings.twitch) state.guildConfig.settings.twitch = {};
  state.guildConfig.settings.twitch.announcement_channel_id = channelId;

  markUnsavedChanges();
}

function handlePingRolesChange(e) {
  // Ping Roles are PER-STREAMER only - must have a streamer selected
  if (state.selectedStreamerIndex === null) return;

  const selectedOptions = Array.from(e.target.selectedOptions);

  const mentionEveryone = selectedOptions.some(opt => opt.value === 'everyone');
  const mentionHere = selectedOptions.some(opt => opt.value === 'here');
  const roleIds = selectedOptions
    .filter(opt => opt.value !== 'everyone' && opt.value !== 'here' && !opt.disabled)
    .map(opt => opt.value);

  // Update selected streamer's mentions
  const streamers = state.guildConfig.settings.twitch.tracked_streamers;
  streamers[state.selectedStreamerIndex].mention_everyone = mentionEveryone;
  streamers[state.selectedStreamerIndex].mention_here = mentionHere;
  streamers[state.selectedStreamerIndex].mention_role_ids = roleIds;

  markUnsavedChanges();
}

function handleAnnouncementMessageChange(e) {
  const message = e.target.value;

  if (state.selectedStreamerIndex !== null) {
    // Update selected streamer's custom message
    const streamers = state.guildConfig.settings.twitch.tracked_streamers;
    streamers[state.selectedStreamerIndex].custom_message = message;
  } else {
    // Update global message
    if (!state.guildConfig.settings.twitch) state.guildConfig.settings.twitch = {};
    state.guildConfig.settings.twitch.announcement_message = message;
  }

  markUnsavedChanges();
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  // Warn before page unload with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (state.hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
  });
}

// ===== UTILITY FUNCTIONS =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showLoading(show) {
  // TODO: Add loading spinner overlay
  console.log('Loading:', show);
}

function showError(message) {
  // TODO: Replace with toast notification
  alert('Error: ' + message);
}

function showSuccess(message) {
  // TODO: Replace with toast notification
  alert('Success: ' + message);
}

// Make functions globally accessible for onclick handlers
window.addStreamer = addStreamer;
window.removeStreamer = removeStreamer;
window.saveAllChanges = saveAllChanges;
window.clearStreamerSelection = clearStreamerSelection;
