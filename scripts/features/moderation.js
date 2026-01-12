// scripts/features/moderation.js

window.ModerationFeature = {
    init: function() {
        console.log('Initializing Moderation Feature...');
        this.populateUI(window.DashboardCore.state.guildConfig);
        this.addEventListeners();
    },

    cleanup: function() {
        console.log('Cleaning up Moderation Feature...');
        // In a more complex app, you'd remove listeners here.
    },

    populateUI: function(config) {
        if (!config || !config.settings) {
            console.error("ModerationFeature: guildConfig is missing or invalid.");
            return;
        }

        const modSettings = config.settings.moderation || {};
        const availableChannels = config.available_channels || [];

        // Main toggle
        const enabledToggle = document.getElementById('moderation-enabled-toggle');
        if (enabledToggle) {
            enabledToggle.checked = modSettings.enabled || false;
        }

        // Channel selects
        const modLogChannelSelect = document.getElementById('modLogChannelSelect');
        if (modLogChannelSelect) {
            modLogChannelSelect.innerHTML = '<option value="">Select a channel...</option>';
            availableChannels.forEach(channel => {
                const option = document.createElement('option');
                option.value = channel.id;
                option.textContent = `#${channel.name}`;
                modLogChannelSelect.appendChild(option);
            });
            modLogChannelSelect.value = modSettings.mod_log_channel_id || '';
        }

        const memberActivityChannelSelect = document.getElementById('memberActivityChannelSelect');
        if (memberActivityChannelSelect) {
            memberActivityChannelSelect.innerHTML = '<option value="">Select a channel...</option>';
            availableChannels.forEach(channel => {
                const option = document.createElement('option');
                option.value = channel.id;
                option.textContent = `#${channel.name}`;
                memberActivityChannelSelect.appendChild(option);
            });
            memberActivityChannelSelect.value = modSettings.member_activity_channel_id || '';
        }

        // Event toggles and individual channel selects
        const events = modSettings.events || {};
        document.querySelectorAll('#view-container .event-toggle input[type="checkbox"]').forEach(toggle => {
            const eventName = toggle.dataset.event;

            let isEnabled = false;
            let channelId = null;

            if (events.on_member_join && eventName === 'on_member_join') {
                isEnabled = events.on_member_join.enabled;
                channelId = events.on_member_join.channel_id;
            }
            if (events.on_member_remove && eventName === 'on_member_remove') {
                isEnabled = events.on_member_remove.enabled;
                channelId = events.on_member_remove.channel_id;
            }
            if (events.on_message_edit && eventName === 'on_message_edit') {
                isEnabled = events.on_message_edit.enabled;
                channelId = events.on_message_edit.channel_id;
            }
            if (events.on_message_delete && eventName === 'on_message_delete') {
                isEnabled = events.on_message_delete.enabled;
                channelId = events.on_message_delete.channel_id;
            }
            if (events.on_audit_log_entry) {
                if (events.on_audit_log_entry[eventName]) {
                    isEnabled = events.on_audit_log_entry[eventName].enabled;
                    channelId = events.on_audit_log_entry[eventName].channel_id;
                }
            }
             if (events.on_member_update) {
                if (events.on_member_update[eventName]) {
                    isEnabled = events.on_member_update[eventName].enabled;
                    channelId = events.on_member_update[eventName].channel_id;
                }
            }

            toggle.checked = isEnabled;

            // Populate individual channel select for this event
            const channelSelect = document.querySelector(`.event-channel-select[data-event="${eventName}"]`);
            if (channelSelect) {
                channelSelect.innerHTML = '<option value="">Use global channel</option>';
                availableChannels.forEach(channel => {
                    const option = document.createElement('option');
                    option.value = channel.id;
                    option.textContent = `#${channel.name}`;
                    channelSelect.appendChild(option);
                });
                channelSelect.value = channelId || '';
            }
        });
    },

    addEventListeners: function() {
        document.getElementById('moderation-enabled-toggle')?.addEventListener('change', this.handleEnableChange);
        document.getElementById('modLogChannelSelect')?.addEventListener('change', this.handleModLogChannelChange);
        document.getElementById('memberActivityChannelSelect')?.addEventListener('change', this.handleMemberActivityChannelChange);

        document.querySelectorAll('#view-container .event-toggle input[type="checkbox"]').forEach(toggle => {
            toggle.addEventListener('change', this.handleEventToggleChange);
        });

        // Add listeners for individual event channel selects
        document.querySelectorAll('#view-container .event-channel-select').forEach(select => {
            select.addEventListener('change', this.handleEventChannelChange);
        });
    },

    handleEnableChange: function(e) {
        if (!window.DashboardCore.state.guildConfig.settings.moderation) window.DashboardCore.state.guildConfig.settings.moderation = { events: {} };
        window.DashboardCore.state.guildConfig.settings.moderation.enabled = e.target.checked;
        window.DashboardCore.markUnsavedChanges();
    },

    handleModLogChannelChange: function(e) {
        if (!window.DashboardCore.state.guildConfig.settings.moderation) window.DashboardCore.state.guildConfig.settings.moderation = { events: {} };
        window.DashboardCore.state.guildConfig.settings.moderation.mod_log_channel_id = e.target.value || null;
        window.DashboardCore.markUnsavedChanges();
    },

    handleMemberActivityChannelChange: function(e) {
        if (!window.DashboardCore.state.guildConfig.settings.moderation) window.DashboardCore.state.guildConfig.settings.moderation = { events: {} };
        window.DashboardCore.state.guildConfig.settings.moderation.member_activity_channel_id = e.target.value || null;
        window.DashboardCore.markUnsavedChanges();
    },

    handleEventToggleChange: function(e) {
        const eventName = e.target.dataset.event;
        const isEnabled = e.target.checked;
        const modSettings = window.DashboardCore.state.guildConfig.settings.moderation;

        if (!modSettings.events) modSettings.events = {};

        const auditEvents = ['ban', 'unban', 'kick', 'mute', 'role_change'];
        const memberUpdateEvents = ['nickname_change'];

        if (auditEvents.includes(eventName)) {
            if (!modSettings.events.on_audit_log_entry) modSettings.events.on_audit_log_entry = {};
            if (!modSettings.events.on_audit_log_entry[eventName]) modSettings.events.on_audit_log_entry[eventName] = {};
            modSettings.events.on_audit_log_entry[eventName].enabled = isEnabled;
        } else if (memberUpdateEvents.includes(eventName)) {
            if (!modSettings.events.on_member_update) modSettings.events.on_member_update = {};
            if (!modSettings.events.on_member_update[eventName]) modSettings.events.on_member_update[eventName] = {};
            modSettings.events.on_member_update[eventName].enabled = isEnabled;
        } else {
            if (!modSettings.events[eventName]) modSettings.events[eventName] = {};
            modSettings.events[eventName].enabled = isEnabled;
        }

        window.DashboardCore.markUnsavedChanges();
    },

    handleEventChannelChange: function(e) {
        const eventName = e.target.dataset.event;
        const channelId = e.target.value || null;
        const modSettings = window.DashboardCore.state.guildConfig.settings.moderation;

        if (!modSettings.events) modSettings.events = {};

        const auditEvents = ['ban', 'unban', 'kick', 'mute', 'role_change'];
        const memberUpdateEvents = ['nickname_change'];

        if (auditEvents.includes(eventName)) {
            if (!modSettings.events.on_audit_log_entry) modSettings.events.on_audit_log_entry = {};
            if (!modSettings.events.on_audit_log_entry[eventName]) modSettings.events.on_audit_log_entry[eventName] = {};
            modSettings.events.on_audit_log_entry[eventName].channel_id = channelId;
        } else if (memberUpdateEvents.includes(eventName)) {
            if (!modSettings.events.on_member_update) modSettings.events.on_member_update = {};
            if (!modSettings.events.on_member_update[eventName]) modSettings.events.on_member_update[eventName] = {};
            modSettings.events.on_member_update[eventName].channel_id = channelId;
        } else {
            if (!modSettings.events[eventName]) modSettings.events[eventName] = {};
            modSettings.events[eventName].channel_id = channelId;
        }

        window.DashboardCore.markUnsavedChanges();
    },

    saveChanges: async function() {
        const settingsToSave = {
            moderation: window.DashboardCore.state.guildConfig.settings.moderation
        };
        await window.DashboardCore.saveGuildConfig(settingsToSave);
    }
};