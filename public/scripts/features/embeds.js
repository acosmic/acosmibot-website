/**
 * Embeds Feature Module
 */

const EmbedsFeature = (function() {
    'use strict';

    let state = {
        guildId: null,
        embeds: [],
        editingId: null,
        stats: null,
        channels: [],
        currentUploadType: null
    };

    async function init(params = {}) {
        console.log('[Embeds] Init called with params:', params);

        const dashboardCore = getDashboardCore();
        console.log('[Embeds] DashboardCore:', dashboardCore);
        console.log('[Embeds] Current Guild ID:', dashboardCore?.state?.currentGuildId);

        if (!dashboardCore) {
            console.error('[Embeds] DashboardCore not available');
            showError('Dashboard not initialized');
            return;
        }

        const guildId = dashboardCore.state.currentGuildId;

        if (!guildId) {
            console.error('[Embeds] No guild ID available');
            showError('No guild selected');
            return;
        }

        state.guildId = guildId;

        // Initialize dashboard core for SPA (renders server branding)
        await dashboardCore.initForSPA('embeds');

        loadCSS('/styles/embeds.css');
        await loadScript('/scripts/shared/embed-preview.js');

        const route = params.route || 'embeds';
        console.log('[Embeds] Route:', route);

        try {
            if (route === 'embeds/new') {
                await showBuilder();
            } else if (route.startsWith('embeds/edit/')) {
                state.editingId = params.embedId || route.split('/')[2];
                await showBuilder(state.editingId);
            } else {
                await showList();
            }
        } catch (error) {
            console.error('[Embeds] Init error:', error);
            showError('Failed to initialize embeds feature');
        }
    }

    async function showList() {
        console.log('[Embeds] showList called');

        try {
            // Show list view, hide builder view
            const listView = document.getElementById('embedsListView');
            const builderView = document.getElementById('embedsBuilderView');

            if (!listView || !builderView) {
                throw new Error('Embeds view sections not found');
            }

            listView.style.display = 'block';
            builderView.style.display = 'none';

            console.log('[Embeds] List view shown');

            await Promise.all([fetchEmbeds(), fetchStats()]);
            setupListEventListeners();
            renderList();
        } catch (error) {
            console.error('[Embeds] showList error:', error);
            showError('Failed to load embeds list: ' + error.message);
        }
    }

    async function showBuilder(embedId = null) {
        console.log('[Embeds] showBuilder called, embedId:', embedId);

        // Show builder view, hide list view
        const listView = document.getElementById('embedsListView');
        const builderView = document.getElementById('embedsBuilderView');

        if (!listView || !builderView) {
            console.error('[Embeds] View sections not found');
            showError('Embeds view sections not found');
            return;
        }

        listView.style.display = 'none';
        builderView.style.display = 'block';

        loadChannelsFromConfig();
        if (embedId) {
            await loadEmbedForEditing(embedId);
            const titleEl = document.getElementById('builderTitle');
            if (titleEl) titleEl.textContent = 'Edit Embed';
        } else {
            initializeNewEmbed();
        }

        setupBuilderEventListeners();
        updatePreview();
    }

    async function fetchEmbeds() {
        try {
            const dashboardCore = getDashboardCore();
            const response = await fetch(
                `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/embeds`,
                { headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` } }
            );
            const data = await response.json();
            if (data.success) state.embeds = data.embeds || [];
        } catch (error) {
            showNotification('Failed to load embeds', 'error');
        }
    }

    async function fetchStats() {
        try {
            const dashboardCore = getDashboardCore();
            const response = await fetch(
                `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/embeds/stats`,
                { headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` } }
            );
            const data = await response.json();
            if (data.success) state.stats = data.stats;
        } catch (error) {
            console.error('Stats error:', error);
        }
    }

    function loadChannelsFromConfig() {
        const dashboardCore = getDashboardCore();
        const allChannels = dashboardCore?.state?.guildConfig?.available_channels || [];

        // Filter to text channels only (type 0)
        // Note: available_channels from config-hybrid is already filtered to types 0 & 5
        // We further filter to just type 0 for embeds
        state.channels = allChannels.filter(c => c.type === 0);
        populateChannelDropdown();
    }

    function renderList() {
        const grid = document.getElementById('embedsGrid');
        const emptyState = document.getElementById('embedsEmptyState');
        const countSpan = document.getElementById('embedCount');
        const limitSpan = document.getElementById('embedLimit');
        const counter = document.getElementById('embedsCounter');
        const createBtn = document.getElementById('createEmbedBtn');

        if (!grid) return;

        if (state.stats) {
            if (countSpan) countSpan.textContent = state.stats.total;
            if (limitSpan) limitSpan.textContent = state.stats.limit;
            if (counter && state.stats.total >= state.stats.limit) counter.classList.add('at-limit');
            if (createBtn) createBtn.disabled = !state.stats.can_create_more;
        }

        if (state.embeds.length === 0) {
            grid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        grid.style.display = 'grid';
        if (emptyState) emptyState.style.display = 'none';
        grid.innerHTML = state.embeds.map(e => createEmbedCard(e)).join('');
    }

    function createEmbedCard(embed) {
        const status = embed.is_sent ? 'embed-status-sent' : 'embed-status-draft';
        const statusText = embed.is_sent ? 'Sent' : 'Draft';
        const preview = embed.embed_config?.description || embed.embed_config?.title || 'No content';

        return `
            <div class="embed-card">
                <div class="embed-card-header">
                    <h3 class="embed-card-name">${escapeHtml(embed.name)}</h3>
                    <span class="embed-card-status ${status}">${statusText}</span>
                </div>
                <div class="embed-card-preview">
                    ${escapeHtml(preview)}
                    <div style="margin-top: 8px;">
                        <a href="#" onclick="event.preventDefault(); EmbedsFeature.showPreview(${embed.id})" style="color: #00D9FF; font-size: 12px; text-decoration: none;">
                            See Preview
                        </a>
                    </div>
                </div>
                <div class="embed-card-actions">
                    <button class="embed-card-btn" onclick="EmbedsFeature.editEmbed(${embed.id})">Edit</button>
                    <button class="embed-card-btn" onclick="EmbedsFeature.duplicateEmbed(${embed.id})">Duplicate</button>
                    <button class="embed-card-btn delete-btn" onclick="EmbedsFeature.showDeleteModal(${embed.id})">Delete</button>
                </div>
            </div>
        `;
    }

    function setupListEventListeners() {
        const createBtn = document.getElementById('createEmbedBtn');
        if (createBtn) createBtn.addEventListener('click', () => navigateTo('embeds/new'));
    }

    function setupBuilderEventListeners() {
        const inputs = ['embedName', 'messageText', 'authorName', 'authorUrl', 'authorIcon',
            'embedTitle', 'embedDescription', 'embedUrl', 'embedColor',
            'thumbnailUrl', 'imageUrl', 'footerText', 'footerIcon', 'includeTimestamp'];

        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', updatePreview);
                el.addEventListener('change', updatePreview);
            }
        });

        const uploadInput = document.getElementById('imageUploadInput');
        if (uploadInput) uploadInput.addEventListener('change', handleImageUpload);

        ['authorIcon', 'thumbnailUrl', 'imageUrl', 'footerIcon'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    const preview = document.getElementById(id + 'Preview');
                    if (preview) {
                        preview.style.display = el.value ? 'block' : 'none';
                        if (el.value) preview.src = el.value;
                    }
                });
            }
        });
    }

    function initializeNewEmbed() {
        setValue('embedColor', '#00D9FF');
    }

    async function loadEmbedForEditing(embedId) {
        try {
            const dashboardCore = getDashboardCore();
            const response = await fetch(
                `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/embeds/${embedId}`,
                { headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` } }
            );
            const data = await response.json();
            if (data.success) {
                populateFormFromEmbed(data.embed);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            showNotification('Failed to load embed', 'error');
            navigateTo('embeds');
        }
    }

    function populateFormFromEmbed(embed) {
        setValue('embedName', embed.name);
        setValue('messageText', embed.message_text);
        setValue('targetChannel', embed.channel_id);

        const cfg = embed.embed_config || {};
        if (cfg.author) {
            setValue('authorName', cfg.author.name);
            setValue('authorUrl', cfg.author.url);
            setValue('authorIcon', cfg.author.icon_url);
        }

        setValue('embedTitle', cfg.title);
        setValue('embedDescription', cfg.description);
        setValue('embedUrl', cfg.url);

        if (cfg.color !== undefined) {
            setValue('embedColor', '#' + cfg.color.toString(16).padStart(6, '0'));
        }

        if (cfg.thumbnail) setValue('thumbnailUrl', cfg.thumbnail.url);
        if (cfg.image) setValue('imageUrl', cfg.image.url);

        if (cfg.footer) {
            setValue('footerText', cfg.footer.text);
            setValue('footerIcon', cfg.footer.icon_url);
        }
        setValue('includeTimestamp', cfg.timestamp);

        if (cfg.fields) cfg.fields.forEach(f => addField(f));
        if (embed.buttons) embed.buttons.forEach(b => addButton(b));
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

    function getEmbedConfigFromForm() {
        const cfg = {};

        const authorName = getValue('authorName');
        if (authorName) {
            cfg.author = {
                name: authorName,
                url: getValue('authorUrl') || undefined,
                icon_url: getValue('authorIcon') || undefined
            };
        }

        cfg.title = getValue('embedTitle') || undefined;
        cfg.description = getValue('embedDescription') || undefined;
        cfg.url = getValue('embedUrl') || undefined;

        const colorHex = getValue('embedColor');
        if (colorHex) cfg.color = parseInt(colorHex.replace('#', ''), 16);

        const thumbnailUrl = getValue('thumbnailUrl');
        if (thumbnailUrl) cfg.thumbnail = { url: thumbnailUrl };

        const imageUrl = getValue('imageUrl');
        if (imageUrl) cfg.image = { url: imageUrl };

        const fields = getFieldsFromForm();
        if (fields.length > 0) cfg.fields = fields;

        const footerText = getValue('footerText');
        if (footerText) {
            cfg.footer = {
                text: footerText,
                icon_url: getValue('footerIcon') || undefined
            };
        }

        const timestamp = document.getElementById('includeTimestamp');
        if (timestamp?.checked) cfg.timestamp = true;

        return cfg;
    }

    function getFieldsFromForm() {
        const fieldsList = document.getElementById('fieldsList');
        if (!fieldsList) return [];

        const fields = [];
        fieldsList.querySelectorAll('.field-item').forEach(item => {
            const idx = item.dataset.index;
            const name = getValue(`fieldName${idx}`);
            const value = getValue(`fieldValue${idx}`);
            const inline = document.getElementById(`fieldInline${idx}`)?.checked || false;
            if (name && value) fields.push({ name, value, inline });
        });
        return fields;
    }

    function getButtonsFromForm() {
        const buttonsList = document.getElementById('buttonsList');
        if (!buttonsList) return [];

        const buttons = [];
        buttonsList.querySelectorAll('.button-item').forEach(item => {
            const idx = item.dataset.index;
            const label = getValue(`buttonLabel${idx}`);
            const url = getValue(`buttonUrl${idx}`);
            const emoji = getValue(`buttonEmoji${idx}`);
            if (label && url) {
                const btn = { label, url };
                if (emoji) btn.emoji = emoji;
                buttons.push(btn);
            }
        });
        return buttons;
    }

    function updatePreview() {
        const container = document.getElementById('embedPreviewContainer');
        if (!container || typeof EmbedPreview === 'undefined') return;

        const embedConfig = getEmbedConfigFromForm();
        const buttons = getButtonsFromForm();
        const messageText = getValue('messageText');

        EmbedPreview.render(container, embedConfig, buttons, messageText);
        updateButtonCount();
    }

    function updateButtonCount() {
        const buttons = getButtonsFromForm();
        const countSpan = document.getElementById('buttonCount');
        const addBtn = document.getElementById('addButtonBtn');

        if (countSpan) countSpan.textContent = buttons.length;
        if (addBtn) addBtn.disabled = buttons.length >= 25;
    }

    function addField(fieldData = null) {
        const fieldsList = document.getElementById('fieldsList');
        if (!fieldsList) return;

        // Use random ID to prevent collisions when fields are added in quick succession
        const idx = Date.now() + Math.floor(Math.random() * 10000);
        const field = document.createElement('div');
        field.className = 'field-item';
        field.dataset.index = idx;

        field.innerHTML = `
            <div class="field-header">
                <label class="field-inline-checkbox">
                    <input type="checkbox" id="fieldInline${idx}" ${fieldData?.inline ? 'checked' : ''}>
                    Inline
                </label>
                <button class="remove-field-btn" onclick="EmbedsFeature.removeField(${idx})">×</button>
            </div>
            <div class="form-group">
                <label class="form-label">Field Name</label>
                <input type="text" id="fieldName${idx}" class="form-input" value="${escapeHtml(fieldData?.name || '')}" placeholder="Field name">
            </div>
            <div class="form-group">
                <label class="form-label">Field Value</label>
                <textarea id="fieldValue${idx}" class="form-textarea" placeholder="Field value">${escapeHtml(fieldData?.value || '')}</textarea>
            </div>
        `;

        fieldsList.appendChild(field);
        field.querySelectorAll('input, textarea').forEach(el => {
            el.addEventListener('input', updatePreview);
            el.addEventListener('change', updatePreview);
        });

        updatePreview();
    }

    function removeField(idx) {
        const field = document.querySelector(`.field-item[data-index="${idx}"]`);
        if (field) {
            field.remove();
            updatePreview();
        }
    }

    function addButton(buttonData = null) {
        const buttonsList = document.getElementById('buttonsList');
        if (!buttonsList) return;

        const buttons = getButtonsFromForm();
        if (buttons.length >= 25) {
            showNotification('Maximum 25 buttons allowed', 'error');
            return;
        }

        // Use random ID to prevent collisions when buttons are added in quick succession
        const idx = Date.now() + Math.floor(Math.random() * 10000);
        const button = document.createElement('div');
        button.className = 'button-item';
        button.dataset.index = idx;

        button.innerHTML = `
            <div class="button-header">
                <span>Button ${buttons.length + 1}</span>
                <button class="remove-button-btn" onclick="EmbedsFeature.removeButton(${idx})">×</button>
            </div>
            <div class="form-group">
                <label class="form-label">Button Label</label>
                <input type="text" id="buttonLabel${idx}" class="form-input" value="${escapeHtml(buttonData?.label || '')}" placeholder="Click here!" maxlength="80">
            </div>
            <div class="form-group">
                <label class="form-label">Button URL (HTTPS required)</label>
                <input type="url" id="buttonUrl${idx}" class="form-input" value="${escapeHtml(buttonData?.url || '')}" placeholder="https://example.com">
            </div>
            <div class="form-group">
                <label class="form-label">Emoji (Optional)</label>
                <input type="text" id="buttonEmoji${idx}" class="form-input" value="${escapeHtml(buttonData?.emoji || '')}" placeholder="🔗" maxlength="2">
            </div>
        `;

        buttonsList.appendChild(button);
        button.querySelectorAll('input').forEach(el => el.addEventListener('input', updatePreview));
        updatePreview();
    }

    function removeButton(idx) {
        const button = document.querySelector(`.button-item[data-index="${idx}"]`);
        if (button) {
            button.remove();
            updatePreview();
        }
    }

    function toggleSection(sectionId) {
        const content = document.getElementById(sectionId);
        const toggle = content?.previousElementSibling?.querySelector('.form-section-toggle');

        if (content) {
            content.classList.toggle('collapsed');
            if (toggle) toggle.textContent = content.classList.contains('collapsed') ? '▶' : '▼';
        }
    }

    async function saveDraft() {
        const embedData = {
            name: getValue('embedName'),
            message_text: getValue('messageText'),
            embed_config: getEmbedConfigFromForm(),
            channel_id: getValue('targetChannel'),
            buttons: getButtonsFromForm()
        };

        if (!embedData.name) {
            showNotification('Please enter an embed name', 'error');
            return;
        }

        if (!embedData.embed_config.title && !embedData.embed_config.description) {
            showNotification('Embed must have at least a title or description', 'error');
            return;
        }

        try {
            const dashboardCore = getDashboardCore();
            const isEditing = !!state.editingId;
            const url = isEditing
                ? `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/embeds/${state.editingId}`
                : `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/embeds`;

            const response = await fetch(url, {
                method: isEditing ? 'PUT' : 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('discord_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(embedData)
            });

            const data = await response.json();
            if (data.success) {
                showNotification(isEditing ? 'Embed updated!' : 'Embed saved!', 'success');
                navigateTo('embeds');
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            showNotification(error.message || 'Failed to save embed', 'error');
        }
    }

    async function sendEmbed() {
        const embedData = {
            name: getValue('embedName'),
            message_text: getValue('messageText'),
            embed_config: getEmbedConfigFromForm(),
            channel_id: getValue('targetChannel'),
            buttons: getButtonsFromForm()
        };

        if (!embedData.channel_id) {
            showNotification('Please select a target channel', 'error');
            return;
        }

        try {
            const dashboardCore = getDashboardCore();
            let embedId = state.editingId;

            if (!embedId) {
                const createResp = await fetch(
                    `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/embeds`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('discord_token')}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(embedData)
                    }
                );
                const createData = await createResp.json();
                if (!createData.success) throw new Error(createData.message);
                embedId = createData.embed.id;
            } else {
                const updateResp = await fetch(
                    `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/embeds/${embedId}`,
                    {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('discord_token')}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(embedData)
                    }
                );
                const updateData = await updateResp.json();
                if (!updateData.success) throw new Error(updateData.message);
            }

            const sendResp = await fetch(
                `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/embeds/${embedId}/send`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` }
                }
            );

            const sendData = await sendResp.json();
            if (sendData.success) {
                showNotification('Embed sent to Discord!', 'success');
                navigateTo('embeds');
            } else {
                throw new Error(sendData.message);
            }
        } catch (error) {
            showNotification(error.message || 'Failed to send embed', 'error');
        }
    }

    function cancelBuilder() {
        if (confirm('Are you sure? Any unsaved changes will be lost.')) {
            navigateTo('embeds');
        }
    }

    function editEmbed(embedId) {
        navigateTo(`embeds/edit/${embedId}`);
    }

    async function duplicateEmbed(embedId) {
        try {
            const dashboardCore = getDashboardCore();
            const response = await fetch(
                `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/embeds/${embedId}/duplicate`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` }
                }
            );

            const data = await response.json();
            if (data.success) {
                showNotification('Embed duplicated!', 'success');
                await fetchEmbeds();
                renderList();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            showNotification(error.message || 'Failed to duplicate embed', 'error');
        }
    }

    function showDeleteModal(embedId) {
        const modal = document.getElementById('deleteModal');
        const confirmBtn = document.getElementById('confirmDeleteBtn');

        if (modal && confirmBtn) {
            modal.style.display = 'flex';
            confirmBtn.onclick = () => deleteEmbed(embedId);
        }
    }

    function hideDeleteModal() {
        const modal = document.getElementById('deleteModal');
        if (modal) modal.style.display = 'none';
    }

    function showPreview(embedId) {
        console.log('[Embeds] showPreview called for:', embedId);
        const embed = state.embeds.find(e => e.id == embedId);
        
        if (!embed) {
            console.error('[Embeds] Embed not found in state');
            return;
        }

        const modal = document.getElementById('previewModal');
        const container = document.getElementById('modalPreviewContainer');

        if (!modal || !container) {
            console.error('[Embeds] Preview modal elements not found');
            return;
        }

        if (typeof EmbedPreview === 'undefined') {
            console.error('[Embeds] EmbedPreview utility not loaded');
            return;
        }

        EmbedPreview.renderImmediate(container, embed.embed_config || {}, embed.buttons || [], embed.message_text || '');
        modal.style.display = 'flex';
    }

    function hidePreviewModal() {
        const modal = document.getElementById('previewModal');
        if (modal) modal.style.display = 'none';
    }

    async function deleteEmbed(embedId) {
        try {
            const dashboardCore = getDashboardCore();
            const response = await fetch(
                `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/embeds/${embedId}`,
                {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` }
                }
            );

            const data = await response.json();
            if (data.success) {
                showNotification('Embed deleted', 'success');
                hideDeleteModal();
                await fetchEmbeds();
                await fetchStats();
                renderList();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            showNotification(error.message || 'Failed to delete embed', 'error');
        }
    }

    function uploadImage(imageType) {
        state.currentUploadType = imageType;
        const input = document.getElementById('imageUploadInput');
        if (input) input.click();
    }

    async function handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showNotification('Invalid file type', 'error');
            return;
        }

        if (file.size > 8 * 1024 * 1024) {
            showNotification('File too large (max 8MB)', 'error');
            return;
        }

        try {
            showNotification('Uploading...', 'info');

            const dashboardCore = getDashboardCore();
            const formData = new FormData();
            formData.append('image', file);
            formData.append('image_type', state.currentUploadType);

            const response = await fetch(
                `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/embeds/upload-image`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` },
                    body: formData
                }
            );

            const data = await response.json();
            if (data.success) {
                const inputMap = {
                    'author_icon': 'authorIcon',
                    'footer_icon': 'footerIcon',
                    'thumbnail': 'thumbnailUrl',
                    'image': 'imageUrl'
                };

                const inputId = inputMap[state.currentUploadType];
                if (inputId) {
                    setValue(inputId, data.url);
                    const preview = document.getElementById(inputId + 'Preview');
                    if (preview) {
                        preview.src = data.url;
                        preview.style.display = 'block';
                    }
                }

                showNotification('Image uploaded!', 'success');
                updatePreview();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            showNotification(error.message || 'Failed to upload image', 'error');
        } finally {
            event.target.value = '';
        }
    }

    // Helper functions
    function getDashboardCore() {
        return window.DashboardCore || window.dashboardCore;
    }

    function loadCSS(href) {
        if (!document.querySelector(`link[href="${href}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        }
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function getValue(id) {
        const el = document.getElementById(id);
        return el ? el.value : '';
    }

    function setValue(id, value) {
        const el = document.getElementById(id);
        if (el) {
            if (el.type === 'checkbox') {
                el.checked = !!value;
            } else {
                el.value = value || '';
            }
        }
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

    function showNotification(message, type = 'info') {
        const dashboardCore = getDashboardCore();
        if (dashboardCore?.showNotification) {
            dashboardCore.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    function showError(message) {
        console.error('[Embeds]', message);
        const container = document.getElementById('featureContent');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 48px; margin-bottom: 16px; color: #FF4444;">❌</div>
                    <h2 style="color: #FFFFFF; margin-bottom: 8px;">Error</h2>
                    <p style="color: #B0B0B0;">${message}</p>
                    <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #00D9FF; color: #1A1A1A; border: none; border-radius: 6px; cursor: pointer;">
                        Reload Page
                    </button>
                </div>
            `;
        }
        showNotification(message, 'error');
    }

    // Cleanup function for when feature is unloaded
    async function cleanup() {
        console.log('[Embeds] Cleanup called');
        state.embeds = [];
        state.editingId = null;
        state.stats = null;
        state.channels = [];
    }

    // Public API
    return {
        init,
        cleanup,
        editEmbed,
        duplicateEmbed,
        showDeleteModal,
        hideDeleteModal,
        showPreview,
        hidePreviewModal,
        addField,
        removeField,
        addButton,
        removeButton,
        toggleSection,
        saveDraft,
        sendEmbed,
        cancelBuilder,
        uploadImage
    };
})();

window.EmbedsFeature = EmbedsFeature;
console.log('[Embeds] Module loaded, EmbedsFeature:', typeof EmbedsFeature);
