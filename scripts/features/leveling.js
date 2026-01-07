// ===== LEVELING SYSTEM FEATURE =====
// Feature-specific logic for leveling system configuration

// Feature module pattern for SPA compatibility
const LevelingFeature = {
  // ===== FEATURE STATE =====
  state: {
    initialized: false
  },

  // ===== INITIALIZATION =====
  async init() {
    console.log('Leveling feature initialized');
    const { DashboardCore, Router } = window;

    // Initialize shared core for SPA
    if (Router) {
      // SPA mode - use lighter init
      await DashboardCore.initForSPA('leveling');
    } else {
      // MPA mode - use full init (for backwards compatibility)
      await DashboardCore.init('leveling');
    }

    // Populate Leveling-specific UI
    populateLevelingUI();
    this.state.initialized = true;
  },

  // ===== CLEANUP =====
  async cleanup() {
    console.log('Leveling feature cleanup');
    this.state.initialized = false;
    // Event listeners attached via onclick in HTML don't need cleanup
    // They're removed automatically when the DOM element is removed
  },
};

// Helper to get DashboardCore instance
function getDashboardCore() {
  return window.DashboardCore;
}

// ===== UI POPULATION =====
function populateLevelingUI() {
  const config = getDashboardCore().state.guildConfig;

  // Ensure settings structures exist
  if (!config.settings) {
    config.settings = {};
  }
  if (!config.settings.leveling) {
    config.settings.leveling = {};
  }
  if (!config.settings.roles) {
    config.settings.roles = {};
  }

  const levelingSettings = config.settings.leveling;
  const rolesSettings = config.settings.roles;

  // 1. Master feature toggle
  const featureToggle = document.getElementById('featureToggle');
  if (featureToggle) {
    featureToggle.checked = levelingSettings.enabled !== false;
    featureToggle.addEventListener('change', (e) => {
      levelingSettings.enabled = e.target.checked;
      getDashboardCore().markUnsavedChanges();
      updateMasterToggleState(e.target.checked);
    });
  }

  // 2. Level Announcement Section
  setupLevelAnnouncementSection(config, levelingSettings);

  // 3. Role Assignment Section
  setupRoleAssignmentSection(config, rolesSettings);

  // 4. Role Announcement Section
  setupRoleAnnouncementSection(config, rolesSettings);

  // 5. Daily Rewards Section
  setupDailyRewardsSection(config, levelingSettings);

  // Apply initial master toggle state
  updateMasterToggleState(levelingSettings.enabled !== false);
}

// ===== SECTION SETUP FUNCTIONS =====

function setupLevelAnnouncementSection(config, levelingSettings) {
  // Toggle
  const toggle = document.getElementById('levelAnnouncementToggle');
  if (toggle) {
    toggle.checked = levelingSettings.level_up_announcements !== false;
    toggle.addEventListener('change', (e) => {
      levelingSettings.level_up_announcements = e.target.checked;
      getDashboardCore().markUnsavedChanges();
      updateSectionState('levelAnnouncementSection', e.target.checked);
    });
  }

  // Channel dropdown
  const channelSelect = document.getElementById('levelAnnouncementChannel');
  if (channelSelect) {
    populateChannelDropdown(channelSelect, config.available_channels, levelingSettings.announcement_channel_id);
    channelSelect.addEventListener('change', (e) => {
      levelingSettings.announcement_channel_id = e.target.value || null;
      getDashboardCore().markUnsavedChanges();
    });
  }

  // Message textarea
  const messageTextarea = document.getElementById('levelAnnouncementMessage');
  if (messageTextarea) {
    messageTextarea.value = levelingSettings.level_up_message_with_streak ||
                           levelingSettings.level_up_message ||
                           '{username}, you have reached level {level}!';
    messageTextarea.addEventListener('input', (e) => {
      levelingSettings.level_up_message_with_streak = e.target.value;
      levelingSettings.level_up_message = e.target.value;
      getDashboardCore().markUnsavedChanges();
    });
  }

  // Apply initial state
  updateSectionState('levelAnnouncementSection', levelingSettings.level_up_announcements !== false);
}

