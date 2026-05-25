// ===== OVERVIEW NAVIGATION MODULE =====
// Shared navigation functionality for overview-style pages
// Used by: /overview, /leaderboards

const API_BASE_URL = AppConfig.apiBaseUrl;

/**
 * Initialize the overview layout with guild selector and navigation sidebar
 * @param {Object} user - Current user object
 * @param {string} activePage - Current active page ('overview', 'leaderboards', etc.)
 */
async function initializeOverviewLayout(user, activePage) {
  if (!user) {
    console.error('initializeOverviewLayout: No user provided');
    return;
  }

  console.log('Initializing overview layout for:', activePage);

  // Render user avatar at top of guild selector
  renderGuildSelectorAvatar(user);
  renderTopNavAvatar(user);

  // Load and render guild icons
  await loadAndRenderGuildIcons();

  // Render navigation sidebar
  renderNavigation(activePage);
}

function getAvatarUrl(user) {
  if (user.avatar) {
    return user.avatar.startsWith('http')
      ? user.avatar
      : `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
  }
  const defaultAvatarIndex = (parseInt(user.id) >> 22) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
}

function renderTopNavAvatar(user) {
  const topNavRight = document.querySelector('.top-nav-right');
  if (!topNavRight || document.getElementById('topNavProfileAvatar')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'top-nav-profile-wrap';

  const button = document.createElement('button');
  button.id = 'topNavProfileAvatar';
  button.className = 'top-nav-profile-avatar';
  button.title = 'Account menu';
  button.setAttribute('aria-label', 'Account menu');
  button.setAttribute('aria-expanded', 'false');
  button.style.backgroundImage = `url('${getAvatarUrl(user)}')`;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const existingMenu = wrapper.querySelector('.user-menu');
    if (existingMenu) {
      existingMenu.remove();
      button.setAttribute('aria-expanded', 'false');
      return;
    }

    const menu = document.createElement('div');
    menu.className = 'user-menu';
    menu.innerHTML = `
      <div class="user-info">
        <div class="user-name">${escapeHtml(user.global_name || user.username || 'User')}</div>
      </div>
      <a href="/servers">Servers</a>
      <a href="/profile">Profile</a>
      ${user.id === '110637665128325120' ? '<a href="/admin" style="color:#f59e0b;">Admin</a>' : ''}
      <div style="border-top: 1px solid var(--border-light); margin: 5px 0;"></div>
      <a href="#" class="logout-btn" id="topNavLogoutLink">Logout</a>
    `;
    wrapper.appendChild(menu);
    button.setAttribute('aria-expanded', 'true');

    menu.querySelector('#topNavLogoutLink')?.addEventListener('click', (logoutEvent) => {
      logoutEvent.preventDefault();
      logout();
    });

    setTimeout(() => {
      document.addEventListener('click', function closeMenu(closeEvent) {
        if (!wrapper.contains(closeEvent.target)) {
          menu.remove();
          button.setAttribute('aria-expanded', 'false');
          document.removeEventListener('click', closeMenu);
        }
      });
    }, 0);
  });

  topNavRight.innerHTML = '';
  wrapper.appendChild(button);
  topNavRight.appendChild(wrapper);
}

/**
 * Render user avatar at the top of guild selector
 * @param {Object} user - Current user object
 */
function renderGuildSelectorAvatar(user) {
  const avatarElement = document.getElementById('guildSelectorAvatar');
  if (!avatarElement) {
    console.warn('Guild selector avatar element not found');
    return;
  }

  avatarElement.style.backgroundImage = `url('${getAvatarUrl(user)}')`;
  avatarElement.textContent = '';

  avatarElement.title = 'Profile';

  // Make it clickable to navigate to /profile
  avatarElement.addEventListener('click', () => {
    window.location.href = '/profile';
  });
  avatarElement.style.cursor = 'pointer';
}

/**
 * Load user guilds and render guild icons
 */
async function loadAndRenderGuildIcons() {
  const token = localStorage.getItem('discord_token');
  if (!token) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/user/guilds`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      console.warn('Failed to load guilds:', response.status);
      return;
    }

    const data = await response.json();
    const guilds = data.success ? data.guilds : [];

    renderGuildIcons(guilds);
  } catch (error) {
    console.error('Error loading guilds:', error);
  }
}

/**
 * Render guild icons in the guild selector
 * @param {Array} guilds - Array of guild objects
 */
