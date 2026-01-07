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
  isLoading: false
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
    window.location.href = '/dashboard.html';
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
    state.guildConfig = data;

    // Populate all UI elements
    populateUI(data);

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

  // 2. Channel select
  const channelSelect = document.querySelector('.feature-select');
  if (channelSelect && config.available_channels) {
    channelSelect.innerHTML = '<option value="">Select a channel...</option>';
    config.available_channels.forEach(channel => {
      const option = document.createElement('option');
      option.value = channel.id;
      option.textContent = `#${channel.name}`;
      option.selected = channel.id === config.settings.twitch.announcement_channel_id;
      channelSelect.appendChild(option);
    });

    channelSelect.addEventListener('change', (e) => {
      config.settings.twitch.announcement_channel_id = e.target.value || null;
      markUnsavedChanges();
    });
  }

  // 3. Message textarea
  const messageTextarea = document.querySelector('.message-textarea');
  if (messageTextarea) {
    messageTextarea.value = config.settings.twitch.announcement_message || '{username} is live!';
    messageTextarea.addEventListener('input', (e) => {
      config.settings.twitch.announcement_message = e.target.value;
      markUnsavedChanges();
    });
  }

  // 4. Streamers list
  const streamers = config.settings.twitch.tracked_streamers || [];
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

  // Add event listeners for all inputs
  streamers.forEach((streamer, index) => {
    const input = document.getElementById(`streamer-input-${index}`);
    if (input) {
      input.addEventListener('input', (e) => handleStreamerInput(index, e.target.value));
      input.addEventListener('blur', (e) => validateStreamer(index, e.target.value));
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

  if (streamer.streamer_id) {
    validationClass = 'valid';
    validationIcon = '✓';
  } else if (streamer.username && streamer.validating) {
    validationClass = 'validating';
    validationIcon = '...';
  } else if (streamer.username && !streamer.streamer_id) {
    validationClass = 'invalid';
    validationIcon = '✗';
  }

  return `
    <div class="stream-input-group">
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
    streamer_id: null,
    platform: 'twitch',
    mention_role_ids: [],
    mention_everyone: false,
    mention_here: false,
    custom_message: null,
    skip_vod_check: false
  };

  state.guildConfig.settings.twitch.tracked_streamers.push(newStreamer);
  renderStreamerList(state.guildConfig.settings.twitch.tracked_streamers);
  markUnsavedChanges();
}

function handleStreamerInput(index, value) {
  if (!state.guildConfig.settings?.twitch?.tracked_streamers) return;

  const streamers = state.guildConfig.settings.twitch.tracked_streamers;
  streamers[index].username = value;

  // Clear previous streamer_id when username changes
  if (streamers[index].streamer_id) {
    streamers[index].streamer_id = null;
    renderStreamerList(streamers);
  }

  markUnsavedChanges();
}

async function validateStreamer(index, username) {
  if (!state.guildConfig.settings?.twitch?.tracked_streamers) return;
  if (!username || username.trim() === '') return;

  const streamers = state.guildConfig.settings.twitch.tracked_streamers;
  const streamer = streamers[index];

  // Set validating state
  streamer.validating = true;
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

    if (data.valid && data.streamer_id) {
      streamer.streamer_id = data.streamer_id;
      streamer.username = data.username || username.trim(); // Use normalized username from API
    } else {
      streamer.streamer_id = null;
    }

    renderStreamerList(streamers);
  } catch (error) {
    console.error('Validation error:', error);
    streamer.validating = false;
    streamer.streamer_id = null;
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