function setupRoleAssignmentSection(config, rolesSettings) {
  // Toggle
  const toggle = document.getElementById('roleAssignmentToggle');
  if (toggle) {
    toggle.checked = rolesSettings.enabled !== false;
    toggle.addEventListener('change', (e) => {
      rolesSettings.enabled = e.target.checked;
      getDashboardCore().markUnsavedChanges();
      updateSectionState('roleAssignmentSection', e.target.checked);
    });
  }

  // Mode dropdown
  const modeSelect = document.getElementById('roleAssignmentMode');
  if (modeSelect) {
    modeSelect.value = rolesSettings.mode || 'additive';
    modeSelect.addEventListener('change', (e) => {
      rolesSettings.mode = e.target.value;
      getDashboardCore().markUnsavedChanges();
    });
  }

  // Render level mappings
  renderLevelMappings(config, rolesSettings);

  // Apply initial state
  updateSectionState('roleAssignmentSection', rolesSettings.enabled !== false);
}

function setupRoleAnnouncementSection(config, rolesSettings) {
  // Toggle
  const toggle = document.getElementById('roleAnnouncementToggle');
  if (toggle) {
    toggle.checked = rolesSettings.role_announcement !== false;
    toggle.addEventListener('change', (e) => {
      rolesSettings.role_announcement = e.target.checked;
      getDashboardCore().markUnsavedChanges();
      updateSectionState('roleAnnouncementSection', e.target.checked);
    });
  }

  // Channel dropdown
  const channelSelect = document.getElementById('roleAnnouncementChannel');
  if (channelSelect) {
    populateChannelDropdown(channelSelect, config.available_channels, rolesSettings.announcement_channel_id);
    channelSelect.addEventListener('change', (e) => {
      rolesSettings.announcement_channel_id = e.target.value || null;
      getDashboardCore().markUnsavedChanges();
    });
  }

  // Apply initial state
  updateSectionState('roleAnnouncementSection', rolesSettings.role_announcement !== false);
}

function setupDailyRewardsSection(config, levelingSettings) {
  // Toggle
  const toggle = document.getElementById('dailyRewardsToggle');
  if (toggle) {
    toggle.checked = levelingSettings.daily_announcements_enabled !== false;
    toggle.addEventListener('change', (e) => {
      levelingSettings.daily_announcements_enabled = e.target.checked;
      getDashboardCore().markUnsavedChanges();
      updateSectionState('dailyRewardsSection', e.target.checked);
    });
  }

  // Channel dropdown
  const channelSelect = document.getElementById('dailyRewardsChannel');
  if (channelSelect) {
    populateChannelDropdown(channelSelect, config.available_channels, levelingSettings.daily_announcement_channel_id);
    channelSelect.addEventListener('change', (e) => {
      levelingSettings.daily_announcement_channel_id = e.target.value || null;
      getDashboardCore().markUnsavedChanges();
    });
  }

  // Message textarea
  const messageTextarea = document.getElementById('dailyRewardsMessage');
  if (messageTextarea) {
    messageTextarea.value = levelingSettings.daily_announcement_message_with_streak ||
                           levelingSettings.daily_announcement_message ||
                           '{username} claimed their daily reward!';
    messageTextarea.addEventListener('input', (e) => {
      levelingSettings.daily_announcement_message_with_streak = e.target.value;
      levelingSettings.daily_announcement_message = e.target.value;
      getDashboardCore().markUnsavedChanges();
    });
  }

  // Apply initial state
  updateSectionState('dailyRewardsSection', levelingSettings.daily_announcements_enabled !== false);
}

// ===== DROPDOWN POPULATION =====

function populateChannelDropdown(selectElement, channels, selectedId) {
  selectElement.innerHTML = '<option value="">Select a channel...</option>';

  if (!channels || !Array.isArray(channels)) return;

  channels.forEach(channel => {
    // Only include text channels (type 0) and announcement channels (type 5)
    if (channel.type !== 0 && channel.type !== 5) return;

    const option = document.createElement('option');
    option.value = channel.id;
    option.textContent = `#${channel.name}`;
    selectElement.appendChild(option);
  });

  // Set selected value
  if (selectedId) {
    selectElement.value = selectedId;
  }
}

