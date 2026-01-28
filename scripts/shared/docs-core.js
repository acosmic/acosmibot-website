// ===== DOCS CORE MODULE =====
// Simplified DashboardCore for documentation pages
// Handles: Optional Authentication, Optional Guild Context, Navigation

console.log('docs-core.js loading...');

class DocsCore {
  constructor() {
    this.API_BASE_URL = 'https://api.acosmibot.com';
    this.state = {
      isAuthenticated: false,
      userGuilds: [],
      currentGuildId: null, // Optional guild context from ?guild= parameter
      currentUser: null,
      isLoading: false,
    };
  }

  // ===== MAIN INITIALIZATION =====
  async init(sectionName) {
    console.log('DocsCore.init() called with section:', sectionName);

    // Check authentication status
    await this.checkAuthStatus();

    // Load guild context from URL if present
    this.loadGuildContextFromURL();

    // If authenticated, load user data and guilds
    if (this.state.isAuthenticated) {
      await this.loadCurrentUser();
      await this.loadUserGuilds();
      this.renderUserAvatar(this.state.currentUser);
    } else {
      this.renderLoginButton();
    }

    // Setup navigation
    this.setupNavigation(sectionName);

    return this.state;
  }

  // ===== SPA REINITIALIZATION =====
  async initForSPA(sectionName) {
    console.log('DocsCore.initForSPA() called with section:', sectionName);

    // Lighter initialization for SPA route changes
    const previousGuildId = this.state.currentGuildId;
    this.loadGuildContextFromURL();

    // If guild context changed, update indicator
    if (this.state.currentGuildId !== previousGuildId) {
      this.updateActiveGuildIndicator();
    }

    // Always re-setup navigation to update active section
    this.setupNavigation(sectionName);

    return this.state;
  }

