/**
 * Custom Commands Feature Module
 * Handles custom command creation and management
 */

function getDashboardCore() {
    return window.DashboardCore;
}

const CustomCommandsFeature = {
    state: {
        initialized: false,
        commands: [],
        editingId: null,
        responseType: 'text',
        commandLimit: 25
    },

    async init() {
        console.log('CustomCommandsFeature.init() called');

        const dashboardCore = getDashboardCore();
        if (!dashboardCore) {
            console.error('DashboardCore not available');
            return;
        }

        await dashboardCore.initForSPA('custom-commands');

        // Fetch commands from API
        await this.fetchCommands();

        this.populateUI();
        this.setupEventListeners();

        this.state.initialized = true;
        console.log('CustomCommandsFeature initialized');
    },

    async cleanup() {
        console.log('CustomCommandsFeature.cleanup() called');
        this.hideForm();
        this.state.initialized = false;
    },

    async fetchCommands() {
        const dashboardCore = getDashboardCore();
        if (!dashboardCore) return;

        try {
            const token = localStorage.getItem('discord_token');
            const guildId = dashboardCore.state.currentGuildId;

            const response = await fetch(`${dashboardCore.API_BASE_URL}/api/guilds/${guildId}/custom-commands`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.state.commands = data.commands || [];
                    console.log('Fetched commands:', this.state.commands);
                }
            }

            // Also fetch stats for command limit
            const statsResponse = await fetch(`${dashboardCore.API_BASE_URL}/api/guilds/${guildId}/custom-commands/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (statsResponse.ok) {
                const statsData = await statsResponse.json();
                if (statsData.success && statsData.stats) {
                    this.state.commandLimit = statsData.stats.max_commands || 25;
                }
            }
        } catch (error) {
            console.error('Error fetching commands:', error);
        }
    },

    populateUI() {
        this.renderCommandsList();
        this.updateCommandCount();
    },

    renderCommandsList() {
        const listContainer = document.getElementById('commandsList');
        const emptyState = document.getElementById('emptyState');

        if (!listContainer) return;

        if (this.state.commands.length === 0) {
            listContainer.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        listContainer.innerHTML = this.state.commands.map((cmd, index) => {
            const trigger = `${cmd.prefix || '!'}${cmd.command}`;
            const responseType = cmd.response_type || 'text';
            const responsePreview = responseType === 'text'
                ? this.truncate(cmd.response_text || '', 60)
                : this.truncate(cmd.embed_config?.title || cmd.embed_config?.description || 'Rich Embed', 60);

            const typeBadge = responseType === 'text'
                ? '<span class="response-type-badge text">Text</span>'
                : '<span class="response-type-badge embed">Embed</span>';

            return `
                <div class="command-item" data-command-id="${cmd.id}">
                    <div class="command-info">
                        <div class="command-trigger">${this.escapeHtml(trigger)}</div>
                        <div class="command-response">${this.escapeHtml(responsePreview)}</div>
                        <div class="command-meta">
                            ${typeBadge}
                            ${cmd.uses ? `<span>Used ${cmd.uses} times</span>` : ''}
                        </div>
                    </div>
                    <div class="command-actions">
                        <button class="btn-edit" onclick="CustomCommandsFeature.editCommand(${index})">Edit</button>
                        <button class="btn-delete" onclick="CustomCommandsFeature.deleteCommand(${index})">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    updateCommandCount() {
        const countEl = document.getElementById('commandCount');
        if (countEl) {
            countEl.textContent = `${this.state.commands.length} / ${this.state.commandLimit} commands`;
        }

        const createBtn = document.getElementById('createNewBtn');
        if (createBtn) {
            const atLimit = this.state.commands.length >= this.state.commandLimit;
            createBtn.disabled = atLimit;
            createBtn.style.opacity = atLimit ? '0.5' : '1';
            if (atLimit) {
                createBtn.title = 'Command limit reached';
            }
        }
    },

    showCreateForm() {
        if (this.state.commands.length >= this.state.commandLimit) {
            alert('You have reached the command limit. Delete some commands or upgrade to add more.');
            return;
        }

        this.state.editingId = null;
        this.state.responseType = 'text';

        // Reset form
        document.getElementById('formTitle').textContent = 'Create Command';
        document.getElementById('saveButtonText').textContent = 'Create Command';
        document.getElementById('commandPrefix').value = '!';
        document.getElementById('commandName').value = '';
        document.getElementById('responseText').value = '';
        document.getElementById('embedTitle').value = '';
        document.getElementById('embedDescription').value = '';
        document.getElementById('embedColor').value = '#5865F2';
        document.getElementById('embedThumbnail').value = '';
        document.getElementById('embedImage').value = '';
        document.getElementById('embedFooter').value = '';

        // Reset response type buttons
        document.querySelectorAll('.response-type-selector .type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === 'text');
        });

        this.setResponseType('text');
        this.updateCommandPreview();

        document.getElementById('commandForm').style.display = 'block';
    },

    editCommand(index) {
        const cmd = this.state.commands[index];
        if (!cmd) return;

        this.state.editingId = cmd.id;
        this.state.responseType = cmd.response_type || 'text';

        document.getElementById('formTitle').textContent = 'Edit Command';
        document.getElementById('saveButtonText').textContent = 'Save Changes';
        document.getElementById('commandPrefix').value = cmd.prefix || '!';
        document.getElementById('commandName').value = cmd.command || '';
        document.getElementById('responseText').value = cmd.response_text || '';

        if (cmd.embed_config) {
            document.getElementById('embedTitle').value = cmd.embed_config.title || '';
            document.getElementById('embedDescription').value = cmd.embed_config.description || '';
            document.getElementById('embedColor').value = this.intToHex(cmd.embed_config.color) || '#5865F2';
            document.getElementById('embedThumbnail').value = cmd.embed_config.thumbnail?.url || '';
            document.getElementById('embedImage').value = cmd.embed_config.image?.url || '';
            document.getElementById('embedFooter').value = cmd.embed_config.footer?.text || '';
        }

        // Update response type buttons
        document.querySelectorAll('.response-type-selector .type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === this.state.responseType);
        });

        this.setResponseType(this.state.responseType);
        this.updateCommandPreview();

        document.getElementById('commandForm').style.display = 'block';
    },

    hideForm() {
        document.getElementById('commandForm').style.display = 'none';
        this.state.editingId = null;
    },

    setResponseType(type) {
        this.state.responseType = type;

        document.querySelectorAll('.response-type-selector .type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        document.getElementById('textResponseSection').style.display = type === 'text' ? 'block' : 'none';
        document.getElementById('embedResponseSection').style.display = type === 'embed' ? 'block' : 'none';
    },

    updateCommandPreview() {
        const prefix = document.getElementById('commandPrefix').value;
        const name = document.getElementById('commandName').value || 'command';
        document.getElementById('commandPreview').textContent = `${prefix}${name}`;
    },

    insertVariable(variable) {
        const textarea = document.getElementById('responseText');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;

        textarea.value = text.substring(0, start) + variable + text.substring(end);
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + variable.length;
    },

    async saveCommand() {
        const dashboardCore = getDashboardCore();
        if (!dashboardCore) return;

        const prefix = document.getElementById('commandPrefix').value;
        const name = document.getElementById('commandName').value.trim().toLowerCase().replace(/\s+/g, '');

        if (!name) {
            alert('Please enter a command name');
            return;
        }

        if (!/^[a-z0-9_-]+$/.test(name)) {
            alert('Command name can only contain letters, numbers, underscores, and hyphens');
            return;
        }

        // Check for duplicate (excluding current command if editing)
        const isDuplicate = this.state.commands.some(cmd =>
            cmd.command === name && cmd.prefix === prefix && cmd.id !== this.state.editingId
        );
        if (isDuplicate) {
            alert('A command with this name and prefix already exists');
            return;
        }

        const payload = {
            command: name,
            prefix: prefix,
            response_type: this.state.responseType
        };

        if (this.state.responseType === 'text') {
            const responseText = document.getElementById('responseText').value.trim();
            if (!responseText) {
                alert('Please enter a response message');
                return;
            }
            payload.response_text = responseText;
        } else {
            const title = document.getElementById('embedTitle').value.trim();
            const description = document.getElementById('embedDescription').value.trim();

            if (!title && !description) {
                alert('Please enter at least a title or description for the embed');
                return;
            }

            payload.embed_config = {
                title: title || null,
                description: description || null,
                color: parseInt(document.getElementById('embedColor').value.replace('#', ''), 16)
            };

            const thumbnail = document.getElementById('embedThumbnail').value.trim();
            if (thumbnail) payload.embed_config.thumbnail = { url: thumbnail };

            const image = document.getElementById('embedImage').value.trim();
            if (image) payload.embed_config.image = { url: image };

            const footer = document.getElementById('embedFooter').value.trim();
            if (footer) payload.embed_config.footer = { text: footer };
        }

        try {
            const token = localStorage.getItem('discord_token');
            const guildId = dashboardCore.state.currentGuildId;

            const method = this.state.editingId ? 'PUT' : 'POST';
            const url = this.state.editingId
                ? `${dashboardCore.API_BASE_URL}/api/guilds/${guildId}/custom-commands/${this.state.editingId}`
                : `${dashboardCore.API_BASE_URL}/api/guilds/${guildId}/custom-commands`;

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || result.error || 'Failed to save command');
            }

            // Refresh commands list
            await this.fetchCommands();
            this.renderCommandsList();
            this.updateCommandCount();
            this.hideForm();

            // Update dashboard core count and nav indicator
            dashboardCore.state.customCommandsCount = this.state.commands.length;
            dashboardCore.updateNavIndicators();

            alert(this.state.editingId ? 'Command updated!' : 'Command created!');

        } catch (error) {
            console.error('Error saving command:', error);
            alert('Error: ' + error.message);
        }
    },

    async deleteCommand(index) {
        const cmd = this.state.commands[index];
        if (!cmd) return;

        if (!confirm(`Are you sure you want to delete the command "${cmd.prefix}${cmd.command}"?`)) {
            return;
        }

        const dashboardCore = getDashboardCore();
        if (!dashboardCore) return;

        try {
            const token = localStorage.getItem('discord_token');
            const guildId = dashboardCore.state.currentGuildId;

            const response = await fetch(`${dashboardCore.API_BASE_URL}/api/guilds/${guildId}/custom-commands/${cmd.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.message || 'Failed to delete command');
            }

            // Remove from local state
            this.state.commands.splice(index, 1);
            this.renderCommandsList();
            this.updateCommandCount();

            // Update dashboard core count and nav indicator
            dashboardCore.state.customCommandsCount = this.state.commands.length;
            dashboardCore.updateNavIndicators();

            alert('Command deleted!');

        } catch (error) {
            console.error('Error deleting command:', error);
            alert('Error: ' + error.message);
        }
    },

    setupEventListeners() {
        // Update command preview on input
        const nameInput = document.getElementById('commandName');
        const prefixSelect = document.getElementById('commandPrefix');

        if (nameInput) {
            nameInput.addEventListener('input', () => this.updateCommandPreview());
        }

        if (prefixSelect) {
            prefixSelect.addEventListener('change', () => this.updateCommandPreview());
        }

        // Close form on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideForm();
            }
        });
    },

    // Utility functions
    truncate(str, length) {
        if (!str) return '';
        return str.length > length ? str.substring(0, length) + '...' : str;
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    intToHex(int) {
        if (!int && int !== 0) return '#5865F2';
        return '#' + int.toString(16).padStart(6, '0');
    }
};

// Export for feature loader
window.CustomCommandsFeature = CustomCommandsFeature;
