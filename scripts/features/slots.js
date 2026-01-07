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
        currentTab: 'standard',
        tierEmojis: {
            common: [],
            uncommon: [],
            rare: [],
            legendary: [],
            scatter: []
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
            this.switchEmojiTab('standard');
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

            grid.innerHTML = emojis.map(emoji => `
                <button class="emoji-picker-item" onclick="SlotsFeature.selectEmoji('${emoji}')" title="${emoji}">
                    ${emoji}
                </button>
            `).join('');
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

                return `
                    <button class="emoji-picker-item" onclick="SlotsFeature.selectEmoji('${emojiValue.replace(/'/g, "\\'")}')" title="${emoji.name}">
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

        if (index === null) {
            // Adding new emoji
            this.state.tierEmojis[tier].push(emoji);
        } else {
            // Replacing existing emoji
            this.state.tierEmojis[tier][index] = emoji;
        }

        // Re-render the tier
        this.renderTierEmojis(tier);

        // Mark unsaved changes
        dashboardCore?.markUnsavedChanges();

        // Close picker
        this.closeEmojiPicker();
    },

    removeEmojiFromTier(tier, index) {
        const dashboardCore = getDashboardCore();

        this.state.tierEmojis[tier].splice(index, 1);
        this.renderTierEmojis(tier);

        dashboardCore?.markUnsavedChanges();
    },

    handleToggleChange() {
        const dashboardCore = getDashboardCore();
        this.updateSectionStates();
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
                    input.disabled = !isEnabled;
                }
            });
            section.style.opacity = isEnabled ? '1' : '0.5';
        });
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