function createRoleDropdown(availableRoles, selectedRoleIds = []) {
  const select = document.createElement('select');
  select.className = 'role-select feature-select';
  select.innerHTML = '<option value="">Select Role...</option>';

  if (availableRoles && Array.isArray(availableRoles)) {
    availableRoles.forEach(role => {
      // Skip @everyone and managed roles
      if (role.name === '@everyone' || role.managed) return;

      const option = document.createElement('option');
      option.value = role.id;
      option.textContent = role.name;
      select.appendChild(option);
    });
  }

  // Set selected value (use first role if multiple)
  if (selectedRoleIds && selectedRoleIds.length > 0) {
    select.value = selectedRoleIds[0];
  }

  return select;
}

// ===== LEVEL MAPPINGS =====

function renderLevelMappings(config, rolesSettings) {
  const container = document.getElementById('levelMappingsList');
  if (!container) return;

  container.innerHTML = '';

  const mappings = rolesSettings.role_mappings || {};

  // Sort levels numerically
  const sortedLevels = Object.keys(mappings).sort((a, b) => parseInt(a) - parseInt(b));

  sortedLevels.forEach(level => {
    const mapping = mappings[level];
    const row = createLevelMappingRow(level, mapping, config.available_roles);
    container.appendChild(row);
  });
}

function createLevelMappingRow(level, mapping, availableRoles) {
  const row = document.createElement('div');
  row.className = 'level-mapping-row';
  row.dataset.level = level;

  // Level input
  const levelInput = document.createElement('input');
  levelInput.type = 'number';
  levelInput.className = 'level-input';
  levelInput.value = level;
  levelInput.min = '0';
  levelInput.max = '100';
  levelInput.addEventListener('change', (e) => handleLevelChange(level, e.target.value));

  // Role dropdown
  const roleSelect = createRoleDropdown(availableRoles, mapping.role_ids);
  roleSelect.addEventListener('change', (e) => handleRoleChange(level, e.target.value));

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = '×';
  deleteBtn.onclick = () => removeLevelMapping(level);

  row.appendChild(levelInput);
  row.appendChild(roleSelect);
  row.appendChild(deleteBtn);

  return row;
}

function addLevelMapping() {
  const config = getDashboardCore().state.guildConfig;
  const rolesSettings = config.settings.roles;

  if (!rolesSettings.role_mappings) {
    rolesSettings.role_mappings = {};
  }

  // Find next available level
  const existingLevels = Object.keys(rolesSettings.role_mappings).map(l => parseInt(l));
  let newLevel = 0;
  while (existingLevels.includes(newLevel)) {
    newLevel += 5;
  }

  // Create new mapping
  rolesSettings.role_mappings[newLevel.toString()] = {
    role_ids: [],
    announcement_message: `{mention} reached level ${newLevel} and earned the {role} role!`
  };

  // Re-render
  renderLevelMappings(config, rolesSettings);
  getDashboardCore().markUnsavedChanges();
}

function removeLevelMapping(level) {
  const config = getDashboardCore().state.guildConfig;
  const rolesSettings = config.settings.roles;

  if (rolesSettings.role_mappings && rolesSettings.role_mappings[level]) {
    delete rolesSettings.role_mappings[level];
    renderLevelMappings(config, rolesSettings);
    getDashboardCore().markUnsavedChanges();
  }
}