function renderGuildIcons(guilds) {
  const container = document.getElementById('guildIconList');
  if (!container) {
    console.warn('Guild icon list element not found');
    return;
  }

  container.innerHTML = '';

  if (!guilds || guilds.length === 0) {
    return;
  }

  // Filter guilds where user is owner or admin
  const managedGuilds = guilds.filter(guild => {
    return guild.owner === true || guild.permissions?.includes('administrator');
  });

  // Sort: owner first, then admin
  const sortedGuilds = managedGuilds.sort((a, b) => {
    const aScore = a.owner ? 2 : 1;
    const bScore = b.owner ? 2 : 1;
    return bScore - aScore;
  });

  // Render guild icons (matching dashboard-core.js approach)
  sortedGuilds.forEach(guild => {
    const iconDiv = document.createElement('div');
    iconDiv.className = 'guild-icon';
    iconDiv.dataset.guildId = guild.id;
    iconDiv.title = guild.name;

    if (guild.icon) {
      const iconUrl = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
      iconDiv.style.backgroundImage = `url('${iconUrl}')`;
      iconDiv.style.backgroundSize = 'cover';
      iconDiv.style.backgroundPosition = 'center';
    } else {
      // Fallback: first letter
      iconDiv.textContent = guild.name.charAt(0).toUpperCase();
      iconDiv.style.display = 'flex';
      iconDiv.style.alignItems = 'center';
      iconDiv.style.justifyContent = 'center';
      iconDiv.style.fontSize = '20px';
      iconDiv.style.fontWeight = 'bold';
      iconDiv.style.color = 'white';
    }

    // Make icon clickable to navigate to guild overview
    iconDiv.addEventListener('click', () => {
      window.location.href = `/server/${guild.id}/overview`;
    });

    container.appendChild(iconDiv);
  });
}

/**
 * Render the navigation sidebar
 * @param {string} activePage - Current active page
 */
function renderNavigation(activePage) {
  const navContainer = document.getElementById('overviewNavigation');
  if (!navContainer) {
    console.warn('Overview navigation element not found');
    return;
  }

  const navItems = [
    {
      id: 'membership',
      label: 'Membership',
      icon: 'membership',
      action: 'coming-soon'
    },
    {
      id: 'premium',
      label: 'Premium',
      icon: 'premium',
      action: 'coming-soon'
    },
    {
      id: 'leaderboards',
      label: 'Leaderboards',
      icon: 'leaderboards',
      action: 'navigate',
      url: '/leaderboards'
    },
    {
      id: 'logout',
      label: 'Logout',
      icon: 'logout',
      action: 'logout'
    }
  ];

  navContainer.innerHTML = navItems.map(item => {
    const isActive = activePage === item.id;
    const activeClass = isActive ? 'active' : '';

    return `
      <div class="nav-item ${activeClass}" data-action="${item.action}" data-url="${item.url || ''}" data-feature="${item.id}">
        <span class="nav-icon nav-icon-${item.icon}"></span>
        <span class="nav-label">${item.label}</span>
      </div>
    `;
  }).join('');

  // Setup click handlers
  setupNavigationHandlers();
}

/**
 * Setup click handlers for navigation items
 */
function setupNavigationHandlers() {
  const navItems = document.querySelectorAll('.nav-item');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      const url = item.dataset.url;
      const feature = item.dataset.feature;

      handleNavClick(action, url, feature);
    });
  });
}

/**
 * Handle navigation item clicks
 * @param {string} action - Action type ('coming-soon', 'navigate', 'logout')
 * @param {string} url - URL to navigate to (if action is 'navigate')
 * @param {string} feature - Feature name (for coming soon modal)
 */
function handleNavClick(action, url, feature) {
  switch (action) {
    case 'coming-soon':
      showComingSoonModal(feature);
      break;

    case 'navigate':
      if (url) {
        window.location.href = url;
      }
      break;

    case 'logout':
      logout();
      break;

    default:
      console.warn('Unknown navigation action:', action);
  }
}

/**
 * Logout function
 */
function logout() {
  // Clear token
  localStorage.removeItem('discord_token');

  // Show toast notification
  if (window.showSuccessToast) {
    showSuccessToast('Successfully logged out!');
  } else {
    alert('Successfully logged out!');
  }

  // Redirect to home after a brief delay
  setTimeout(() => {
    window.location.href = '/';
  }, 500);
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Make functions globally accessible
window.initializeOverviewLayout = initializeOverviewLayout;
window.renderGuildSelectorAvatar = renderGuildSelectorAvatar;
window.renderTopNavAvatar = renderTopNavAvatar;
window.loadAndRenderGuildIcons = loadAndRenderGuildIcons;
window.renderGuildIcons = renderGuildIcons;
window.renderNavigation = renderNavigation;
window.handleNavClick = handleNavClick;
