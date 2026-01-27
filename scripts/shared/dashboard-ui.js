// ===== DASHBOARD UI UTILITIES =====
// Shared UI components and utilities

// ===== COMING SOON MODAL =====
function showComingSoonModal(featureName) {
  // Remove any existing modal
  const existing = document.querySelector('.coming-soon-modal');
  if (existing) {
    existing.remove();
  }

  const displayName = formatFeatureName(featureName);

  const modal = document.createElement('div');
  modal.className = 'coming-soon-modal';
  modal.innerHTML = `
    <div class="modal-overlay" onclick="this.parentElement.remove()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <div class="modal-icon">🚧</div>
        <h2>Coming Soon!</h2>
        <p>The <strong>${displayName}</strong> feature is currently under development.</p>
        <p>Stay tuned for updates!</p>
        <button class="modal-close-btn" onclick="this.closest('.coming-soon-modal').remove()">
          Got it!
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add fade-in animation
  requestAnimationFrame(() => {
    modal.style.opacity = '1';
  });
}

// Map feature slugs to display names
function formatFeatureName(feature) {
  const featureNames = {
    'overview': 'Overview',
    'membership': 'Membership',
    'leveling': 'Leveling',
    'welcomes': 'Welcomes and Goodbyes',
    'reputation': 'Reputation',
    'twitch': 'Twitch Alerts',
    'youtube': 'YouTube Alerts',
    'kick': 'Kick Alerts',
    'reddit': 'Reddit Alerts',
    'polymorph': 'Polymorph',
    'portals': 'Portals',
    'jail': 'Jail',
    'slots': 'Slots',
    'lottery': 'Lottery',
    'embeds': 'Embeds',
    'reaction-roles': 'Reaction Roles',
    'custom-commands': 'Custom Commands'
  };

  return featureNames[feature] || feature.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// ===== TOAST NOTIFICATIONS =====
// Simple toast notification system
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  // Add to page
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  toastContainer.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto-remove after duration
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function showSuccessToast(message, duration = 3000) {
  showToast(message, 'success', duration);
}

function showErrorToast(message, duration = 5000) {
  showToast(message, 'error', duration);
}

function showInfoToast(message, duration = 3000) {
  showToast(message, 'info', duration);
}

// ===== LOADING SPINNER =====
function showLoadingOverlay(message = 'Loading...') {
  const existing = document.querySelector('.loading-overlay');
  if (existing) return; // Already showing

  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-spinner"></div>
    <p class="loading-text">${message}</p>
  `;

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
  });
}

function hideLoadingOverlay() {
  const overlay = document.querySelector('.loading-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
  }
}

// ===== SVG LOADER =====
// Creates the animated SVG loader
function createAnimatedLoading() {
  return `
    <div class="loader loader--style8" title="Loading">
      <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
          width="24px" height="30px" viewBox="0 0 24 30" style="enable-background:new 0 0 50 50;" xml:space="preserve">
          <rect x="0" y="10" width="4" height="10" fill="#333" opacity="0.2">
              <animate attributeName="opacity" attributeType="XML" values="0.2; 1; .2" begin="0s" dur="0.6s" repeatCount="indefinite" />
              <animate attributeName="height" attributeType="XML" values="10; 20; 10" begin="0s" dur="0.6s" repeatCount="indefinite" />
              <animate attributeName="y" attributeType="XML" values="10; 5; 10" begin="0s" dur="0.6s" repeatCount="indefinite" />
          </rect>
          <rect x="8" y="10" width="4" height="10" fill="#333" opacity="0.2">
              <animate attributeName="opacity" attributeType="XML" values="0.2; 1; .2" begin="0.15s" dur="0.6s" repeatCount="indefinite" />
              <animate attributeName="height" attributeType="XML" values="10; 20; 10" begin="0.15s" dur="0.6s" repeatCount="indefinite" />
              <animate attributeName="y" attributeType="XML" values="10; 5; 10" begin="0.15s" dur="0.6s" repeatCount="indefinite" />
          </rect>
          <rect x="16" y="10" width="4" height="10" fill="#333" opacity="0.2">
              <animate attributeName="opacity" attributeType="XML" values="0.2; 1; .2" begin="0.3s" dur="0.6s" repeatCount="indefinite" />
              <animate attributeName="height" attributeType="XML" values="10; 20; 10" begin="0.3s" dur="0.6s" repeatCount="indefinite" />
              <animate attributeName="y" attributeType="XML" values="10; 5; 10" begin="0.3s" dur="0.6s" repeatCount="indefinite" />
          </rect>
      </svg>
    </div>
  `;
}

// ===== CONFIRMATION DIALOG =====
function showConfirmDialog(title, message, onConfirm, onCancel = null) {
  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog-modal';
  dialog.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content">
        <h2>${title}</h2>
        <p>${message}</p>
        <div class="dialog-buttons">
          <button class="btn-secondary dialog-cancel-btn">Cancel</button>
          <button class="btn-primary dialog-confirm-btn">Confirm</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Setup button handlers
  const confirmBtn = dialog.querySelector('.dialog-confirm-btn');
  const cancelBtn = dialog.querySelector('.dialog-cancel-btn');

  confirmBtn.addEventListener('click', () => {
    if (onConfirm) onConfirm();
    dialog.remove();
  });

  cancelBtn.addEventListener('click', () => {
    if (onCancel) onCancel();
    dialog.remove();
  });

  // Allow closing by clicking overlay
  dialog.querySelector('.modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      if (onCancel) onCancel();
      dialog.remove();
    }
  });
}

// ===== UTILITY FUNCTIONS =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Make functions globally accessible
window.showComingSoonModal = showComingSoonModal;
window.formatFeatureName = formatFeatureName;
window.showToast = showToast;
window.showSuccessToast = showSuccessToast;
window.showErrorToast = showErrorToast;
window.showInfoToast = showInfoToast;
window.showLoadingOverlay = showLoadingOverlay;
window.hideLoadingOverlay = hideLoadingOverlay;
window.createAnimatedLoading = createAnimatedLoading;
window.showConfirmDialog = showConfirmDialog;
window.escapeHtml = escapeHtml;
window.debounce = debounce;