  // ===== AUTHENTICATION =====
  async checkAuthStatus() {
    const token = localStorage.getItem('discord_token');
    if (token) {
      // Verify token is still valid by checking /auth/me
      try {
        const response = await fetch(`${this.API_BASE_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          this.state.isAuthenticated = true;
          return true;
        }
      } catch (error) {
        console.log('Token validation failed:', error);
      }
    }

    this.state.isAuthenticated = false;
    return false;
  }

  async loadCurrentUser() {
    try {
      const token = localStorage.getItem('discord_token');
      if (!token) return;

      const response = await fetch(`${this.API_BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        console.error('Failed to load user:', response.status);
        return;
      }

      const user = await response.json();
      if (user && !user.error) {
        this.state.currentUser = user;
      }
    } catch (error) {
      console.error('User loading error:', error);
    }
  }

  // ===== URL PARSING =====
  loadGuildContextFromURL() {
    // Parse optional ?guild= parameter for guild context
    const urlParams = new URLSearchParams(window.location.search);
    this.state.currentGuildId = urlParams.get('guild') || null;
  }

  // ===== GUILD LOADING & RENDERING =====
  async loadUserGuilds() {
    try {
      const token = localStorage.getItem('discord_token');
      if (!token) return;

      const response = await fetch(`${this.API_BASE_URL}/api/user/guilds`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        this.state.userGuilds = data.guilds;
        this.renderGuildIcons();
      }
    } catch (error) {
      console.error('Guild loading error:', error);
    }
  }

  renderUserAvatar(user) {
    const avatarElement = document.getElementById('guildSelectorAvatar');
    if (!avatarElement) return;

    if (user && user.avatar) {
      const avatarUrl = user.avatar.startsWith('http')
        ? user.avatar
        : `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
      avatarElement.style.backgroundImage = `url('${avatarUrl}')`;
      avatarElement.textContent = '';
    } else if (user) {
      // Fallback: first letter of username
      avatarElement.textContent = (user.username || user.global_name || 'U').charAt(0).toUpperCase();
      avatarElement.style.display = 'flex';
      avatarElement.style.alignItems = 'center';
      avatarElement.style.justifyContent = 'center';
      avatarElement.style.fontSize = '20px';
      avatarElement.style.fontWeight = 'bold';
      avatarElement.style.color = 'white';
      avatarElement.style.backgroundImage = 'none';
    }

    avatarElement.title = `${user.global_name || user.username || 'User'} - Go to Dashboard`;
    avatarElement.addEventListener('click', () => {
      window.location.href = '/dashboard';
    });
    avatarElement.style.cursor = 'pointer';
  }

  renderLoginButton() {
    const avatarElement = document.getElementById('guildSelectorAvatar');
    if (!avatarElement) return;

    // Clear background image
    avatarElement.style.backgroundImage = 'none';
    avatarElement.style.background = 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))';
    avatarElement.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    `;
    avatarElement.title = 'Login with Discord';
    avatarElement.style.cursor = 'pointer';
    avatarElement.style.display = 'flex';
    avatarElement.style.alignItems = 'center';
    avatarElement.style.justifyContent = 'center';

    // Add click handler to redirect to OAuth
    avatarElement.addEventListener('click', () => {
      this.initiateDiscordLogin();
    });

    // Hide guild list and divider when not authenticated
    const guildList = document.getElementById('guildIconList');
    const divider = document.getElementById('guildSelectorDivider');
    if (guildList) guildList.style.display = 'none';
    if (divider) divider.style.display = 'none';
  }

  initiateDiscordLogin() {
    // Redirect to Discord OAuth
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
    const clientId = '1247701827066130433'; // Your Discord client ID
    const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds`;

    window.location.href = oauthUrl;
  }

  renderGuildIcons() {
    const container = document.getElementById('guildIconList');
    if (!container) return;

    container.innerHTML = '';
    container.style.display = 'flex'; // Ensure visible when authenticated

    // Filter to only show guilds where user is owner or has admin permissions
    const manageableGuilds = this.state.userGuilds.filter(guild => {
      const isOwner = guild.owner === true;
      const isAdmin = guild.permissions && guild.permissions.includes('administrator');
      return isOwner || isAdmin;
    });

    manageableGuilds.forEach(guild => {
      const iconDiv = document.createElement('div');
      iconDiv.className = `guild-icon ${guild.id === this.state.currentGuildId ? 'active' : ''}`;
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

      iconDiv.addEventListener('click', () => this.switchGuild(guild.id));
      container.appendChild(iconDiv);
    });

    // Show divider when guilds are visible
    const divider = document.getElementById('guildSelectorDivider');
    if (divider) divider.style.display = 'block';
  }

  updateActiveGuildIndicator() {
    const container = document.getElementById('guildIconList');
    if (!container) return;

    container.querySelectorAll('.guild-icon').forEach(icon => {
      const isActive = icon.dataset.guildId === this.state.currentGuildId;
      icon.classList.toggle('active', isActive);
    });
  }

  switchGuild(guildId) {
    // Update guild context and navigate to current section with new guild
    this.state.currentGuildId = guildId;

    const pathParts = window.location.pathname.split('/');
    const currentSection = pathParts[2] || 'introduction';

    if (window.DocsRouter) {
      window.DocsRouter.navigate(currentSection, guildId);
    } else {
      window.location.href = `/docs/${currentSection}?guild=${guildId}`;
    }
  }

  // ===== NAVIGATION SETUP =====
  setupNavigation(currentSection) {
    const navContainer = document.getElementById('docsNavigation');
    if (!navContainer) return;

    navContainer.innerHTML = this.getNavigationHTML();

    // Setup click handlers
    document.querySelectorAll('.nav-item').forEach(item => {
      const section = item.dataset.section;

      if (section === currentSection) {
        item.classList.add('active');
      }

      item.addEventListener('click', () => {
        this.navigateToSection(section);
      });
    });

    // Setup section collapse handlers
    document.querySelectorAll('.nav-section-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.parentElement;
        section.classList.toggle('collapsed');
      });
    });
  }

  getNavigationHTML() {
    return `
      <div class="nav-section">
        <div class="nav-section-header">
          <svg class="collapse-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
          <span>GETTING STARTED</span>
        </div>
        <div class="nav-item" data-section="introduction">
          <span class="nav-icon">📚</span>
          <span class="nav-text">Introduction</span>
        </div>
        <div class="nav-item" data-section="quick-start">
          <span class="nav-icon">🚀</span>
          <span class="nav-text">Quick Start</span>
        </div>
      </div>

      <div class="nav-section">
        <div class="nav-section-header">
          <svg class="collapse-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
          <span>CORE SYSTEMS</span>
        </div>
        <div class="nav-item" data-section="leveling">
          <span class="nav-icon">⬆️</span>
          <span class="nav-text">Leveling System</span>
        </div>
        <div class="nav-item" data-section="economy">
          <span class="nav-icon">💰</span>
          <span class="nav-text">Economy & Banking</span>
        </div>
        <div class="nav-item" data-section="moderation">
          <span class="nav-icon">🛡️</span>
          <span class="nav-text">Moderation</span>
        </div>
        <div class="nav-item" data-section="ai">
          <span class="nav-icon">🤖</span>
          <span class="nav-text">AI Integration</span>
        </div>
      </div>

      <div class="nav-section">
        <div class="nav-section-header">
          <svg class="collapse-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
          <span>SOCIAL ALERTS</span>
        </div>
        <div class="nav-item" data-section="twitch">
          <span class="nav-icon">🟣</span>
          <span class="nav-text">Twitch Integration</span>
        </div>
        <div class="nav-item" data-section="youtube">
          <span class="nav-icon">🔴</span>
          <span class="nav-text">YouTube Integration</span>
        </div>
        <div class="nav-item" data-section="kick">
          <span class="nav-icon">🟢</span>
          <span class="nav-text">Kick Integration</span>
        </div>
      </div>

      <div class="nav-section">
        <div class="nav-section-header">
          <svg class="collapse-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
          <span>GAMES & GAMBLING</span>
        </div>
        <div class="nav-item" data-section="slots">
          <span class="nav-icon">🎰</span>
          <span class="nav-text">Slots</span>
        </div>
        <div class="nav-item" data-section="lottery">
          <span class="nav-icon">🎫</span>
          <span class="nav-text">Lottery</span>
        </div>
        <div class="nav-item" data-section="blackjack">
          <span class="nav-icon">🃏</span>
          <span class="nav-text">Blackjack</span>
        </div>
        <div class="nav-item" data-section="coinflip">
          <span class="nav-icon">🪙</span>
          <span class="nav-text">Coinflip</span>
        </div>
        <div class="nav-item" data-section="deathroll">
          <span class="nav-icon">🎲</span>
          <span class="nav-text">Deathroll</span>
        </div>
      </div>

      <div class="nav-section">
        <div class="nav-section-header">
          <svg class="collapse-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
          <span>UTILITIES</span>
        </div>
        <div class="nav-item" data-section="reaction-roles">
          <span class="nav-icon">✨</span>
          <span class="nav-text">Reaction Roles</span>
        </div>
        <div class="nav-item" data-section="custom-commands">
          <span class="nav-icon">⚙️</span>
          <span class="nav-text">Custom Commands</span>
        </div>
        <div class="nav-item" data-section="embeds">
          <span class="nav-icon">📝</span>
          <span class="nav-text">Better Embeds</span>
        </div>
        <div class="nav-item" data-section="reminders">
          <span class="nav-icon">⏰</span>
          <span class="nav-text">Reminders</span>
        </div>
      </div>

      <div class="nav-section">
        <div class="nav-section-header">
          <svg class="collapse-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
          <span>CHAOS</span>
        </div>
        <div class="nav-item" data-section="portals">
          <span class="nav-icon">🌀</span>
          <span class="nav-text">Cross-Server Portals</span>
        </div>
        <div class="nav-item" data-section="polymorph">
          <span class="nav-icon">🎭</span>
          <span class="nav-text">Polymorph</span>
        </div>
        <div class="nav-item" data-section="jail">
          <span class="nav-icon">🔒</span>
          <span class="nav-text">Jail System</span>
        </div>
      </div>

      <div class="nav-section">
        <div class="nav-section-header">
          <svg class="collapse-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          </svg>
          <span>REFERENCE</span>
        </div>
        <div class="nav-item" data-section="commands">
          <span class="nav-icon">📋</span>
          <span class="nav-text">Command List</span>
        </div>
      </div>
    `;
  }

  navigateToSection(section) {
    if (window.DocsRouter) {
      window.DocsRouter.navigate(section, this.state.currentGuildId);
    } else {
      const url = this.state.currentGuildId
        ? `/docs/${section}?guild=${this.state.currentGuildId}`
        : `/docs/${section}`;
      window.location.href = url;
    }
  }

  // ===== UTILITY FUNCTIONS =====
  showLoading(show) {
    this.state.isLoading = show;
    console.log('Loading:', show);
  }
}

// Export as singleton
window.DocsCore = new DocsCore();
console.log('DocsCore exported:', window.DocsCore);
