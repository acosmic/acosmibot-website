/**
 * Reaction Roles Feature Module
 * Handles reaction role message creation and management
 */

function getDashboardCore() {
    return window.DashboardCore;
}

const ReactionRolesFeature = {
    state: {
        initialized: false,
        messages: [],
        editingId: null,
        interactionType: 'emoji',
        roleMappings: [],
        currentEmojiIndex: null,
        currentTab: 'standard'
    },

    // Standard emojis for the picker
    standardEmojis: [
        '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟',
        '✅', '❌', '⭐', '🌟', '💫', '✨', '🎮', '🎵', '🎬', '📚',
        '💻', '🎨', '📷', '🏆', '🎯', '🔔', '💬', '📢', '🔒', '🔓',
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💗',
        '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🩷'
    ],

    async init() {
        console.log('ReactionRolesFeature.init() called');

        const dashboardCore = getDashboardCore();
        if (!dashboardCore) {
            console.error('DashboardCore not available');
            return;
        }

        await dashboardCore.initForSPA('reaction-roles');

        this.populateUI();
        this.setupEventListeners();

        this.state.initialized = true;
        console.log('ReactionRolesFeature initialized');
    },

    async cleanup() {
        console.log('ReactionRolesFeature.cleanup() called');
        this.hideForm();
        this.closeEmojiPicker();
        this.state.initialized = false;
    },

    populateUI() {
        const dashboardCore = getDashboardCore();
        const config = dashboardCore?.state?.guildConfig;

        console.log('populateReactionRolesUI - config:', config);

        if (!config) {
            console.warn('No guild config available');
            return;
        }

        // Get reaction_roles settings
        const reactionRolesConfig = config.settings?.reaction_roles || {};
        this.state.messages = reactionRolesConfig.messages || [];

        // Set feature toggle
        const featureToggle = document.getElementById('featureToggle');
        if (featureToggle) {
            featureToggle.checked = reactionRolesConfig.enabled === true;
            featureToggle.addEventListener('change', () => this.handleToggleChange());
        }

        // Populate channel dropdown
        this.populateChannelDropdown();

        // Render existing messages
        this.renderMessagesList();

        // Update UI states
        this.updateUIState();
    },

    populateChannelDropdown() {
        const dashboardCore = getDashboardCore();
        const channels = dashboardCore?.state?.guildConfig?.available_channels || [];
        const select = document.getElementById('channelSelect');

        if (!select) return;

        // Keep the first option
        select.innerHTML = '<option value="">Select a channel...</option>';

        // Filter to text channels only
        const textChannels = channels.filter(c => c.type === 0 || c.type === 'text');

        textChannels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel.id;
            option.textContent = `#${channel.name}`;
            select.appendChild(option);
        });
    },

    renderMessagesList() {
        const listContainer = document.getElementById('reactionRolesList');
        const emptyState = document.getElementById('emptyState');

        if (!listContainer) return;

        if (this.state.messages.length === 0) {
            listContainer.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        const dashboardCore = getDashboardCore();
        const channels = dashboardCore?.state?.guildConfig?.available_channels || [];
        const roles = dashboardCore?.state?.guildConfig?.available_roles || [];

        listContainer.innerHTML = this.state.messages.map((msg, index) => {
            const channel = channels.find(c => c.id === msg.channel_id);
            const channelName = channel ? `#${channel.name}` : 'Unknown Channel';

            // Parse role mappings
            let mappingsHtml = '';
            if (msg.interaction_type === 'emoji' && msg.emoji_role_mappings) {
                const mappings = this.parseEmojiMappings(msg.emoji_role_mappings);
                mappingsHtml = mappings.map(m => {
                    const role = roles.find(r => m.roleIds.includes(r.id));
                    const roleName = role ? role.name : 'Unknown Role';
                    const emojiDisplay = this.getEmojiDisplay(m.emoji);
                    return `<span class="mapping-badge">${emojiDisplay} ${roleName}</span>`;
                }).join('');
            } else if (msg.interaction_type === 'button' && msg.button_config?.buttons) {
                mappingsHtml = msg.button_config.buttons.map(btn => {
                    const role = roles.find(r => btn.role_ids?.includes(r.id));
                    const roleName = role ? role.name : btn.label || 'Unknown';
                    return `<span class="mapping-badge">${btn.emoji || '🔘'} ${roleName}</span>`;
                }).join('');
            } else if (msg.interaction_type === 'dropdown' && msg.dropdown_config?.options) {
                mappingsHtml = msg.dropdown_config.options.map(opt => {
                    const role = roles.find(r => opt.role_ids?.includes(r.id));
                    const roleName = role ? role.name : opt.label || 'Unknown';
                    return `<span class="mapping-badge">${opt.emoji || '📋'} ${roleName}</span>`;
                }).join('');
            }

            const title = msg.embed_config?.title || 'Reaction Role Message';
            const typeLabel = msg.interaction_type === 'emoji' ? 'Emoji Reactions' :
                             msg.interaction_type === 'button' ? 'Buttons' : 'Dropdown';

            return `
                <div class="reaction-role-item" data-message-id="${msg.message_id}">
                    <div class="reaction-role-info">
                        <div class="reaction-role-title">${this.escapeHtml(title)}</div>
                        <div class="reaction-role-meta">
                            <span>📍 ${channelName}</span>
                            <span>🎯 ${typeLabel}</span>
                        </div>
                        <div class="reaction-role-mappings">
                            ${mappingsHtml}
                        </div>
                    </div>
                    <div class="reaction-role-actions">
                        <button class="btn-delete" onclick="ReactionRolesFeature.deleteMessage(${index})">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    parseEmojiMappings(mappings) {
        try {
            if (typeof mappings === 'string') {
                const parsed = JSON.parse(mappings);
                if (Array.isArray(parsed)) {
                    return parsed.map(m => ({
                        emoji: m.emoji,
                        roleIds: Array.isArray(m.role_ids) ? m.role_ids : [m.role_ids]
                    }));
                } else if (typeof parsed === 'object') {
                    return Object.entries(parsed).map(([emoji, roleIds]) => ({
                        emoji,
                        roleIds: Array.isArray(roleIds) ? roleIds : [roleIds]
                    }));
                }
            } else if (Array.isArray(mappings)) {
                return mappings.map(m => ({
                    emoji: m.emoji,
                    roleIds: Array.isArray(m.role_ids) ? m.role_ids : [m.role_ids]
                }));
            } else if (typeof mappings === 'object') {
                return Object.entries(mappings).map(([emoji, roleIds]) => ({
                    emoji,
                    roleIds: Array.isArray(roleIds) ? roleIds : [roleIds]
                }));
            }
        } catch (e) {
            console.error('Error parsing emoji mappings:', e);
        }
        return [];
    },

    getEmojiDisplay(emoji) {
        const match = emoji?.match(/<(a?):([^:]+):(\d+)>/);
        if (match) {
            const animated = match[1] === 'a';
            const name = match[2];
            const id = match[3];
            const ext = animated ? 'gif' : 'png';
            return `<img src="https://cdn.discordapp.com/emojis/${id}.${ext}" alt="${name}" style="width:18px;height:18px;vertical-align:middle;">`;
        }
        return emoji || '❓';
    },

    showCreateForm() {
        this.state.editingId = null;
        this.state.roleMappings = [{ emoji: '', roleId: '' }];
        this.state.interactionType = 'emoji';

        // Reset form fields
        document.getElementById('formTitle').textContent = 'Create Reaction Role';
        document.getElementById('saveButtonText').textContent = 'Create & Post';
        document.getElementById('channelSelect').value = '';
        document.getElementById('embedTitle').value = '';
        document.getElementById('embedDescription').value = '';
        document.getElementById('embedColor').value = '#5865F2';

        // Reset interaction type buttons
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === 'emoji');
        });

        this.renderRoleMappings();

        document.getElementById('reactionRoleForm').style.display = 'block';
    },

    hideForm() {
        document.getElementById('reactionRoleForm').style.display = 'none';
        this.state.editingId = null;
        this.state.roleMappings = [];
    },

    setInteractionType(type) {
        this.state.interactionType = type;

        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        this.renderRoleMappings();
    },

    renderRoleMappings() {
        const container = document.getElementById('roleMappingsContainer');
        if (!container) return;

        const dashboardCore = getDashboardCore();
        const roles = dashboardCore?.state?.guildConfig?.available_roles || [];

        container.innerHTML = this.state.roleMappings.map((mapping, index) => {
            const emojiDisplay = mapping.emoji ? this.getEmojiDisplay(mapping.emoji) : '+';
            const hasEmoji = !!mapping.emoji;

            return `
                <div class="role-mapping-row" data-index="${index}">
                    <button type="button" class="emoji-selector-btn ${hasEmoji ? 'has-emoji' : ''}"
                            onclick="ReactionRolesFeature.openEmojiPicker(${index})">
                        ${emojiDisplay}
                    </button>
                    <select class="feature-select" onchange="ReactionRolesFeature.updateMappingRole(${index}, this.value)">
                        <option value="">Select a role...</option>
                        ${roles.map(role => `
                            <option value="${role.id}" ${mapping.roleId === role.id ? 'selected' : ''}>
                                ${this.escapeHtml(role.name)}
                            </option>
                        `).join('')}
                    </select>
                    ${this.state.roleMappings.length > 1 ? `
                        <button type="button" class="btn-remove-mapping" onclick="ReactionRolesFeature.removeRoleMapping(${index})">
                            &times;
                        </button>
                    ` : ''}
                </div>
            `;
        }).join('');
    },

    addRoleMapping() {
        this.state.roleMappings.push({ emoji: '', roleId: '' });
        this.renderRoleMappings();
    },

    removeRoleMapping(index) {
        this.state.roleMappings.splice(index, 1);
        this.renderRoleMappings();
    },

    updateMappingRole(index, roleId) {
        this.state.roleMappings[index].roleId = roleId;
    },

    openEmojiPicker(index) {
        this.state.currentEmojiIndex = index;
        document.getElementById('emojiPickerModal').style.display = 'flex';
        this.switchEmojiTab('standard');
        document.getElementById('emojiSearchInput').value = '';
    },

    closeEmojiPicker() {
        document.getElementById('emojiPickerModal').style.display = 'none';
        this.state.currentEmojiIndex = null;
    },

    switchEmojiTab(tab) {
        this.state.currentTab = tab;

        document.querySelectorAll('.emoji-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        this.renderEmojiPickerGrid();
    },

    filterEmojis(query) {
        this.renderEmojiPickerGrid(query.toLowerCase());
    },

    renderEmojiPickerGrid(searchQuery = '') {
        const grid = document.getElementById('emojiPickerGrid');
        if (!grid) return;

        if (this.state.currentTab === 'standard') {
            const emojis = this.standardEmojis;

            grid.innerHTML = emojis.map(emoji => `
                <button class="emoji-picker-item" onclick="ReactionRolesFeature.selectEmoji('${emoji}')" title="${emoji}">
                    ${emoji}
                </button>
            `).join('');
        } else {
            const availableEmojis = getDashboardCore()?.state?.guildConfig?.available_emojis || [];

            if (availableEmojis.length === 0) {
                grid.innerHTML = '<div class="emoji-picker-empty">No custom emojis available</div>';
                return;
            }

            let filteredEmojis = availableEmojis;
            if (searchQuery) {
                filteredEmojis = availableEmojis.filter(e =>
                    e.name.toLowerCase().includes(searchQuery)
                );
            }

            if (filteredEmojis.length === 0) {
                grid.innerHTML = '<div class="emoji-picker-empty">No emojis match your search</div>';
                return;
            }

            grid.innerHTML = filteredEmojis.map(emoji => {
                const emojiValue = this.buildCustomEmojiValue(emoji);
                const ext = emoji.animated ? 'gif' : 'png';
                const imgUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}`;

                return `
                    <button class="emoji-picker-item" onclick="ReactionRolesFeature.selectEmoji('${emojiValue.replace(/'/g, "\\'")}')" title="${emoji.name}">
                        <img src="${imgUrl}" alt="${emoji.name}">
                    </button>
                `;
            }).join('');
        }
    },

    buildCustomEmojiValue(emoji) {
        const prefix = emoji.animated ? 'a' : '';
        return `<${prefix}:${emoji.name}:${emoji.id}>`;
    },

    selectEmoji(emoji) {
        const index = this.state.currentEmojiIndex;
        if (index !== null && this.state.roleMappings[index]) {
            this.state.roleMappings[index].emoji = emoji;
            this.renderRoleMappings();
        }
        this.closeEmojiPicker();
    },

    async saveReactionRole() {
        const dashboardCore = getDashboardCore();
        if (!dashboardCore) return;

        const channelId = document.getElementById('channelSelect').value;
        const title = document.getElementById('embedTitle').value;
        const description = document.getElementById('embedDescription').value;
        const color = document.getElementById('embedColor').value;

        // Validation
        if (!channelId) {
            alert('Please select a channel');
            return;
        }

        if (!title && !description) {
            alert('Please enter a title or description');
            return;
        }

        const validMappings = this.state.roleMappings.filter(m => m.emoji && m.roleId);
        if (validMappings.length === 0) {
            alert('Please add at least one emoji-role mapping');
            return;
        }

        // Build the form data
        const formData = {
            channel_id: channelId,
            interaction_type: this.state.interactionType,
            embed_config: {
                title: title,
                description: description,
                color: parseInt(color.replace('#', ''), 16)
            }
        };

        // Add mappings based on interaction type
        if (this.state.interactionType === 'emoji') {
            formData.emoji_role_mappings = validMappings.map(m => ({
                emoji: m.emoji,
                role_ids: [m.roleId]
            }));
        } else if (this.state.interactionType === 'button') {
            formData.button_config = {
                buttons: validMappings.map(m => ({
                    emoji: m.emoji,
                    label: '',
                    style: 'primary',
                    role_ids: [m.roleId]
                }))
            };
        } else if (this.state.interactionType === 'dropdown') {
            formData.dropdown_config = {
                placeholder: 'Select a role...',
                options: validMappings.map(m => ({
                    emoji: m.emoji,
                    label: 'Role',
                    value: m.roleId,
                    role_ids: [m.roleId]
                }))
            };
        }

        try {
            const token = localStorage.getItem('discord_token');
            const guildId = dashboardCore.state.currentGuildId;

            const response = await fetch(`${dashboardCore.API_BASE_URL}/api/guilds/${guildId}/reaction-roles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to create reaction role');
            }

            // Add to local state
            this.state.messages.push(result.data);

            // Update config
            if (!dashboardCore.state.guildConfig.settings.reaction_roles) {
                dashboardCore.state.guildConfig.settings.reaction_roles = { enabled: true, messages: [] };
            }
            dashboardCore.state.guildConfig.settings.reaction_roles.messages = this.state.messages;
            dashboardCore.state.guildConfig.settings.reaction_roles.enabled = true;

            // Save config
            await dashboardCore.saveGuildConfig({
                reaction_roles: dashboardCore.state.guildConfig.settings.reaction_roles
            });

            // Update UI
            this.renderMessagesList();
            this.hideForm();

            // Update toggle
            const featureToggle = document.getElementById('featureToggle');
            if (featureToggle) featureToggle.checked = true;

            alert('Reaction role created successfully!');

        } catch (error) {
            console.error('Error creating reaction role:', error);
            alert('Error: ' + error.message);
        }
    },

    async deleteMessage(index) {
        if (!confirm('Are you sure you want to delete this reaction role message?')) {
            return;
        }

        const dashboardCore = getDashboardCore();
        if (!dashboardCore) return;

        // Remove from local state
        this.state.messages.splice(index, 1);

        // Update config
        if (dashboardCore.state.guildConfig.settings.reaction_roles) {
            dashboardCore.state.guildConfig.settings.reaction_roles.messages = this.state.messages;
        }

        // Save config
        try {
            await dashboardCore.saveGuildConfig({
                reaction_roles: dashboardCore.state.guildConfig.settings.reaction_roles
            });

            this.renderMessagesList();
            alert('Reaction role deleted!');
        } catch (error) {
            console.error('Error deleting reaction role:', error);
            alert('Failed to delete reaction role');
        }
    },

    handleToggleChange() {
        const dashboardCore = getDashboardCore();
        const featureToggle = document.getElementById('featureToggle');

        if (dashboardCore && featureToggle) {
            if (!dashboardCore.state.guildConfig.settings.reaction_roles) {
                dashboardCore.state.guildConfig.settings.reaction_roles = { enabled: false, messages: [] };
            }
            dashboardCore.state.guildConfig.settings.reaction_roles.enabled = featureToggle.checked;
            dashboardCore.markUnsavedChanges();
        }

        this.updateUIState();
    },

    updateUIState() {
        const featureToggle = document.getElementById('featureToggle');
        const isEnabled = featureToggle?.checked ?? false;
        const createBtn = document.getElementById('createNewBtn');

        if (createBtn) {
            createBtn.disabled = !isEnabled;
            createBtn.style.opacity = isEnabled ? '1' : '0.5';
        }
    },

    setupEventListeners() {
        // Close modal on backdrop click
        const modal = document.getElementById('emojiPickerModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeEmojiPicker();
                }
            });
        }

        // Close modal on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeEmojiPicker();
                this.hideForm();
            }
        });
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Export for feature loader
window.ReactionRolesFeature = ReactionRolesFeature;
