// Premium page functionality

// State
let userGuilds = [];
let selectedGuild = null;

// Get auth token
function getAuthToken() {
  return localStorage.getItem('discord_token');
}

// Note: showNotification() is provided by nav.js

// Initialize page
async function initPremiumPage() {
  const token = getAuthToken();
  const selectServerBtn = document.getElementById('selectServerBtn');
  const loginHint = document.getElementById('loginHint');

  console.log('Premium page init - Token found:', !!token);
  console.log('Button element:', selectServerBtn);

  if (token) {
    // User is logged in
    console.log('Enabling select server button');
    selectServerBtn.disabled = false;
    selectServerBtn.style.cursor = 'pointer';
    selectServerBtn.style.opacity = '1';
    loginHint.style.display = 'none';

    // Set up event listeners
    selectServerBtn.addEventListener('click', openServerModal);
    document.getElementById('closeModal').addEventListener('click', closeServerModal);
    document.querySelector('.modal-overlay').addEventListener('click', closeServerModal);

    // Check for guild parameter in URL for direct upgrade flow
    handleDirectGuildUpgrade();
  } else {
    // User is not logged in
    console.log('No token - button stays disabled');
    selectServerBtn.disabled = true;
    loginHint.style.display = 'block';
  }
}

// Handle direct guild upgrade from URL parameter
async function handleDirectGuildUpgrade() {
  const urlParams = new URLSearchParams(window.location.search);
  const guildId = urlParams.get('guild');

  if (guildId) {
    // Auto-open the server modal with the specified guild
    // Wait a brief moment for DOM to be ready
    setTimeout(async () => {
      await openServerModal();

      // After modal opens and servers load, scroll to/highlight the specified guild
      // Wait for server list to populate
      setTimeout(() => {
        const serverCards = document.querySelectorAll('.server-card');
        serverCards.forEach(card => {
          // Check if this card matches the guild ID
          const upgradeBtn = card.querySelector('.server-action-btn');
          if (upgradeBtn && upgradeBtn.getAttribute('onclick')?.includes(guildId)) {
            // Highlight the card
            card.style.border = '2px solid #ffd700';
            card.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.5)';

            // Scroll into view
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }, 500); // Wait for server list to render
    }, 100);

    // Clean up URL parameter
    window.history.replaceState({}, document.title, '/premium');
  }
}

// Open server selection modal
async function openServerModal() {
  const modal = document.getElementById('serverModal');
  const loadingState = document.getElementById('loadingServers');
  const serverList = document.getElementById('serverList');
  const noServers = document.getElementById('noServers');

  // Show modal
  modal.style.display = 'flex';

  // Reset states
  loadingState.style.display = 'flex';
  serverList.style.display = 'none';
  noServers.style.display = 'none';
  serverList.innerHTML = '';

  try {
    // Fetch user's guilds
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/user/guilds`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch servers');
    }

    const data = await response.json();

    if (data.success && data.guilds && data.guilds.length > 0) {
      // Filter guilds where user has admin permissions
      userGuilds = data.guilds.filter(guild =>
        guild.permissions && guild.permissions.includes('administrator')
      );

      if (userGuilds.length === 0) {
        loadingState.style.display = 'none';
        noServers.style.display = 'block';
        return;
      }

      // Fetch subscription status for each guild
      const guildsWithStatus = await Promise.all(
        userGuilds.map(async (guild) => {
          try {
            const subResponse = await fetch(`${API_BASE_URL}/api/guilds/${guild.id}/subscription`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });

            if (subResponse.ok) {
              const subData = await subResponse.json();
              guild.subscription = subData.subscription;
              guild.tier = subData.tier || 'free';
              guild.status = subData.status || 'active';
            } else {
              guild.tier = 'free';
              guild.status = 'active';
            }
          } catch (error) {
            console.error(`Error fetching subscription for guild ${guild.id}:`, error);
            guild.tier = 'free';
            guild.status = 'active';
          }
          return guild;
        })
      );

      // Display servers
      loadingState.style.display = 'none';
      serverList.style.display = 'grid';

      guildsWithStatus.forEach(guild => {
        const serverCard = createServerCard(guild);
        serverList.appendChild(serverCard);
      });
    } else {
      loadingState.style.display = 'none';
      noServers.style.display = 'block';
    }
  } catch (error) {
    console.error('Error fetching servers:', error);
    showNotification('Failed to load servers. Please try again.', 'error');
    loadingState.style.display = 'none';
  }
}

// Create server card
function createServerCard(guild) {
  const card = document.createElement('div');
  card.className = 'server-card';

  const isPremium = guild.tier === 'premium';
  const isOwner = guild.owner === true;

  // Server icon
  let iconHtml = '';
  if (guild.icon) {
    const iconUrl = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
    iconHtml = `<img src="${iconUrl}" alt="${guild.name}" class="server-icon">`;
  } else {
    // Default icon with first letter
    const firstLetter = guild.name.charAt(0).toUpperCase();
    iconHtml = `<div class="server-icon-default">${firstLetter}</div>`;
  }

  // Status badge
  let statusBadge = '';
  if (isPremium) {
    statusBadge = '<span class="status-badge premium">💎 Premium</span>';
  } else {
    statusBadge = '<span class="status-badge free">Free</span>';
  }

  // Action button
  let actionButton = '';
  if (isPremium) {
    actionButton = `
      <button class="server-action-btn manage" onclick="manageSubscription('${guild.id}', '${guild.name}')">
        Manage Subscription
      </button>
    `;
  } else {
    actionButton = `
      <button class="server-action-btn upgrade" onclick="upgradeServer('${guild.id}', '${guild.name}')">
        Upgrade to Premium
      </button>
    `;
  }

  card.innerHTML = `
    <div class="server-info">
      ${iconHtml}
      <div class="server-details">
        <h3 class="server-name">${guild.name}</h3>
        <p class="server-members">${guild.member_count || 0} members</p>
        ${statusBadge}
      </div>
    </div>
    ${actionButton}
  `;

  return card;
}

// Close server modal
function closeServerModal() {
  const modal = document.getElementById('serverModal');
  modal.style.display = 'none';
}

// Upgrade server to premium
async function upgradeServer(guildId, guildName) {
  try {
    const token = getAuthToken();

    if (confirm(`Upgrade "${guildName}" to Premium?\n\nNote: This is test mode.`)) {
      showNotification('Processing upgrade...', 'info');

      // Call test upgrade endpoint
      const response = await fetch(`${API_BASE_URL}/api/subscriptions/test-upgrade`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          guild_id: guildId
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showNotification('Successfully upgraded to premium!', 'success');

        // Refresh modal after delay
        setTimeout(() => {
          closeServerModal();
          openServerModal();
        }, 1500);
      } else {
        showNotification(data.message || 'Failed to upgrade', 'error');
      }

      // For production Stripe integration, uncomment below:
      // const response = await fetch(`${API_BASE_URL}/api/subscriptions/create-checkout`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${token}`,
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({
      //     guild_id: guildId,
      //     success_url: `${window.location.origin}/premium?success=true&guild=${guildId}`,
      //     cancel_url: `${window.location.origin}/premium?canceled=true`
      //   })
      // });
      //
      // if (response.ok) {
      //   const data = await response.json();
      //   if (data.success && data.checkout_url) {
      //     window.location.href = data.checkout_url;
      //   }
      // }
    }
  } catch (error) {
    console.error('Error upgrading server:', error);
    showNotification('Failed to upgrade server. Please try again.', 'error');
  }
}

// Manage subscription
async function manageSubscription(guildId, guildName) {
  try {
    const token = getAuthToken();

    if (confirm(`Manage subscription for "${guildName}"?\n\nThis will open the subscription management portal.`)) {
      showNotification('Opening subscription portal...', 'info');

      const response = await fetch(`${API_BASE_URL}/api/subscriptions/portal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          guild_id: guildId,
          return_url: `${window.location.origin}/premium`
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.portal_url) {
          window.location.href = data.portal_url;
        } else {
          showNotification('Failed to open billing portal', 'error');
        }
      } else {
        showNotification('Failed to open billing portal', 'error');
      }
    }
  } catch (error) {
    console.error('Error managing subscription:', error);
    showNotification('Failed to open subscription portal. Please try again.', 'error');
  }
}

// Handle URL parameters (success/cancel from Stripe)
function handleUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get('success') === 'true') {
    const guildId = urlParams.get('guild');
    showNotification('Premium upgrade successful! Your server now has access to all premium features.', 'success');

    // Clear URL parameters
    window.history.replaceState({}, document.title, '/premium');
  } else if (urlParams.get('canceled') === 'true') {
    showNotification('Upgrade canceled. You can upgrade anytime!', 'info');

    // Clear URL parameters
    window.history.replaceState({}, document.title, '/premium');
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Small delay to ensure nav.js has finished auth check
  setTimeout(() => {
    initPremiumPage();
    handleUrlParams();
  }, 100);
});
