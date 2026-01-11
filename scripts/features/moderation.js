// scripts/features/moderation.js

window.ModerationFeature = {
    init: function() {
        console.log('Initializing Moderation Feature...');
        this.populateUI(window.state.guildConfig);
        this.addEventListeners();
    },

    cleanup: function() {
        console.log('Cleaning up Moderation Feature...');
        // In a more complex app, you'd remove listeners here.
        // For now, since the view is destroyed, it's not strictly necessary.
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
        
        // Event toggles
        const events = modSettings.events || {};
        document.querySelectorAll('#view-container .event-toggle input[type="checkbox"]').forEach(toggle => {
            const eventName = toggle.dataset.event;
            
            let isEnabled = false;
            if (events.on_member_join && eventName === 'on_member_join') isEnabled = events.on_member_join.enabled;
            if (events.on_member_remove && eventName === 'on_member_remove') isEnabled = events.on_member_remove.enabled;
            if (events.on_message_edit && eventName === 'on_message_edit') isEnabled = events.on_message_edit.enabled;
            if (events.on_message_delete && eventName === 'on_message_delete') isEnabled = events.on_message_delete.enabled;
            if (events.on_audit_log_entry) {
                if (events.on_audit_log_entry[eventName]) {
                    isEnabled = events.on_audit_log_entry[eventName].enabled;
                }
            }
             if (events.on_member_update) {
                if (events.on_member_update[eventName]) {
                    isEnabled = events.on_member_update[eventName].enabled;
                }
            }

            toggle.checked = isEnabled;
        });
    },

    addEventListeners: function() {
        document.getElementById('moderation-enabled-toggle')?.addEventListener('change', this.handleEnableChange);
        document.getElementById('modLogChannelSelect')?.addEventListener('change', this.handleModLogChannelChange);
        document.getElementById('memberActivityChannelSelect')?.addEventListener('change', this.handleMemberActivityChannelChange);
        
        document.querySelectorAll('#view-container .event-toggle input[type="checkbox"]').forEach(toggle => {
            toggle.addEventListener('change', this.handleEventToggleChange);
        });
    },

    handleEnableChange: function(e) {
        if (!window.state.guildConfig.settings.moderation) window.state.guildConfig.settings.moderation = { events: {} };
        window.state.guildConfig.settings.moderation.enabled = e.target.checked;
        window.markUnsavedChanges();
    },

    handleModLogChannelChange: function(e) {
        if (!window.state.guildConfig.settings.moderation) window.state.guildConfig.settings.moderation = { events: {} };
        window.state.guildConfig.settings.moderation.mod_log_channel_id = e.target.value || null;
        window.markUnsavedChanges();
    },

    handleMemberActivityChannelChange: function(e) {
        if (!window.state.guildConfig.settings.moderation) window.state.guildConfig.settings.moderation = { events: {} };
        window.state.guildConfig.settings.moderation.member_activity_channel_id = e.target.value || null;
        window.markUnsavedChanges();
    },

    handleEventToggleChange: function(e) {
        const eventName = e.target.dataset.event;
        const isEnabled = e.target.checked;
        const modSettings = window.state.guildConfig.settings.moderation;

        if (!modSettings.events) modSettings.events = {};

        // This needs to match the nested structure of the API
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
        
        window.markUnsavedChanges();
    }
};