// ===== DOCS CORE MODULE =====
// Simplified DashboardCore for documentation pages
// Handles: Optional Authentication, Optional Guild Context, Navigation

console.log('docs-core.js loading...');

// Inline lucide SVG icons for the docs sidebar (16px, stroke = currentColor).
const DOCS_NAV_ICONS = {
  'book-open': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>`,
  'rocket': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"/><path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"/></svg>`,
  'trending-up': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/></svg>`,
  'landmark': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M10 18v-7"/><path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/></svg>`,
  'shield': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>`,
  'bot': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`,
  'tv-minimal-play': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M15.033 9.44a.647.647 0 0 1 0 1.12l-4.065 2.352a.645.645 0 0 1-.968-.56V7.648a.645.645 0 0 1 .967-.56z"/><path d="M7 21h10"/><rect width="20" height="14" x="2" y="3" rx="2"/></svg>`,
  'cherry': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z"/><path d="M12 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z"/><path d="M7 14c3.22-2.91 4.29-8.75 5-12 1.66 2.38 4.94 9 5 12"/><path d="M22 9c-4.29 0-7.14-2.33-10-7 5.71 0 10 4.67 10 7Z"/></svg>`,
  'bomb': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><circle cx="11" cy="13" r="9"/><path d="M14.35 4.65 16.3 2.7a2.41 2.41 0 0 1 3.4 0l1.6 1.6a2.4 2.4 0 0 1 0 3.4l-1.95 1.95"/><path d="m22 2-1.5 1.5"/></svg>`,
  'ticket': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>`,
  'spade': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M12 18v4"/><path d="M2 14.499a5.5 5.5 0 0 0 9.591 3.675.6.6 0 0 1 .818.001A5.5 5.5 0 0 0 22 14.5c0-2.29-1.5-4-3-5.5l-5.492-5.312a2 2 0 0 0-3-.02L5 8.999c-1.5 1.5-3 3.2-3 5.5"/></svg>`,
  'coins': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M13.744 17.736a6 6 0 1 1-7.48-7.48"/><path d="M15 6h1v4"/><path d="m6.134 14.768.866-.5 2 3.464"/><circle cx="16" cy="8" r="6"/></svg>`,
  'dices': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><rect width="12" height="12" x="2" y="10" rx="2" ry="2"/><path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"/><path d="M6 18h.01"/><path d="M10 14h.01"/><path d="M15 6h.01"/><path d="M18 9h.01"/></svg>`,
  'sparkles': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/></svg>`,
  'settings': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>`,
  'file-text': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
  'alarm-clock': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/></svg>`,
  'orbit': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M20.341 6.484A10 10 0 0 1 10.266 21.85"/><path d="M3.659 17.516A10 10 0 0 1 13.74 2.152"/><circle cx="12" cy="12" r="3"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/></svg>`,
  'venetian-mask': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M18 11c-1.5 0-2.5.5-3 2"/><path d="M4 6a2 2 0 0 0-2 2v4a5 5 0 0 0 5 5 8 8 0 0 1 5 2 8 8 0 0 1 5-2 5 5 0 0 0 5-5V8a2 2 0 0 0-2-2h-3a8 8 0 0 0-5 2 8 8 0 0 0-5-2z"/><path d="M6 11c1.5 0 2.5.5 3 2"/></svg>`,
  'lock': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  'clipboard-list': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>`,
};


class DocsCore {
  constructor() {
    this.API_BASE_URL = AppConfig.apiBaseUrl;
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

    // Setup mobile sidebar toggle
    this.setupMobileSidebar();

    return this.state;
  }

  // ===== MOBILE SIDEBAR TOGGLE =====
  setupMobileSidebar() {
    const toggle = document.getElementById('mobileSidebarToggle');
    if (!toggle) return;

    // Inject backdrop if not already present
    if (!document.getElementById('sidebarBackdrop')) {
      const backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      backdrop.id = 'sidebarBackdrop';
      document.body.appendChild(backdrop);
    }

    const backdrop = document.getElementById('sidebarBackdrop');

    const openSidebar = () => {
      document.querySelector('.navigation-sidebar')?.classList.add('open');
      backdrop.classList.add('open');
      toggle.classList.add('open');
      document.body.style.overflow = 'hidden';
    };

    const closeSidebar = () => {
      document.querySelector('.navigation-sidebar')?.classList.remove('open');
      backdrop.classList.remove('open');
      toggle.classList.remove('open');
      document.body.style.overflow = '';
    };

    toggle.addEventListener('click', () => {
      const isOpen = backdrop.classList.contains('open');
      isOpen ? closeSidebar() : openSidebar();
    });

    backdrop.addEventListener('click', closeSidebar);

    // Close sidebar when a nav item is clicked on mobile
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && e.target.closest('.nav-item')) {
        closeSidebar();
      }
    });
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
    // Navigate to server overview for the selected guild
    window.location.href = `/server/${guildId}/overview`;
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
          <span class="nav-icon">${DOCS_NAV_ICONS['book-open']}</span>
          <span class="nav-text">Introduction</span>
        </div>
        <div class="nav-item" data-section="quick-start">
          <span class="nav-icon">${DOCS_NAV_ICONS['rocket']}</span>
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
          <span class="nav-icon">${DOCS_NAV_ICONS['trending-up']}</span>
          <span class="nav-text">Leveling System</span>
        </div>
        <div class="nav-item" data-section="economy">
          <span class="nav-icon">${DOCS_NAV_ICONS['landmark']}</span>
          <span class="nav-text">Economy & Banking</span>
        </div>
        <div class="nav-item" data-section="moderation">
          <span class="nav-icon">${DOCS_NAV_ICONS['shield']}</span>
          <span class="nav-text">Moderation</span>
        </div>
        <div class="nav-item" data-section="ai">
          <span class="nav-icon">${DOCS_NAV_ICONS['bot']}</span>
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
          <span class="nav-icon" style="color:#9146FF">${DOCS_NAV_ICONS['tv-minimal-play']}</span>
          <span class="nav-text">Twitch Integration</span>
        </div>
        <div class="nav-item" data-section="youtube">
          <span class="nav-icon" style="color:#FF0000">${DOCS_NAV_ICONS['tv-minimal-play']}</span>
          <span class="nav-text">YouTube Integration</span>
        </div>
        <div class="nav-item" data-section="kick">
          <span class="nav-icon" style="color:#53FC18">${DOCS_NAV_ICONS['tv-minimal-play']}</span>
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
          <span class="nav-icon">${DOCS_NAV_ICONS['cherry']}</span>
          <span class="nav-text">Slots</span>
        </div>
        <div class="nav-item" data-section="mines">
          <span class="nav-icon">${DOCS_NAV_ICONS['bomb']}</span>
          <span class="nav-text">Mines</span>
        </div>
        <div class="nav-item" data-section="lottery">
          <span class="nav-icon">${DOCS_NAV_ICONS['ticket']}</span>
          <span class="nav-text">Lottery</span>
        </div>
        <div class="nav-item" data-section="blackjack">
          <span class="nav-icon">${DOCS_NAV_ICONS['spade']}</span>
          <span class="nav-text">Blackjack</span>
        </div>
        <div class="nav-item" data-section="coinflip">
          <span class="nav-icon">${DOCS_NAV_ICONS['coins']}</span>
          <span class="nav-text">Coinflip</span>
        </div>
        <div class="nav-item" data-section="deathroll">
          <span class="nav-icon">${DOCS_NAV_ICONS['dices']}</span>
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
          <span class="nav-icon">${DOCS_NAV_ICONS['sparkles']}</span>
          <span class="nav-text">Reaction Roles</span>
        </div>
        <div class="nav-item" data-section="custom-commands">
          <span class="nav-icon">${DOCS_NAV_ICONS['settings']}</span>
          <span class="nav-text">Custom Commands</span>
        </div>
        <div class="nav-item" data-section="embeds">
          <span class="nav-icon">${DOCS_NAV_ICONS['file-text']}</span>
          <span class="nav-text">Better Embeds</span>
        </div>
        <div class="nav-item" data-section="reminders">
          <span class="nav-icon">${DOCS_NAV_ICONS['alarm-clock']}</span>
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
          <span class="nav-icon">${DOCS_NAV_ICONS['orbit']}</span>
          <span class="nav-text">Cross-Server Portals</span>
        </div>
        <div class="nav-item" data-section="polymorph">
          <span class="nav-icon">${DOCS_NAV_ICONS['venetian-mask']}</span>
          <span class="nav-text">Polymorph</span>
        </div>
        <div class="nav-item" data-section="jail">
          <span class="nav-icon">${DOCS_NAV_ICONS['lock']}</span>
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
          <span class="nav-icon">${DOCS_NAV_ICONS['clipboard-list']}</span>
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