function handleLevelChange(oldLevel, newLevel) {
  const config = getDashboardCore().state.guildConfig;
  const rolesSettings = config.settings.roles;

  if (!rolesSettings.role_mappings) return;

  // If the new level already exists, don't allow the change
  if (newLevel !== oldLevel && rolesSettings.role_mappings[newLevel]) {
    // Revert the input
    const row = document.querySelector(`.level-mapping-row[data-level="${oldLevel}"]`);
    if (row) {
      const input = row.querySelector('.level-input');
      if (input) input.value = oldLevel;
    }
    return;
  }

  // Move the mapping to the new level
  const mapping = rolesSettings.role_mappings[oldLevel];
  delete rolesSettings.role_mappings[oldLevel];
  rolesSettings.role_mappings[newLevel] = mapping;

  // Update the row's data attribute
  const row = document.querySelector(`.level-mapping-row[data-level="${oldLevel}"]`);
  if (row) {
    row.dataset.level = newLevel;
  }

  getDashboardCore().markUnsavedChanges();
}

function handleRoleChange(level, roleId) {
  const config = getDashboardCore().state.guildConfig;
  const rolesSettings = config.settings.roles;

  if (rolesSettings.role_mappings && rolesSettings.role_mappings[level]) {
    rolesSettings.role_mappings[level].role_ids = roleId ? [roleId] : [];
    getDashboardCore().markUnsavedChanges();
  }
}

// ===== TOGGLE & STATE MANAGEMENT =====

function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.toggle('collapsed');
  }
}

function updateMasterToggleState(enabled) {
  // When master toggle is off, disable all sections
  const sections = ['levelAnnouncementSection', 'roleAssignmentSection', 'roleAnnouncementSection', 'dailyRewardsSection'];

  sections.forEach(sectionId => {
    const section = document.getElementById(sectionId);
    if (section) {
      if (!enabled) {
        section.classList.add('master-disabled');
        // Disable all form elements in section
        section.querySelectorAll('input, select, textarea, button').forEach(el => {
          if (!el.closest('.section-header')) {
            el.disabled = true;
          }
        });
      } else {
        section.classList.remove('master-disabled');
        // Re-enable based on individual toggle state
        const toggle = section.querySelector('.section-header input[type="checkbox"]');
        if (toggle) {
          updateSectionState(sectionId, toggle.checked);
        }
      }
    }
  });
}

function updateSectionState(sectionId, enabled) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  // Don't update if master toggle is off
  if (section.classList.contains('master-disabled')) return;

  const content = section.querySelector('.section-content');
  if (!content) return;

  const formGroups = content.querySelectorAll('.form-group');

  formGroups.forEach(group => {
    if (enabled) {
      group.classList.remove('disabled');
      group.querySelectorAll('input, select, textarea').forEach(el => {
        el.disabled = false;
      });
    } else {
      group.classList.add('disabled');
      group.querySelectorAll('input, select, textarea').forEach(el => {
        el.disabled = true;
      });
    }
  });

  // Handle add button separately
  const addBtn = content.querySelector('.btn-add-mapping');
  if (addBtn) {
    addBtn.disabled = !enabled;
  }
}

// ===== UTILITY FUNCTIONS =====

function insertVariable(textareaId, variable) {
  const textarea = document.getElementById(textareaId);
  if (!textarea || textarea.disabled) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;

  textarea.value = text.substring(0, start) + variable + text.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + variable.length;
  textarea.focus();

  // Trigger input event to update config
  textarea.dispatchEvent(new Event('input'));
}

// ===== SAVE FUNCTIONALITY =====

async function saveAllChanges() {
  const config = getDashboardCore().state.guildConfig;

  if (!config.settings) {
    config.settings = {};
  }

  // Save via DashboardCore
  const success = await getDashboardCore().saveGuildConfig({
    leveling: config.settings.leveling,
    roles: config.settings.roles
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

// Make functions globally accessible for onclick handlers
window.addLevelMapping = addLevelMapping;
window.removeLevelMapping = removeLevelMapping;
window.saveAllChanges = saveAllChanges;
window.toggleSection = toggleSection;
window.insertVariable = insertVariable;

// Export feature module for SPA
window.LevelingFeature = LevelingFeature;

// MPA backwards compatibility - auto-init if not in SPA mode
if (!window.Router) {
  document.addEventListener('DOMContentLoaded', async () => {
    await LevelingFeature.init();
  });
}
