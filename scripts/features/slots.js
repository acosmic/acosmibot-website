/**
 * Slots Feature Module
 * Handles the slots machine configuration with emoji tier selection
 */

function getDashboardCore() {
    return window.DashboardCore;
}

const SlotsFeature = {
    state: {
        initialized: false,
        currentTier: null,
        currentEmojiIndex: null,
        currentTab: 'custom',
        tierEmojis: {
            common: [],
            uncommon: [],
            rare: [],
            legendary: [],
            scatter: []
        },
        tierRequirements: {
            common: 5,
            uncommon: 3,
            rare: 1,
            legendary: 2,
            scatter: 1
        }
    },

    // Standard emoji categories for the picker
    standardEmojis: {
        fruits: ['🍒', '🍋', '🍊', '🍇', '🍌', '🍎', '🍐', '🍑', '🍓', '🫐', '🥝', '🍈', '🍉', '🥭', '🍍'],
        symbols: ['⭐', '🔔', '❤️', '💎', '🎰', '💰', '💵', '💴', '💶', '💷', '🪙', '💸', '🏆', '👑', '🎯'],
        lucky: ['🍀', '🌟', '✨', '💫', '🎲', '🎁', '🎀', '🏅', '🥇', '🎊', '🎉', '🔮', '🌈', '☘️', '🐞'],
        misc: ['7️⃣', '🃏', '🎴', '🀄', '🎱', '🔥', '💥', '⚡', '🌙', '☀️', '🌸', '🦄', '🐉', '🎃', '👻']
    },

    async init() {
        console.log('SlotsFeature.init() called');

        const dashboardCore = getDashboardCore();
        if (!dashboardCore) {
            console.error('DashboardCore not available');
            return;
        }

        await dashboardCore.initForSPA('slots');

        this.populateSlotsUI();
        this.setupEventListeners();

        this.state.initialized = true;
        console.log('SlotsFeature initialized');
    },

    async cleanup() {
        console.log('SlotsFeature.cleanup() called');
        this.closeEmojiPicker();
        this.state.initialized = false;
    },

    populateSlotsUI() {
        const dashboardCore = getDashboardCore();
        const config = dashboardCore?.state?.guildConfig;

        console.log('populateSlotsUI - config:', config);

        if (!config) {
            console.warn('No guild config available');
            return;
        }

        // Get games/slots config
        const gamesConfig = config.settings?.games || {};
        const slotsConfig = gamesConfig['slots-config'] || {};

        console.log('populateSlotsUI - slotsConfig:', slotsConfig);

        // Set feature toggle
        const featureToggle = document.getElementById('featureToggle');
        if (featureToggle) {
            featureToggle.checked = slotsConfig.enabled === true;
            featureToggle.addEventListener('change', () => this.handleToggleChange());
        }

        // Get tier emojis with defaults
        const tierEmojis = slotsConfig.tier_emojis || {
            common: ['🍒', '🍋', '🍊', '🍇', '🍌'],
            uncommon: ['⭐', '🔔', '❤️'],
            rare: ['🍀'],
            legendary: ['💎', '🎰'],
            scatter: ['7️⃣']
        };

        // Store in state
        this.state.tierEmojis = {
            common: [...(tierEmojis.common || [])],
            uncommon: [...(tierEmojis.uncommon || [])],
            rare: [...(tierEmojis.rare || [])],
            legendary: [...(tierEmojis.legendary || [])],
            scatter: [...(tierEmojis.scatter || [])]
        };

        // Render all tiers
        this.renderTierEmojis('common');
        this.renderTierEmojis('uncommon');
        this.renderTierEmojis('rare');
        this.renderTierEmojis('legendary');
        this.renderTierEmojis('scatter');

        // Update section disabled states
        this.updateSectionStates();
    },

    renderTierEmojis(tier) {
        const container = document.getElementById(`${tier}Emojis`);
        if (!container) return;

        const emojis = this.state.tierEmojis[tier] || [];
        const availableEmojis = getDashboardCore()?.state?.guildConfig?.available_emojis || [];

        container.innerHTML = emojis.map((emoji, index) => {
            const displayEmoji = this.getEmojiDisplay(emoji, availableEmojis);
            return `
                <div class="emoji-slot-item" onclick="SlotsFeature.openEmojiPicker('${tier}', ${index})">
                    ${displayEmoji}
                    <button class="remove-emoji" onclick="event.stopPropagation(); SlotsFeature.removeEmojiFromTier('${tier}', ${index})">&times;</button>
                </div>
            `;
        }).join('');

        // Update count display
        this.updateTierCount(tier);
    },

    updateTierCount(tier) {
        const countEl = document.getElementById(`${tier}Count`);
        if (!countEl) return;

        const current = this.state.tierEmojis[tier]?.length || 0;
        const required = this.state.tierRequirements[tier] || 0;

        countEl.textContent = `${current} / ${required}`;
        countEl.style.color = current >= required ? 'var(--success-color)' : 'var(--text-secondary)';

        // Update Add Emoji button disabled state
        const addBtn = document.getElementById(`${tier}AddBtn`);
        if (addBtn) {
            addBtn.disabled = current >= required;
        }
    },

    getEmojiDisplay(emoji, availableEmojis = []) {
        // Check if it's a custom Discord emoji format <:name:id> or <a:name:id>
        const match = emoji.match(/<(a?):([^:]+):(\d+)>/);
        if (match) {
            const animated = match[1] === 'a';
            const name = match[2];
            const id = match[3];
            const ext = animated ? 'gif' : 'png';
            return `<img src="https://cdn.discordapp.com/emojis/${id}.${ext}" alt="${name}" title="${name}">`;
        }
        // Standard emoji
        return emoji;
    },

    addEmojiToTier(tier) {
        this.state.currentTier = tier;
        this.state.currentEmojiIndex = null; // Adding new emoji
        this.openEmojiPickerModal();
    },

    openEmojiPicker(tier, index) {
        this.state.currentTier = tier;
        this.state.currentEmojiIndex = index;
        this.openEmojiPickerModal();
    },

    openEmojiPickerModal() {
        const modal = document.getElementById('emojiPickerModal');
        if (modal) {
            modal.style.display = 'flex';
            this.switchEmojiTab('custom');
            document.getElementById('emojiSearchInput').value = '';
        }
    },

    closeEmojiPicker() {
        const modal = document.getElementById('emojiPickerModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.state.currentTier = null;
        this.state.currentEmojiIndex = null;
    },

    switchEmojiTab(tab) {
        this.state.currentTab = tab;

        // Update tab buttons
        document.querySelectorAll('.emoji-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Render emojis
        this.renderEmojiPickerGrid();
    },

    filterEmojis(query) {
        this.renderEmojiPickerGrid(query.toLowerCase());
    },

    renderEmojiPickerGrid(searchQuery = '') {
        const grid = document.getElementById('emojiPickerGrid');
        if (!grid) return;

        const allSelectedEmojis = this.getAllSelectedEmojis();
        let emojis = [];

        if (this.state.currentTab === 'standard') {
            // Flatten standard emojis
            Object.values(this.standardEmojis).forEach(category => {
                emojis.push(...category);
            });

            // Filter by search if provided
            if (searchQuery) {
                // For standard emojis, we can't really search by name, so just show all
                // unless we maintain a name mapping
            }

            grid.innerHTML = emojis.map(emoji => {
                const isUsed = allSelectedEmojis.includes(emoji);
                const disabledClass = isUsed ? 'disabled' : '';
                const disabledAttr = isUsed ? 'disabled' : '';

                return `
                    <button class="emoji-picker-item ${disabledClass}" onclick="SlotsFeature.selectEmoji('${emoji}')" title="${emoji}" ${disabledAttr}>
                        ${emoji}
                    </button>
                `;
            }).join('');
        } else {
            // Custom server emojis
            const availableEmojis = getDashboardCore()?.state?.guildConfig?.available_emojis || [];

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
                const emojiValue = this.buildCustomEmojiValue(emoji);
                const ext = emoji.animated ? 'gif' : 'png';
                const imgUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}`;
                const isUsed = allSelectedEmojis.includes(emojiValue);
                const disabledClass = isUsed ? 'disabled' : '';
                const disabledAttr = isUsed ? 'disabled' : '';

                return `
                    <button class="emoji-picker-item ${disabledClass}" onclick="SlotsFeature.selectEmoji('${emojiValue.replace(/'/g, "\\'")}')" title="${emoji.name}" ${disabledAttr}>
                        <img src="${imgUrl}" alt="${emoji.name}">
                    </button>
                `;
            }).join('');
        }
    },

    buildCustomEmojiValue(emoji) {
        // Build Discord emoji format: <:name:id> or <a:name:id>
        const prefix = emoji.animated ? 'a' : '';
        return `<${prefix}:${emoji.name}:${emoji.id}>`;
    },

    selectEmoji(emoji) {
        const tier = this.state.currentTier;
        const index = this.state.currentEmojiIndex;

        if (!tier) return;

        const dashboardCore = getDashboardCore();

        // Check if emoji is already used
        const allSelectedEmojis = this.getAllSelectedEmojis();
        if (allSelectedEmojis.includes(emoji)) {
            alert('This emoji is already being used in another tier. Each emoji can only be used once.');
            return;
        }

        if (index === null) {
            // Adding new emoji
            this.state.tierEmojis[tier].push(emoji);
        } else {
            // Replacing existing emoji
            this.state.tierEmojis[tier][index] = emoji;
        }

        // Re-render the tier
        this.renderTierEmojis(tier);

        // Update the guild config to reflect changes
        this.syncTierEmojisToConfig();

        // Mark unsaved changes
        dashboardCore?.markUnsavedChanges();

        // Close picker
        this.closeEmojiPicker();
    },

    removeEmojiFromTier(tier, index) {
        const dashboardCore = getDashboardCore();

        this.state.tierEmojis[tier].splice(index, 1);
        this.renderTierEmojis(tier);

        // Update the guild config to reflect changes
        this.syncTierEmojisToConfig();

        // Mark unsaved changes
        dashboardCore?.markUnsavedChanges();
    },

    syncTierEmojisToConfig() {
        const dashboardCore = getDashboardCore();
        if (!dashboardCore?.state?.guildConfig?.settings) return;

        // Ensure games config exists
        if (!dashboardCore.state.guildConfig.settings.games) {
            dashboardCore.state.guildConfig.settings.games = {};
        }

        // Ensure slots-config exists
        if (!dashboardCore.state.guildConfig.settings.games['slots-config']) {
            dashboardCore.state.guildConfig.settings.games['slots-config'] = {};
        }

        // Update tier_emojis in the config
        dashboardCore.state.guildConfig.settings.games['slots-config'].tier_emojis = {
            common: [...this.state.tierEmojis.common],
            uncommon: [...this.state.tierEmojis.uncommon],
            rare: [...this.state.tierEmojis.rare],
            legendary: [...this.state.tierEmojis.legendary],
            scatter: [...this.state.tierEmojis.scatter]
        };
    },

    getAllSelectedEmojis() {
        const allEmojis = [];
        Object.values(this.state.tierEmojis).forEach(tierArray => {
            allEmojis.push(...tierArray);
        });
        return allEmojis;
    },

    handleToggleChange() {
        const dashboardCore = getDashboardCore();
        this.updateSectionStates();

        // Update the guild config to reflect toggle change
        const featureToggle = document.getElementById('featureToggle');
        if (dashboardCore?.state?.guildConfig?.settings?.games) {
            if (!dashboardCore.state.guildConfig.settings.games['slots-config']) {
                dashboardCore.state.guildConfig.settings.games['slots-config'] = {};
            }
            dashboardCore.state.guildConfig.settings.games['slots-config'].enabled = featureToggle?.checked ?? false;
        }

        dashboardCore?.markUnsavedChanges();
    },

    updateSectionStates() {
        const featureToggle = document.getElementById('featureToggle');
        const isEnabled = featureToggle?.checked ?? false;

        // Enable/disable tier sections
        document.querySelectorAll('.tier-section').forEach(section => {
            const inputs = section.querySelectorAll('button, input, select');
            inputs.forEach(input => {
                if (!input.classList.contains('toggle-slider') && input.id !== 'featureToggle') {
                    // Don't just disable all buttons - we need to check if Add Emoji buttons should be disabled based on tier limits
                    if (input.classList.contains('btn-add-emoji')) {
                        // Skip - will be handled by updateTierCount
                    } else {
                        input.disabled = !isEnabled;
                    }
                }
            });
            section.style.opacity = isEnabled ? '1' : '0.5';
        });

        // Update tier counts and button states for Add Emoji buttons
        if (isEnabled) {
            this.updateTierCount('common');
            this.updateTierCount('uncommon');
            this.updateTierCount('rare');
            this.updateTierCount('legendary');
            this.updateTierCount('scatter');
        } else {
            // When feature is disabled, disable all Add Emoji buttons
            document.querySelectorAll('.btn-add-emoji').forEach(btn => {
                btn.disabled = true;
            });
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

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeEmojiPicker();
            }
        });
    },

    async saveAllChanges() {
        const dashboardCore = getDashboardCore();
        if (!dashboardCore) {
            console.error('DashboardCore not available');
            return;
        }

        const featureToggle = document.getElementById('featureToggle');

        const slotsConfig = {
            enabled: featureToggle?.checked ?? false,
            tier_emojis: {
                common: [...this.state.tierEmojis.common],
                uncommon: [...this.state.tierEmojis.uncommon],
                rare: [...this.state.tierEmojis.rare],
                legendary: [...this.state.tierEmojis.legendary],
                scatter: [...this.state.tierEmojis.scatter]
            }
        };

        // Get current games config to preserve other game settings
        const currentGames = dashboardCore.state.guildConfig?.settings?.games || {};

        const updatePayload = {
            games: {
                ...currentGames,
                enabled: currentGames.enabled !== false,
                'slots-config': slotsConfig
            }
        };

        console.log('Saving slots config:', updatePayload);

        try {
            await dashboardCore.saveGuildConfig(updatePayload);
            console.log('Slots config saved successfully');
        } catch (error) {
            console.error('Failed to save slots config:', error);
        }
    }
};

// Export for feature loader
window.SlotsFeature = SlotsFeature;
