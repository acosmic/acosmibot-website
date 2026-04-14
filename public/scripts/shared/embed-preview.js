/**
 * Embed Preview Component
 *
 * Renders Discord-style embed previews with live updates.
 * Used in the embeds builder for real-time preview.
 */

const EmbedPreview = (function() {
    'use strict';

    // Character limits (Discord API limits)
    const LIMITS = {
        title: 256,
        description: 4096,
        fieldName: 256,
        fieldValue: 1024,
        footerText: 2048,
        authorName: 256,
        totalChars: 6000
    };

    let updateTimer = null;
    const DEBOUNCE_DELAY = 300; // ms

    /**
     * Render embed preview
     * @param {HTMLElement} container - Container element for preview
     * @param {Object} config - Embed configuration
     * @param {Array} buttons - Button configuration
     * @param {string} messageText - Text content before embed
     */
    function render(container, config, buttons = [], messageText = '') {
        if (!container) return;

        // Debounce updates
        clearTimeout(updateTimer);
        updateTimer = setTimeout(() => {
            renderImmediate(container, config, buttons, messageText);
        }, DEBOUNCE_DELAY);
    }

    /**
     * Render embed immediately (no debounce)
     */
    function renderImmediate(container, config, buttons = [], messageText = '') {
        container.innerHTML = '';

        // Create Discord message container
        const messageContainer = document.createElement('div');
        messageContainer.className = 'discord-message-preview';

        // Render message text if present
        if (messageText && messageText.trim()) {
            const textElement = document.createElement('div');
            textElement.className = 'discord-message-text';
            textElement.textContent = messageText;
            messageContainer.appendChild(textElement);
        }

        // Create embed container
        const embedContainer = document.createElement('div');
        embedContainer.className = 'discord-embed';

        // Color bar
        const colorBar = document.createElement('div');
        colorBar.className = 'discord-embed-color-bar';
        if (config.color !== undefined && config.color !== null) {
            const colorInt = parseInt(config.color);
            const colorHex = '#' + colorInt.toString(16).padStart(6, '0');
            colorBar.style.backgroundColor = colorHex;
        }
        embedContainer.appendChild(colorBar);

        // Content container
        const contentContainer = document.createElement('div');
        contentContainer.className = 'discord-embed-content';

        // Author
        if (config.author && config.author.name) {
            const authorElement = renderAuthor(config.author);
            contentContainer.appendChild(authorElement);
        }

        // Title
        if (config.title) {
            const titleElement = renderTitle(config.title, config.url);
            contentContainer.appendChild(titleElement);
        }

        // Description
        if (config.description) {
            const descElement = renderDescription(config.description);
            contentContainer.appendChild(descElement);
        }

        // Fields
        if (config.fields && config.fields.length > 0) {
            const fieldsElement = renderFields(config.fields);
            contentContainer.appendChild(fieldsElement);
        }

        // Thumbnail
        if (config.thumbnail && config.thumbnail.url) {
            const thumbnailElement = renderThumbnail(config.thumbnail.url);
            contentContainer.appendChild(thumbnailElement);
        }

        // Image
        if (config.image && config.image.url) {
            const imageElement = renderImage(config.image.url);
            contentContainer.appendChild(imageElement);
        }

        // Footer
        if (config.footer && config.footer.text) {
            const footerElement = renderFooter(config.footer, config.timestamp);
            contentContainer.appendChild(footerElement);
        } else if (config.timestamp) {
            const footerElement = renderFooter({}, config.timestamp);
            contentContainer.appendChild(footerElement);
        }

        embedContainer.appendChild(contentContainer);
        messageContainer.appendChild(embedContainer);

        // Buttons
        if (buttons && buttons.length > 0) {
            const buttonsElement = renderButtons(buttons);
            messageContainer.appendChild(buttonsElement);
        }

        // Character count indicator
        const charCount = calculateTotalChars(config);
        const charIndicator = renderCharIndicator(charCount);
        messageContainer.appendChild(charIndicator);

        container.appendChild(messageContainer);
    }

    function renderAuthor(author) {
        const authorDiv = document.createElement('div');
        authorDiv.className = 'discord-embed-author';

        if (author.icon_url) {
            const icon = document.createElement('img');
            icon.className = 'discord-embed-author-icon';
            icon.src = author.icon_url;
            icon.alt = 'Author icon';
            authorDiv.appendChild(icon);
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'discord-embed-author-name';
        nameSpan.textContent = author.name;
        if (author.url) {
            const link = document.createElement('a');
            link.href = author.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.appendChild(nameSpan);
            authorDiv.appendChild(link);
        } else {
            authorDiv.appendChild(nameSpan);
        }

        return authorDiv;
    }

    function renderTitle(title, url) {
        const titleDiv = document.createElement('div');
        titleDiv.className = 'discord-embed-title';

        if (url) {
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = title;
            titleDiv.appendChild(link);
        } else {
            titleDiv.textContent = title;
        }

        return titleDiv;
    }

    function renderDescription(description) {
        const descDiv = document.createElement('div');
        descDiv.className = 'discord-embed-description';
        descDiv.textContent = description;
        return descDiv;
    }

    function renderFields(fields) {
        const fieldsContainer = document.createElement('div');
        fieldsContainer.className = 'discord-embed-fields';

        fields.forEach(field => {
            if (!field.name || !field.value) return;

            const fieldDiv = document.createElement('div');
            fieldDiv.className = field.inline ? 'discord-embed-field discord-embed-field-inline' : 'discord-embed-field';

            const fieldName = document.createElement('div');
            fieldName.className = 'discord-embed-field-name';
            fieldName.textContent = field.name;
            fieldDiv.appendChild(fieldName);

            const fieldValue = document.createElement('div');
            fieldValue.className = 'discord-embed-field-value';
            fieldValue.textContent = field.value;
            fieldDiv.appendChild(fieldValue);

            fieldsContainer.appendChild(fieldDiv);
        });

        return fieldsContainer;
    }

    function renderThumbnail(url) {
        const thumbnailDiv = document.createElement('div');
        thumbnailDiv.className = 'discord-embed-thumbnail';

        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Thumbnail';
        thumbnailDiv.appendChild(img);

        return thumbnailDiv;
    }

    function renderImage(url) {
        const imageDiv = document.createElement('div');
        imageDiv.className = 'discord-embed-image';

        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Embed image';
        imageDiv.appendChild(img);

        return imageDiv;
    }

    function renderFooter(footer, timestamp) {
        const footerDiv = document.createElement('div');
        footerDiv.className = 'discord-embed-footer';

        if (footer.icon_url) {
            const icon = document.createElement('img');
            icon.className = 'discord-embed-footer-icon';
            icon.src = footer.icon_url;
            icon.alt = 'Footer icon';
            footerDiv.appendChild(icon);
        }

        const textSpan = document.createElement('span');
        textSpan.className = 'discord-embed-footer-text';

        let footerText = footer.text || '';
        if (timestamp) {
            const timeStr = new Date().toLocaleString();
            footerText = footerText ? `${footerText} • ${timeStr}` : timeStr;
        }

        textSpan.textContent = footerText;
        footerDiv.appendChild(textSpan);

        return footerDiv;
    }

    function renderButtons(buttons) {
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'discord-buttons';

        let currentRow = document.createElement('div');
        currentRow.className = 'discord-button-row';

        buttons.forEach((button, index) => {
            if (!button.label || !button.url) return;

            const buttonDiv = document.createElement('div');
            buttonDiv.className = 'discord-button discord-button-link';

            if (button.emoji) {
                const emoji = document.createElement('span');
                emoji.className = 'discord-button-emoji';
                emoji.textContent = button.emoji;
                buttonDiv.appendChild(emoji);
            }

            const label = document.createElement('span');
            label.textContent = button.label;
            buttonDiv.appendChild(label);

            currentRow.appendChild(buttonDiv);

            // Start new row after 5 buttons
            if ((index + 1) % 5 === 0 && index < buttons.length - 1) {
                buttonsContainer.appendChild(currentRow);
                currentRow = document.createElement('div');
                currentRow.className = 'discord-button-row';
            }
        });

        if (currentRow.children.length > 0) {
            buttonsContainer.appendChild(currentRow);
        }

        return buttonsContainer;
    }

    function calculateTotalChars(config) {
        let total = 0;

        if (config.title) total += config.title.length;
        if (config.description) total += config.description.length;
        if (config.author && config.author.name) total += config.author.name.length;
        if (config.footer && config.footer.text) total += config.footer.text.length;

        if (config.fields) {
            config.fields.forEach(field => {
                if (field.name) total += field.name.length;
                if (field.value) total += field.value.length;
            });
        }

        return total;
    }

    function renderCharIndicator(charCount) {
        const indicator = document.createElement('div');
        indicator.className = 'embed-char-indicator';

        const isOverLimit = charCount > LIMITS.totalChars;
        indicator.style.color = isOverLimit ? '#FF4444' : '#B0B0B0';

        indicator.textContent = `${charCount} of ${LIMITS.totalChars} characters`;

        return indicator;
    }

    /**
     * Validate individual field length
     * @param {string} value - Field value
     * @param {string} fieldName - Field name for error message
     * @param {number} limit - Character limit
     * @returns {Object} { valid: boolean, message: string }
     */
    function validateFieldLength(value, fieldName, limit) {
        if (!value) return { valid: true, message: '' };

        const length = value.length;
        if (length > limit) {
            return {
                valid: false,
                message: `${fieldName} exceeds ${limit} characters (${length}/${limit})`
            };
        }

        return { valid: true, message: '' };
    }

    /**
     * Validate entire embed configuration
     * @param {Object} config - Embed configuration
     * @returns {Object} { valid: boolean, errors: Array }
     */
    function validateEmbed(config) {
        const errors = [];

        // Validate title
        const titleCheck = validateFieldLength(config.title, 'Title', LIMITS.title);
        if (!titleCheck.valid) errors.push(titleCheck.message);

        // Validate description
        const descCheck = validateFieldLength(config.description, 'Description', LIMITS.description);
        if (!descCheck.valid) errors.push(descCheck.message);

        // Validate author name
        if (config.author && config.author.name) {
            const authorCheck = validateFieldLength(config.author.name, 'Author name', LIMITS.authorName);
            if (!authorCheck.valid) errors.push(authorCheck.message);
        }

        // Validate footer text
        if (config.footer && config.footer.text) {
            const footerCheck = validateFieldLength(config.footer.text, 'Footer text', LIMITS.footerText);
            if (!footerCheck.valid) errors.push(footerCheck.message);
        }

        // Validate fields
        if (config.fields) {
            config.fields.forEach((field, index) => {
                const nameCheck = validateFieldLength(field.name, `Field ${index + 1} name`, LIMITS.fieldName);
                if (!nameCheck.valid) errors.push(nameCheck.message);

                const valueCheck = validateFieldLength(field.value, `Field ${index + 1} value`, LIMITS.fieldValue);
                if (!valueCheck.valid) errors.push(valueCheck.message);
            });
        }

        // Validate total characters
        const totalChars = calculateTotalChars(config);
        if (totalChars > LIMITS.totalChars) {
            errors.push(`Total embed characters exceed ${LIMITS.totalChars} (currently ${totalChars})`);
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    // Public API
    return {
        render,
        renderImmediate,
        validateEmbed,
        validateFieldLength,
        LIMITS
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmbedPreview;
}
