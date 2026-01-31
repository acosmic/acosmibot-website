/**
 * Reaction Roles Feature Module
 */

const ReactionRolesFeature = (function() {
    'use strict';

    let state = {
        guildId: null,
        reactionRoles: [],
        editingId: null,
        stats: null,
        channels: [],
        roles: [],
        interactionType: 'emoji',
        roleMappings: [],
        embedConfig: {},
        currentView: 'list',
        previewDebounce: null,
        currentEmojiTarget: null, // For emoji picker
        currentTab: 'standard'
    };

    // Standard emoji categories for the picker (from slots.js)
    const standardEmojis = {
        fruits: ['🍒', '🍋', '🍊', '🍇', '🍌', '🍎', '🍐', '🍑', '🍓', '🫐', '🥝', '🍈', '🍉', '🥭', '🍍'],
        symbols: ['⭐', '🔔', '❤️', '💎', '🎰', '💰', '💵', '💴', '💶', '💷', '🪙', '💸', '🏆', '👑', '🎯'],
        lucky: ['🍀', '🌟', '✨', '💫', '🎲', '🎁', '🎀', '🏅', '🥇', '🎊', '🎉', '🔮', '🌈', '☘️', '🐞'],
        misc: ['7️⃣', '🃏', '🎴', '🀄', '🎱', '🔥', '💥', '⚡', '🌙', '☀️', '🌸', '🦄', '🐉', '🎃', '👻']
    };

    // ========================================================================
    // Initialization & Routing
    // ========================================================================

    async function init(params = {}) {
        console.log('[ReactionRoles] Init called with params:', params);

        const dashboardCore = getDashboardCore();
        if (!dashboardCore) {
            console.error('[ReactionRoles] DashboardCore not available');
            showError('Dashboard not initialized');
            return;
        }

        const guildId = dashboardCore.state.currentGuildId;
        if (!guildId) {
            console.error('[ReactionRoles] No guild ID available');
            showError('No guild selected');
            return;
        }

        state.guildId = guildId;

        // Initialize dashboard core for SPA
        await dashboardCore.initForSPA('reaction-roles');

        // Load CSS and dependencies
        loadCSS('/styles/reaction-roles.css');
        await loadScript('/scripts/shared/embed-preview.js');

        // Load HTML views
        await loadViews();

        const route = params.route || 'reaction-roles';
        console.log('[ReactionRoles] Route:', route);

        try {
            if (route === 'reaction-roles/new') {
                await showBuilder();
            } else if (route.startsWith('reaction-roles/edit/')) {
                state.editingId = params.rrId || route.split('/')[2];
                await showBuilder(state.editingId);
            } else {
                await showList();
            }
        } catch (error) {
            console.error('[ReactionRoles] Init error:', error);
            showError('Failed to initialize reaction roles feature');
        }

        setupGlobalEventListeners();
    }

    function setupGlobalEventListeners() {
        // Close modal on backdrop click
        const modal = document.getElementById('emojiPickerModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeEmojiPicker();
                }
            });
        }
    }

    async function loadViews() {
        const listContent = document.getElementById('rrListContent');
        const builderContent = document.getElementById('rrBuilderContent');

        if (listContent && !listContent.innerHTML) {
            const listResponse = await fetch('/server/views/reaction-roles-list-view.html');
            listContent.innerHTML = await listResponse.text();
        }

        if (builderContent && !builderContent.innerHTML) {
            const builderResponse = await fetch('/server/views/reaction-roles-builder-view.html');
            builderContent.innerHTML = await builderResponse.text();
        }
    }

    // ========================================================================
    // View Management
    // ========================================================================

    async function showList() {
        console.log('[ReactionRoles] showList called');

        try {
            const listView = document.getElementById('rrListView');
            const builderView = document.getElementById('rrBuilderView');

            if (!listView || !builderView) {
                throw new Error('Reaction roles view sections not found');
            }

            listView.style.display = 'block';
            builderView.style.display = 'none';
            state.currentView = 'list';

            // Load channels so we can display names
            loadChannelsFromConfig();
            
            // Setup listeners immediately
            setupListEventListeners();

            await Promise.all([fetchReactionRoles(), fetchStats()]);
            renderList();
        } catch (error) {
            console.error('[ReactionRoles] showList error:', error);
            showError('Failed to load reaction roles list: ' + error.message);
        }
    }

    async function showBuilder(rrId = null) {
        console.log('[ReactionRoles] showBuilder called, rrId:', rrId);

        const listView = document.getElementById('rrListView');
        const builderView = document.getElementById('rrBuilderView');

        if (!listView || !builderView) {
            console.error('[ReactionRoles] View sections not found');
            showError('Reaction roles view sections not found');
            return;
        }

        listView.style.display = 'none';
        builderView.style.display = 'block';
        state.currentView = 'builder';

        // Load channels and roles
        loadChannelsFromConfig();
        loadRolesFromConfig();

        if (rrId) {
            state.editingId = rrId;
            await loadReactionRoleForEditing(rrId);
            const titleEl = document.getElementById('builderTitle');
            if (titleEl) titleEl.textContent = 'Edit Reaction Role';
        } else {
            state.editingId = null;
            initializeNewReactionRole();
            const titleEl = document.getElementById('builderTitle');
            if (titleEl) titleEl.textContent = 'Create Reaction Role';
        }

        setupBuilderEventListeners();
        updatePreview();
    }

    // ========================================================================
    // API Calls
    // ========================================================================

    async function fetchReactionRoles() {
        try {
            const dashboardCore = getDashboardCore();
            const response = await fetch(
                `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/reaction-roles`,
                { headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` } }
            );
            const data = await response.json();
            if (data.success) {
                state.reactionRoles = data.data || [];
            }
        } catch (error) {
            console.error('[ReactionRoles] Fetch error:', error);
            showNotification('Failed to load reaction roles', 'error');
        }
    }

    async function fetchStats() {
        try {
            const dashboardCore = getDashboardCore();
            const response = await fetch(
                `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/reaction-roles/stats`,
                { headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` } }
            );
            const data = await response.json();
            if (data.success) {
                state.stats = data.stats;
            }
        } catch (error) {
            console.error('[ReactionRoles] Stats error:', error);
        }
    }

    function loadChannelsFromConfig() {
        const dashboardCore = getDashboardCore();
        const allChannels = dashboardCore?.state?.guildConfig?.available_channels || [];
        state.channels = allChannels.filter(c => c.type == 0); // Text channels only (loose equality for string/number)
        populateChannelDropdown();
    }

    function loadRolesFromConfig() {
        const dashboardCore = getDashboardCore();
        state.roles = dashboardCore?.state?.guildConfig?.available_roles || [];
    }

    async function loadReactionRoleForEditing(rrId) {
        try {
            const dashboardCore = getDashboardCore();
            const response = await fetch(
                `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/reaction-roles/${rrId}`,
                { headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` } }
            );
            const data = await response.json();
            if (data.success) {
                populateFormFromReactionRole(data.data);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('[ReactionRoles] Load error:', error);
            showNotification('Failed to load reaction role', 'error');
            navigateTo('reaction-roles');
        }
    }

    // ========================================================================
    // List View Rendering
    // ========================================================================

    function renderList() {
        const grid = document.getElementById('rrGrid');
        const emptyState = document.getElementById('rrEmptyState');
        const countSpan = document.getElementById('rrCount');
        const limitSpan = document.getElementById('rrLimit');
        const createBtn = document.getElementById('createRRBtn');

        if (!grid) return;

        // Ensure channels are loaded
        loadChannelsFromConfig();

        // Update counter
        if (state.stats) {
            if (countSpan) countSpan.textContent = state.stats.total;
            if (limitSpan) limitSpan.textContent = state.stats.max;
            if (createBtn) createBtn.disabled = state.stats.remaining <= 0;
        }

        // Show empty state or grid
        if (state.reactionRoles.length === 0) {
            grid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        grid.style.display = 'grid';
        if (emptyState) emptyState.style.display = 'none';
        grid.innerHTML = state.reactionRoles.map(rr => createReactionRoleCard(rr)).join('');
    }

    function createReactionRoleCard(rr) {
        const statusClass = rr.is_sent ? 'status-sent' : 'status-draft';
        const statusText = rr.is_sent ? 'Sent' : 'Draft';

        // Ensure channels are loaded before finding name
        const channelName = state.channels.find(c => String(c.id) === String(rr.channel_id))?.name || 'Unknown Channel';
        const interactionIcon = {
            'emoji': '😀',
            'button': '🔘',
            'dropdown': '📋'
        }[rr.interaction_type] || '⚡';

        let mappingsCount = 0;
        if (rr.interaction_type === 'emoji' && rr.emoji_role_mappings) {
            mappingsCount = Object.keys(rr.emoji_role_mappings).length;
        } else if (rr.interaction_type === 'button' && rr.button_configs) {
            mappingsCount = rr.button_configs.length;
        } else if (rr.interaction_type === 'dropdown' && rr.dropdown_config) {
            mappingsCount = rr.dropdown_config.options?.length || 0;
        }

        const previewText = rr.text_content || rr.embed_config?.title || rr.embed_config?.description || 'No content';

        return `
            <div class="rr-card">
                <div class="rr-card-header">
                    <div>
                        <div class="rr-card-title">${escapeHtml(rr.name)}</div>
                    </div>
                    <span class="rr-card-status ${statusClass}">${statusText}</span>
                </div>
                <div class="rr-card-body">
                    <div class="rr-card-preview">
                        <div class="rr-card-preview-text">${escapeHtml(previewText.substring(0, 100))}${previewText.length > 100 ? '...' : ''}</div>
                        <div style="margin-top: 8px;">
                            <a href="#" onclick="event.preventDefault(); ReactionRolesFeature.showPreviewModal(${rr.id})" style="color: #00D9FF; font-size: 12px; text-decoration: none;">
                                See Preview
                            </a>
                        </div>
                    </div>
                    <div class="rr-card-meta">
                        <div class="rr-card-meta-item">
                            <span class="rr-card-meta-icon">#</span>
                            ${escapeHtml(channelName)}
                        </div>
                        <div class="rr-card-meta-item">
                            <span class="rr-card-meta-icon">${interactionIcon}</span>
                            ${rr.interaction_type.charAt(0).toUpperCase() + rr.interaction_type.slice(1)}
                        </div>
                        <div class="rr-card-meta-item">
                            <span class="rr-card-meta-icon">🎯</span>
                            ${mappingsCount} mapping${mappingsCount !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
                <div class="rr-card-actions">
                    <button class="rr-card-action-btn edit-btn" onclick="ReactionRolesFeature.editReactionRole(${rr.id})">Edit</button>
                    <button class="rr-card-action-btn duplicate-btn" onclick="ReactionRolesFeature.duplicateReactionRole(${rr.id})">Duplicate</button>
                    <button class="rr-card-action-btn delete-btn" onclick="ReactionRolesFeature.showDeleteModal(${rr.id})">Delete</button>
                </div>
            </div>
        `;
    }

    function setupListEventListeners() {
        const createBtn = document.getElementById('createRRBtn');
        if (createBtn) {
            // Remove existing listener by cloning (prevents duplicates)
            const newBtn = createBtn.cloneNode(true);
            createBtn.parentNode.replaceChild(newBtn, createBtn);
            newBtn.addEventListener('click', () => navigateTo('reaction-roles/new'));
        }
    }

    // ========================================================================
    // Builder View - Initialization
    // ========================================================================

    function initializeNewReactionRole() {
        state.interactionType = 'emoji';
        state.roleMappings = [];
        state.embedConfig = {};

        setValue('rrName', '');
        setValue('targetChannel', '');
        setValue('messageText', '');
        setValue('embedTitle', '');
        setValue('embedDescription', '');
        setValue('embedColor', '#5865F2');
        setValue('thumbnailUrl', '');
        setValue('imageUrl', '');
        setValue('footerText', '');
        setValue('allowRemoval', true);
        setValue('suppressRolePings', false);

        // Set emoji as default interaction type
        const emojiRadio = document.getElementById('typeEmoji');
        if (emojiRadio) emojiRadio.checked = true;

        switchInteractionType('emoji');
        addEmojiMapping(); // Start with one mapping
    }

    function populateFormFromReactionRole(rr) {
        setValue('rrName', rr.name);
        setValue('targetChannel', rr.channel_id);
        setValue('messageText', rr.text_content);
        setValue('allowRemoval', rr.allow_removal);

        // Embed config
        if (rr.embed_config) {
            setValue('embedTitle', rr.embed_config.title);
            setValue('embedDescription', rr.embed_config.description);
            if (rr.embed_config.color) {
                setValue('embedColor', '#' + rr.embed_config.color);
            }
            setValue('thumbnailUrl', rr.embed_config.thumbnail);
            setValue('imageUrl', rr.embed_config.image);
            setValue('footerText', rr.embed_config.footer);
        }

        // Interaction type
        state.interactionType = rr.interaction_type;
        const typeRadio = document.getElementById('type' + capitalizeFirst(rr.interaction_type));
        if (typeRadio) typeRadio.checked = true;

        // Disable interaction type changing if already sent
        if (rr.is_sent) {
            const warning = document.getElementById('interactionTypeWarning');
            if (warning) warning.style.display = 'block';
            ['typeEmoji', 'typeButton', 'typeDropdown'].forEach(id => {
                const radio = document.getElementById(id);
                if (radio && radio.value !== rr.interaction_type) radio.disabled = true;
            });
        }

        // Role mappings
        switchInteractionType(rr.interaction_type);

        if (rr.interaction_type === 'emoji' && rr.emoji_role_mappings) {
            Object.entries(rr.emoji_role_mappings).forEach(([emoji, roleIds]) => {
                addEmojiMapping(emoji, roleIds);
            });
        } else if (rr.interaction_type === 'button' && rr.button_configs) {
            rr.button_configs.forEach(btn => {
                addButtonConfig(btn);
            });
        } else if (rr.interaction_type === 'dropdown' && rr.dropdown_config) {
            setValue('dropdownPlaceholder', rr.dropdown_config.placeholder);
            (rr.dropdown_config.options || []).forEach(opt => {
                addDropdownOption(opt);
            });
        }

        // Show update button if sent
        if (rr.is_sent) {
            const sendBtn = document.getElementById('sendBtn');
            const updateBtn = document.getElementById('updateBtn');
            const saveDraftBtn = document.getElementById('saveDraftBtn');
            if (sendBtn) sendBtn.style.display = 'none';
            if (saveDraftBtn) saveDraftBtn.style.display = 'none';
            if (updateBtn) updateBtn.style.display = 'block';
        }
    }

    function populateChannelDropdown() {
        const select = document.getElementById('targetChannel');
        if (!select) return;

        while (select.options.length > 1) select.remove(1);

        state.channels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel.id;
            option.textContent = `# ${channel.name}`;
            select.appendChild(option);
        });
    }

    // ========================================================================
    // Builder View - Event Listeners
    // ========================================================================

    function setupBuilderEventListeners() {
        // Text inputs for preview update
        const inputs = ['rrName', 'messageText', 'embedTitle', 'embedDescription',
                       'embedColor', 'thumbnailUrl', 'imageUrl', 'footerText'];

        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', debouncedUpdatePreview);
                el.addEventListener('change', debouncedUpdatePreview);
            }
        });

        // Message text character counter
        const messageText = document.getElementById('messageText');
        const counter = document.getElementById('messageTextCounter');
        if (messageText && counter) {
            messageText.addEventListener('input', () => {
                counter.textContent = messageText.value.length;
            });
        }

        // Interaction type radio buttons
        const typeRadios = document.querySelectorAll('input[name="interactionType"]');
        typeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                switchInteractionType(e.target.value);
            });
        });
    }

    // ========================================================================
    // Interaction Type Management
    // ========================================================================

    function switchInteractionType(type) {
        state.interactionType = type;

        const emojiContainer = document.getElementById('emojiMappingsContainer');
        const buttonContainer = document.getElementById('buttonConfigsContainer');
        const dropdownContainer = document.getElementById('dropdownConfigContainer');

        if (emojiContainer) emojiContainer.style.display = type === 'emoji' ? 'block' : 'none';
        if (buttonContainer) buttonContainer.style.display = type === 'button' ? 'block' : 'none';
        if (dropdownContainer) dropdownContainer.style.display = type === 'dropdown' ? 'block' : 'none';

        updatePreview();
    }

    // ========================================================================
    // Emoji Picker Logic (from slots.js)
    // ========================================================================

    function openEmojiPicker(targetId) {
        state.currentEmojiTarget = targetId;
        const modal = document.getElementById('emojiPickerModal');
        if (modal) {
            modal.style.display = 'flex';
            switchEmojiTab('standard');
            const searchInput = document.getElementById('emojiSearchInput');
            if (searchInput) searchInput.value = '';
        }
    }

    function closeEmojiPicker() {
        const modal = document.getElementById('emojiPickerModal');
        if (modal) {
            modal.style.display = 'none';
        }
        state.currentEmojiTarget = null;
    }

    function switchEmojiTab(tab) {
        state.currentTab = tab;

        // Update tab buttons
        document.querySelectorAll('.emoji-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Render emojis
        renderEmojiPickerGrid();
    }

    function filterEmojis(query) {
        renderEmojiPickerGrid(query.toLowerCase());
    }

    function renderEmojiPickerGrid(searchQuery = '') {
        const grid = document.getElementById('emojiPickerGrid');
        if (!grid) return;

        let emojis = [];

        if (state.currentTab === 'standard') {
            // Flatten standard emojis
            Object.values(standardEmojis).forEach(category => {
                emojis.push(...category);
            });

            grid.innerHTML = emojis.map(emoji => {
                return `
                    <button class="emoji-picker-item" onclick="ReactionRolesFeature.selectEmoji('${emoji}')" title="${emoji}">
                        ${emoji}
                    </button>
                `;
            }).join('');
        } else {
            // Custom server emojis
            const dashboardCore = getDashboardCore();
            const availableEmojis = dashboardCore?.state?.guildConfig?.available_emojis || [];

            if (availableEmojis.length === 0) {
                grid.innerHTML = '<div class="emoji-picker-empty">No custom emojis available in this server</div>';
                return;
            }

            // Filter by search
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
                const emojiValue = buildCustomEmojiValue(emoji);
                const ext = emoji.animated ? 'gif' : 'png';
                const imgUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}`;

                return `
                    <button class="emoji-picker-item" onclick="ReactionRolesFeature.selectEmoji('${emojiValue.replace(/'/g, "\\'")}')" title="${emoji.name}">
                        <img src="${imgUrl}" alt="${emoji.name}">
                    </button>
                `;
            }).join('');
        }
    }

    function buildCustomEmojiValue(emoji) {
        // Build Discord emoji format: <:name:id> or <a:name:id>
        const prefix = emoji.animated ? 'a' : '';
        return `<${prefix}:${emoji.name}:${emoji.id}>`;
    }

    function selectEmoji(emoji) {
        if (!state.currentEmojiTarget) return;

        const input = document.getElementById(state.currentEmojiTarget);
        if (input) {
            input.value = emoji;
            // Trigger input event to update preview
            input.dispatchEvent(new Event('input'));
            updatePreview();
        }

        closeEmojiPicker();
    }

    function getEmojiDisplay(emoji) {
        if (!emoji) return '';
        // Check if it's a custom Discord emoji format <:name:id> or <a:name:id>
        const match = emoji.match(/<(a?):([^:]+):(\d+)>/);
        if (match) {
            const animated = match[1] === 'a';
            const name = match[2];
            const id = match[3];
            const ext = animated ? 'gif' : 'png';
            return `<img src="https://cdn.discordapp.com/emojis/${id}.${ext}" alt="${name}" title="${name}" class="discord-emoji-img">`;
        }
        // Standard emoji
        return emoji;
    }

    // ========================================================================
    // Role Mappings - Emoji
    // ========================================================================

    function addEmojiMapping(emoji = '', roleIds = []) {
        const container = document.getElementById('emojiMappingsList');
        if (!container) return;

        const index = container.children.length;
        const mappingHtml = createEmojiMappingHtml(index, emoji, roleIds);
        container.insertAdjacentHTML('beforeend', mappingHtml);

        // Setup role selector
        const roleSelect = document.getElementById(`emojiRoleSelect_${index}`);
        if (roleSelect) {
            populateRoleSelect(roleSelect, roleIds);
        }

        updatePreview();
    }

    function createEmojiMappingHtml(index, emoji = '', roleIds = []) {
        return `
            <div class="mapping-item" id="emojiMapping_${index}">
                <div class="mapping-header">
                    <span class="mapping-number">Emoji ${index + 1}</span>
                    <button class="remove-mapping-btn" onclick="ReactionRolesFeature.removeEmojiMapping(${index})">Remove</button>
                </div>
                <div class="mapping-fields">
                    <div class="form-group">
                        <label class="form-label">Emoji</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="emoji_${index}" class="form-input" placeholder="😀 or :emoji:" value="${escapeHtml(emoji)}" onchange="ReactionRolesFeature.updatePreview()">
                            <button class="remove-mapping-btn" onclick="ReactionRolesFeature.openEmojiPicker('emoji_${index}')" style="background: #5865F2;">Select</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Roles</label>
                        <select id="emojiRoleSelect_${index}" class="form-select" multiple onchange="ReactionRolesFeature.updatePreview()">
                            <!-- Populated by JavaScript -->
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    function removeEmojiMapping(index) {
        const mapping = document.getElementById(`emojiMapping_${index}`);
        if (mapping) mapping.remove();
        updatePreview();
    }

    // ========================================================================
    // Role Mappings - Buttons
    // ========================================================================

    function addButtonConfig(config = {}) {
        const container = document.getElementById('buttonConfigsList');
        if (!container) return;

        const index = container.children.length;
        const buttonHtml = createButtonConfigHtml(index, config);
        container.insertAdjacentHTML('beforeend', buttonHtml);

        // Setup role selector
        const roleSelect = document.getElementById(`buttonRoleSelect_${index}`);
        if (roleSelect) {
            populateRoleSelect(roleSelect, config.role_ids || []);
        }

        updatePreview();
    }

    function createButtonConfigHtml(index, config = {}) {
        const styles = [
            { value: 1, label: 'Primary (Blue)' },
            { value: 2, label: 'Secondary (Gray)' },
            { value: 3, label: 'Success (Green)' },
            { value: 4, label: 'Danger (Red)' }
        ];

        return `
            <div class="mapping-item" id="buttonConfig_${index}">
                <div class="mapping-header">
                    <span class="mapping-number">Button ${index + 1}</span>
                    <button class="remove-mapping-btn" onclick="ReactionRolesFeature.removeButtonConfig(${index})">Remove</button>
                </div>
                <div class="mapping-fields">
                    <div class="form-group">
                        <label class="form-label">Label</label>
                        <input type="text" id="buttonLabel_${index}" class="form-input" placeholder="Click me!" value="${escapeHtml(config.label || '')}" onchange="ReactionRolesFeature.updatePreview()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Style</label>
                        <select id="buttonStyle_${index}" class="form-select" onchange="ReactionRolesFeature.updatePreview()">
                            ${styles.map(s => `<option value="${s.value}" ${config.style === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Emoji (Optional)</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="buttonEmoji_${index}" class="form-input" placeholder="😀" value="${escapeHtml(config.emoji || '')}" onchange="ReactionRolesFeature.updatePreview()">
                            <button class="remove-mapping-btn" onclick="ReactionRolesFeature.openEmojiPicker('buttonEmoji_${index}')" style="background: #5865F2;">Select</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Roles</label>
                        <select id="buttonRoleSelect_${index}" class="form-select" multiple onchange="ReactionRolesFeature.updatePreview()">
                            <!-- Populated by JavaScript -->
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    function removeButtonConfig(index) {
        const button = document.getElementById(`buttonConfig_${index}`);
        if (button) button.remove();
        updatePreview();
    }

    // ========================================================================
    // Role Mappings - Dropdown
    // ========================================================================

    function addDropdownOption(config = {}) {
        const container = document.getElementById('dropdownOptionsList');
        if (!container) return;

        const index = container.children.length;
        const optionHtml = createDropdownOptionHtml(index, config);
        container.insertAdjacentHTML('beforeend', optionHtml);

        // Setup role selector
        const roleSelect = document.getElementById(`dropdownRoleSelect_${index}`);
        if (roleSelect) {
            populateRoleSelect(roleSelect, config.role_ids || []);
        }

        updatePreview();
    }

    function createDropdownOptionHtml(index, config = {}) {
        return `
            <div class="mapping-item" id="dropdownOption_${index}">
                <div class="mapping-header">
                    <span class="mapping-number">Option ${index + 1}</span>
                    <button class="remove-mapping-btn" onclick="ReactionRolesFeature.removeDropdownOption(${index})">Remove</button>
                </div>
                <div class="mapping-fields">
                    <div class="form-group">
                        <label class="form-label">Label</label>
                        <input type="text" id="dropdownLabel_${index}" class="form-input" placeholder="Option Label" value="${escapeHtml(config.label || '')}" onchange="ReactionRolesFeature.updatePreview()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Description (Optional)</label>
                        <input type="text" id="dropdownDesc_${index}" class="form-input" placeholder="Description..." value="${escapeHtml(config.description || '')}" onchange="ReactionRolesFeature.updatePreview()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Emoji (Optional)</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="dropdownEmoji_${index}" class="form-input" placeholder="😀" value="${escapeHtml(config.emoji || '')}" onchange="ReactionRolesFeature.updatePreview()">
                            <button class="remove-mapping-btn" onclick="ReactionRolesFeature.openEmojiPicker('dropdownEmoji_${index}')" style="background: #5865F2;">Select</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Roles</label>
                        <select id="dropdownRoleSelect_${index}" class="form-select" multiple onchange="ReactionRolesFeature.updatePreview()">
                            <!-- Populated by JavaScript -->
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    function removeDropdownOption(index) {
        const option = document.getElementById(`dropdownOption_${index}`);
        if (option) option.remove();
        updatePreview();
    }

    function populateRoleSelect(select, selectedRoleIds = []) {
        if (!select) return;

        select.innerHTML = '';
        state.roles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.id;
            option.textContent = `@${role.name}`;
            if (selectedRoleIds.includes(role.id) || selectedRoleIds.includes(String(role.id))) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }

    // ========================================================================
    // Preview
    // ========================================================================

    function debouncedUpdatePreview() {
        if (state.previewDebounce) {
            clearTimeout(state.previewDebounce);
        }
        state.previewDebounce = setTimeout(updatePreview, 300);
    }

    function updatePreview() {
        const container = document.getElementById('rrPreviewContainer');
        if (!container) return;

        const config = getConfigFromForm();
        const previewHtml = buildPreviewHtml(config);
        container.innerHTML = previewHtml;
    }

    function buildPreviewHtml(config) {
        let html = '<div class="discord-message-preview">';

        // Message text
        if (config.text_content) {
            html += `<div class="discord-message-text">${escapeHtml(config.text_content)}</div>`;
        }

        // Embed
        if (config.embed_config && (config.embed_config.title || config.embed_config.description)) {
            html += buildEmbedHtml(config.embed_config);
        }

        // Interaction components
        if (config.interaction_type === 'emoji') {
            html += buildEmojiReactionsHtml(config.emoji_role_mappings);
        } else if (config.interaction_type === 'button') {
            html += buildButtonsHtml(config.button_configs);
        } else if (config.interaction_type === 'dropdown') {
            html += buildDropdownHtml(config.dropdown_config);
        }

        html += '</div>';
        return html;
    }

    function buildEmbedHtml(embedConfig) {
        const color = embedConfig.color || '#5865F2';
        let html = '<div class="discord-embed">';
        html += `<div class="discord-embed-color-bar" style="background: ${color};"></div>`;
        html += '<div class="discord-embed-content">';

        if (embedConfig.title) {
            html += `<div class="discord-embed-title">${escapeHtml(embedConfig.title)}</div>`;
        }

        if (embedConfig.description) {
            html += `<div class="discord-embed-description">${escapeHtml(embedConfig.description)}</div>`;
        }

        if (embedConfig.thumbnail) {
            html += `<img src="${escapeHtml(embedConfig.thumbnail)}" class="discord-embed-thumbnail" style="max-width: 80px; border-radius: 4px;">`;
        }

        if (embedConfig.image) {
            html += `<img src="${escapeHtml(embedConfig.image)}" class="discord-embed-image" style="max-width: 100%; border-radius: 4px; margin-top: 8px;">`;
        }

        if (embedConfig.footer) {
            html += `<div class="discord-embed-footer" style="margin-top: 8px; font-size: 12px; color: #B9BBBE;">${escapeHtml(embedConfig.footer)}</div>`;
        }

        html += '</div></div>';
        return html;
    }

    function buildEmojiReactionsHtml(mappings) {
        if (!mappings || Object.keys(mappings).length === 0) return '';

        let html = '<div class="discord-reactions">';
        Object.keys(mappings).forEach(emoji => {
            html += `
                <div class="discord-reaction">
                    <span class="discord-reaction-emoji">${getEmojiDisplay(emoji)}</span>
                    <span class="discord-reaction-count">0</span>
                </div>
            `;
        });
        html += '</div>';
        return html;
    }

    function buildButtonsHtml(buttons) {
        if (!buttons || buttons.length === 0) return '';

        const styleClasses = {
            1: 'discord-button-primary',
            2: 'discord-button-secondary',
            3: 'discord-button-success',
            4: 'discord-button-danger'
        };

        let html = '<div class="discord-buttons">';
        buttons.forEach(btn => {
            const styleClass = styleClasses[btn.style] || 'discord-button-secondary';
            html += `
                <button class="discord-button ${styleClass}">
                    ${btn.emoji ? `<span>${getEmojiDisplay(btn.emoji)}</span>` : ''}
                    ${escapeHtml(btn.label || 'Button')}
                </button>
            `;
        });
        html += '</div>';
        return html;
    }

    function buildDropdownHtml(config) {
        if (!config || !config.options || config.options.length === 0) return '';

        const placeholder = config.placeholder || 'Select roles...';
        return `<div class="discord-select-menu">${escapeHtml(placeholder)}</div>`;
    }

    // ========================================================================
    // Form Data Collection
    // ========================================================================

    function getConfigFromForm() {
        const config = {
            name: getValue('rrName'),
            channel_id: getValue('targetChannel'),
            text_content: getValue('messageText'),
            allow_removal: getValue('allowRemoval') === true || getValue('allowRemoval') === 'on',
            interaction_type: state.interactionType
        };

        // Embed config
        const embedTitle = getValue('embedTitle');
        const embedDesc = getValue('embedDescription');
        if (embedTitle || embedDesc) {
            config.embed_config = {
                title: embedTitle,
                description: embedDesc,
                color: getValue('embedColor'),
                thumbnail: getValue('thumbnailUrl'),
                image: getValue('imageUrl'),
                footer: getValue('footerText')
            };
        }

        // Role mappings based on interaction type
        if (state.interactionType === 'emoji') {
            config.emoji_role_mappings = getEmojiMappingsFromForm();
        } else if (state.interactionType === 'button') {
            config.button_configs = getButtonConfigsFromForm();
        } else if (state.interactionType === 'dropdown') {
            config.dropdown_config = getDropdownConfigFromForm();
        }

        return config;
    }

    function getEmojiMappingsFromForm() {
        const mappings = {};
        const container = document.getElementById('emojiMappingsList');
        if (!container) return mappings;

        Array.from(container.children).forEach((child, index) => {
            const emoji = getValue(`emoji_${index}`);
            const roleSelect = document.getElementById(`emojiRoleSelect_${index}`);

            if (emoji && roleSelect) {
                const selectedRoles = Array.from(roleSelect.selectedOptions).map(opt => opt.value);
                if (selectedRoles.length > 0) {
                    mappings[emoji] = selectedRoles;
                }
            }
        });

        return mappings;
    }

    function getButtonConfigsFromForm() {
        const buttons = [];
        const container = document.getElementById('buttonConfigsList');
        if (!container) return buttons;

        Array.from(container.children).forEach((child, index) => {
            const label = getValue(`buttonLabel_${index}`);
            const roleSelect = document.getElementById(`buttonRoleSelect_${index}`);

            if (label && roleSelect) {
                const selectedRoles = Array.from(roleSelect.selectedOptions).map(opt => opt.value);
                if (selectedRoles.length > 0) {
                    buttons.push({
                        label: label,
                        style: parseInt(getValue(`buttonStyle_${index}`)) || 1,
                        emoji: getValue(`buttonEmoji_${index}`),
                        role_ids: selectedRoles
                    });
                }
            }
        });

        return buttons;
    }

    function getDropdownConfigFromForm() {
        const options = [];
        const container = document.getElementById('dropdownOptionsList');
        if (!container) return { options };

        Array.from(container.children).forEach((child, index) => {
            const label = getValue(`dropdownLabel_${index}`);
            const roleSelect = document.getElementById(`dropdownRoleSelect_${index}`);

            if (label && roleSelect) {
                const selectedRoles = Array.from(roleSelect.selectedOptions).map(opt => opt.value);
                if (selectedRoles.length > 0) {
                    options.push({
                        label: label,
                        description: getValue(`dropdownDesc_${index}`),
                        emoji: getValue(`dropdownEmoji_${index}`),
                        role_ids: selectedRoles
                    });
                }
            }
        });

        return {
            placeholder: getValue('dropdownPlaceholder') || 'Select roles...',
            options: options
        };
    }

    // ========================================================================
    // Actions - Save, Send, Update
    // ========================================================================

    async function saveDraft() {
        const config = getConfigFromForm();

        if (!validateConfig(config)) {
            return;
        }

        try {
            const dashboardCore = getDashboardCore();
            const url = state.editingId
                ? `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/reaction-roles/${state.editingId}`
                : `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/reaction-roles`;

            const method = state.editingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('discord_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            const data = await response.json();

            if (data.success) {
                showNotification(state.editingId ? 'Draft updated!' : 'Draft saved!', 'success');
                navigateTo('reaction-roles');
            } else {
                showNotification(data.message || 'Failed to save draft', 'error');
            }
        } catch (error) {
            console.error('[ReactionRoles] Save error:', error);
            showNotification('Failed to save draft', 'error');
        }
    }

    async function sendToDiscord() {
        const config = getConfigFromForm();

        if (!validateConfig(config)) {
            return;
        }

        // If editing an existing draft, save it first
        if (state.editingId) {
            await saveDraft();
        } else {
            // Create draft first
            try {
                const dashboardCore = getDashboardCore();
                const response = await fetch(
                    `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/reaction-roles`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('discord_token')}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(config)
                    }
                );

                const data = await response.json();

                if (data.success) {
                    state.editingId = data.data.id;
                } else {
                    showNotification(data.message || 'Failed to create draft', 'error');
                    return;
                }
            } catch (error) {
                console.error('[ReactionRoles] Create error:', error);
                showNotification('Failed to create draft', 'error');
                return;
            }
        }

        // Now send to Discord
        try {
            const dashboardCore = getDashboardCore();
            const suppressPings = getValue('suppressRolePings') === true || getValue('suppressRolePings') === 'on';

            const response = await fetch(
                `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/reaction-roles/${state.editingId}/send`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('discord_token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ suppress_role_pings: suppressPings })
                }
            );

            const data = await response.json();

            if (data.success) {
                showNotification('Sent to Discord successfully!', 'success');
                navigateTo('reaction-roles');
            } else {
                showNotification(data.message || 'Failed to send to Discord', 'error');
            }
        } catch (error) {
            console.error('[ReactionRoles] Send error:', error);
            showNotification('Failed to send to Discord', 'error');
        }
    }

    async function updateMessage() {
        const config = getConfigFromForm();

        if (!validateConfig(config)) {
            return;
        }

        if (!state.editingId) {
            showNotification('No reaction role to update', 'error');
            return;
        }

        try {
            const dashboardCore = getDashboardCore();
            const suppressPings = getValue('suppressRolePings') === true || getValue('suppressRolePings') === 'on';
            config.suppress_role_pings = suppressPings;

            const response = await fetch(
                `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/reaction-roles/${state.editingId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('discord_token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(config)
                }
            );

            const data = await response.json();

            if (data.success) {
                showNotification('Message updated successfully!', 'success');
                navigateTo('reaction-roles');
            } else {
                showNotification(data.message || 'Failed to update message', 'error');
            }
        } catch (error) {
            console.error('[ReactionRoles] Update error:', error);
            showNotification('Failed to update message', 'error');
        }
    }

    function validateConfig(config) {
        if (!config.name) {
            showNotification('Name is required', 'error');
            return false;
        }

        if (!config.channel_id) {
            showNotification('Please select a channel', 'error');
            return false;
        }

        // Check for at least one role mapping
        let hasMappings = false;
        if (config.interaction_type === 'emoji' && config.emoji_role_mappings) {
            hasMappings = Object.keys(config.emoji_role_mappings).length > 0;
        } else if (config.interaction_type === 'button' && config.button_configs) {
            hasMappings = config.button_configs.length > 0;
        } else if (config.interaction_type === 'dropdown' && config.dropdown_config) {
            hasMappings = config.dropdown_config.options.length > 0;
        }

        if (!hasMappings) {
            showNotification('Please add at least one role mapping', 'error');
            return false;
        }

        return true;
    }

    function cancel() {
        if (confirm('Are you sure? Any unsaved changes will be lost.')) {
            navigateTo('reaction-roles');
        }
    }

    // ========================================================================
    // Actions - Preview, Duplicate, Delete
    // ========================================================================

    function showPreviewModal(id) {
        const rr = state.reactionRoles.find(r => r.id === id);
        if (!rr) return;

        const container = document.getElementById('modalRRPreviewContainer');
        const modal = document.getElementById('previewRRModal');

        if (container && modal) {
            // Construct config from rr object to reuse buildPreviewHtml
            const config = {
                text_content: rr.text_content,
                embed_config: rr.embed_config,
                interaction_type: rr.interaction_type,
                emoji_role_mappings: rr.emoji_role_mappings,
                button_configs: rr.button_configs,
                dropdown_config: rr.dropdown_config
            };

            container.innerHTML = buildPreviewHtml(config);
            modal.style.display = 'flex';
        }
    }

    function hidePreviewModal() {
        const modal = document.getElementById('previewRRModal');
        if (modal) modal.style.display = 'none';
    }

    async function duplicateReactionRole(id) {
        try {
            const dashboardCore = getDashboardCore();
            const response = await fetch(
                `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/reaction-roles/${id}/duplicate`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` }
                }
            );

            const data = await response.json();

            if (data.success) {
                showNotification('Reaction role duplicated!', 'success');
                await fetchReactionRoles();
                renderList();
            } else {
                showNotification(data.message || 'Failed to duplicate', 'error');
            }
        } catch (error) {
            console.error('[ReactionRoles] Duplicate error:', error);
            showNotification('Failed to duplicate reaction role', 'error');
        }
    }

    let deleteTargetId = null;

    function showDeleteModal(id) {
        deleteTargetId = id;
        const modal = document.getElementById('deleteRRModal');
        if (modal) modal.style.display = 'flex';

        const confirmBtn = document.getElementById('confirmDeleteRRBtn');
        if (confirmBtn) {
            confirmBtn.onclick = confirmDelete;
        }
    }

    function hideDeleteModal() {
        deleteTargetId = null;
        const modal = document.getElementById('deleteRRModal');
        if (modal) modal.style.display = 'none';
    }

    async function confirmDelete() {
        if (!deleteTargetId) return;

        try {
            const dashboardCore = getDashboardCore();
            const response = await fetch(
                `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/reaction-roles/${deleteTargetId}`,
                {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` }
                }
            );

            const data = await response.json();

            if (data.success) {
                showNotification('Reaction role deleted!', 'success');
                hideDeleteModal();
                await fetchReactionRoles();
                await fetchStats();
                renderList();
            } else {
                showNotification(data.message || 'Failed to delete', 'error');
            }
        } catch (error) {
            console.error('[ReactionRoles] Delete error:', error);
            showNotification('Failed to delete reaction role', 'error');
        }
    }

    // ========================================================================
    // Utility Functions
    // ========================================================================

    function editReactionRole(id) {
        navigateTo(`reaction-roles/edit/${id}`);
    }

    function toggleSection(sectionId) {
        const section = document.getElementById(sectionId);
        const header = section?.previousElementSibling;
        const toggle = header?.querySelector('.form-section-toggle');

        if (section && toggle) {
            const isCollapsed = section.classList.contains('collapsed');
            if (isCollapsed) {
                section.classList.remove('collapsed');
                toggle.textContent = '▼';
            } else {
                section.classList.add('collapsed');
                toggle.textContent = '▶';
            }
        }
    }

    function cleanup() {
        state = {
            guildId: null,
            reactionRoles: [],
            editingId: null,
            stats: null,
            channels: [],
            roles: [],
            interactionType: 'emoji',
            roleMappings: [],
            embedConfig: {},
            currentView: 'list',
            previewDebounce: null,
            currentEmojiTarget: null,
            currentTab: 'standard'
        };
    }

    function getValue(id) {
        const el = document.getElementById(id);
        if (!el) return '';

        if (el.type === 'checkbox') {
            return el.checked;
        }
        return el.value || '';
    }

    function setValue(id, value) {
        const el = document.getElementById(id);
        if (!el) return;

        if (el.type === 'checkbox') {
            el.checked = !!value;
        } else {
            el.value = value || '';
        }
    }

    function capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function navigateTo(route) {
        const dashboardCore = getDashboardCore();
        if (dashboardCore?.loadFeature) {
            dashboardCore.loadFeature(route);
        }
    }

    function getDashboardCore() {
        return window.DashboardCore;
    }

    function loadCSS(href) {
        if (!document.querySelector(`link[href="${href}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        }
    }

    async function loadScript(src) {
        if (document.querySelector(`script[src="${src}"]`)) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function showNotification(message, type = 'info') {
        const dashboardCore = getDashboardCore();
        if (dashboardCore && dashboardCore.showNotification) {
            dashboardCore.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
            alert(message);
        }
    }

    function showError(message) {
        showNotification(message, 'error');
    }

    // ========================================================================
    // Public API
    // ========================================================================

    return {
        init,
        cleanup,
        editReactionRole,
        showPreviewModal,
        hidePreviewModal,
        duplicateReactionRole,
        showDeleteModal,
        hideDeleteModal,
        saveDraft,
        sendToDiscord,
        updateMessage,
        cancel,
        toggleSection,
        addEmojiMapping,
        removeEmojiMapping,
        addButtonConfig,
        removeButtonConfig,
        addDropdownOption,
        removeDropdownOption,
        updatePreview,
        openEmojiPicker,
        closeEmojiPicker,
        switchEmojiTab,
        filterEmojis,
        selectEmoji
    };
})();

window.ReactionRolesFeature = ReactionRolesFeature;
