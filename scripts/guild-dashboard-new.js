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

    const response = await fetch(`${API_BASE_URL}/api/user`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (data.success && data.user) {
      state.currentUser = data.user;
      renderUserAvatar(data.user);
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
    const avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
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
  const countElement = document.getElementById('streamerCount');
  const maxStreamers = 10;

  if (!container) return;

  // Update count
  if (countElement) {
    countElement.textContent = `${streamers.length} / ${maxStreamers}`;
  }

  if (streamers.length === 0) {
    // Empty state
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-circle"></div>
        <p>You're not following anyone yet</p>
      </div>
    `;
  } else {
    // Streamer cards
    container.innerHTML = `
      <div class="streamers-list">
        ${streamers.map((streamer, index) => createStreamerCard(streamer, index)).join('')}
      </div>
    `;
  }

  // Update add button state
  const addBtn = document.querySelector('.btn-add-streamer');
  if (addBtn) {
    addBtn.disabled = streamers.length >= maxStreamers;
  }
}

function createStreamerCard(streamer, index) {
  const roleCount = streamer.mention_role_ids?.length || 0;
  const hasCustomMessage = !!streamer.custom_message;

  return `
    <div class="streamer-card">
      <div class="streamer-header">
        <div class="streamer-info">
          <h4>${escapeHtml(streamer.username)}</h4>
          <span class="platform-badge">Twitch</span>
        </div>
      </div>
      ${roleCount > 0 || hasCustomMessage ? `
      <div class="streamer-details">
        ${roleCount > 0 ? `<div>📢 Pings ${roleCount} role(s)</div>` : ''}
        ${hasCustomMessage ? `<div>✉️ Custom message set</div>` : ''}
      </div>
      ` : ''}
      <div class="streamer-actions">
        <button class="btn-secondary" onclick="editStreamer(${index})">Edit</button>
        <button class="btn-danger" onclick="removeStreamer(${index})">Remove</button>
      </div>
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

  // Show modal/form to edit streamer
  // For MVP: use prompt (later replace with modal)
  const username = prompt('Enter Twitch username:');
  if (!username) return;

  newStreamer.username = username.trim();

  state.guildConfig.settings.twitch.tracked_streamers.push(newStreamer);
  renderStreamerList(state.guildConfig.settings.twitch.tracked_streamers);
  markUnsavedChanges();
}

function editStreamer(index) {
  if (!state.guildConfig.settings?.twitch?.tracked_streamers) {
    console.error('No streamers to edit');
    return;
  }

  const streamers = state.guildConfig.settings.twitch.tracked_streamers;
  const streamer = streamers[index];

  // For MVP: use prompt (later replace with modal)
  const newUsername = prompt('Edit Twitch username:', streamer.username);
  if (newUsername === null) return;

  streamer.username = newUsername.trim();
  renderStreamerList(streamers);
  markUnsavedChanges();
}

function removeStreamer(index) {
  if (!state.guildConfig.settings?.twitch?.tracked_streamers) {
    console.error('No streamers to remove');
    return;
  }

  if (!confirm('Are you sure you want to remove this streamer?')) {
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
window.editStreamer = editStreamer;
window.removeStreamer = removeStreamer;
window.saveAllChanges = saveAllChanges;
