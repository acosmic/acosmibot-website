// ===== DOCS SEARCH MODULE =====
// Client-side search functionality for documentation

console.log('docs-search.js loading...');

class DocsSearch {
  constructor() {
    this.searchIndex = [];
    this.initialized = false;
  }

  init() {
    const searchInput = document.getElementById('docsSearchInput');
    const searchResults = document.getElementById('docsSearchResults');

    if (!searchInput || !searchResults) {
      console.warn('Search elements not found');
      return;
    }

    // Build search index
    this.buildSearchIndex();

    // Setup search input handler
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();

      if (query.length < 2) {
        searchResults.style.display = 'none';
        searchResults.innerHTML = '';
        return;
      }

      const results = this.search(query);
      this.displayResults(results, searchResults);
    });

    // Hide results when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.style.display = 'none';
      }
    });

    this.initialized = true;
  }

  buildSearchIndex() {
    // Build a simple search index from navigation sections
    this.searchIndex = [
      // Getting Started
      { section: 'introduction', title: 'Introduction', keywords: 'intro getting started overview guide', category: 'Getting Started' },
      { section: 'quick-start', title: 'Quick Start', keywords: 'quick start setup begin tutorial', category: 'Getting Started' },

      // Core Systems
      { section: 'leveling', title: 'Leveling System', keywords: 'level xp experience rank progression role assignment', category: 'Core Systems' },
      { section: 'economy', title: 'Economy & Banking', keywords: 'economy money credits currency bank balance daily', category: 'Core Systems' },
      { section: 'moderation', title: 'Moderation', keywords: 'moderation mod log events member activity audit', category: 'Core Systems' },
      { section: 'ai', title: 'AI Integration', keywords: 'ai artificial intelligence chatbot openai gpt', category: 'Core Systems' },

      // Social Alerts
      { section: 'twitch', title: 'Twitch Integration', keywords: 'twitch stream live alert notification eventsub', category: 'Social Alerts' },
      { section: 'youtube', title: 'YouTube Integration', keywords: 'youtube video upload live stream alert notification', category: 'Social Alerts' },
      { section: 'kick', title: 'Kick Integration', keywords: 'kick stream live alert notification webhook', category: 'Social Alerts' },

      // Games & Gambling
      { section: 'slots', title: 'Slots', keywords: 'slots slot machine gambling casino spin', category: 'Games & Gambling' },
      { section: 'lottery', title: 'Lottery', keywords: 'lottery lotto ticket draw prize winning', category: 'Games & Gambling' },
      { section: 'blackjack', title: 'Blackjack', keywords: 'blackjack 21 card game casino gambling', category: 'Games & Gambling' },
      { section: 'coinflip', title: 'Coinflip', keywords: 'coinflip coin flip heads tails bet gambling', category: 'Games & Gambling' },
      { section: 'deathroll', title: 'Deathroll', keywords: 'deathroll death roll dice gambling wow', category: 'Games & Gambling' },

      // Utilities
      { section: 'reaction-roles', title: 'Reaction Roles', keywords: 'reaction role self assign button emoji', category: 'Utilities' },
      { section: 'custom-commands', title: 'Custom Commands', keywords: 'custom command trigger response action', category: 'Utilities' },
      { section: 'embeds', title: 'Better Embeds', keywords: 'embed instagram better link preview', category: 'Utilities' },
      { section: 'reminders', title: 'Reminders', keywords: 'reminder remind me timer schedule', category: 'Utilities' },

      // Chaos
      { section: 'portals', title: 'Cross-Server Portals', keywords: 'portal cross server message chat link', category: 'Chaos' },
      { section: 'polymorph', title: 'Polymorph', keywords: 'polymorph nickname name change display', category: 'Chaos' },
      { section: 'jail', title: 'Jail System', keywords: 'jail prison timeout punishment mute', category: 'Chaos' },

      // Reference
      { section: 'commands', title: 'Command List', keywords: 'command list reference all commands', category: 'Reference' },
    ];
  }

  search(query) {
    const lowerQuery = query.toLowerCase();
    const results = [];

    for (const item of this.searchIndex) {
      let score = 0;

      // Check if title matches
      if (item.title.toLowerCase().includes(lowerQuery)) {
        score += 10;
      }

      // Check if keywords match
      if (item.keywords.toLowerCase().includes(lowerQuery)) {
        score += 5;
      }

      // Check if section name matches
      if (item.section.toLowerCase().includes(lowerQuery)) {
        score += 3;
      }

      if (score > 0) {
        results.push({ ...item, score });
      }
    }

    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);

    // Return top 5 results
    return results.slice(0, 5);
  }

  displayResults(results, container) {
    if (results.length === 0) {
      container.innerHTML = '<div class="search-no-results">No results found</div>';
      container.style.display = 'block';
      return;
    }

    const html = results.map(result => `
      <div class="search-result-item" onclick="window.DocsRouter.navigate('${result.section}', window.DocsCore.state.currentGuildId)">
        <div class="search-result-title">${this.highlightQuery(result.title, container.previousElementSibling.value)}</div>
        <div class="search-result-category">${result.category}</div>
      </div>
    `).join('');

    container.innerHTML = html;
    container.style.display = 'block';
  }

  highlightQuery(text, query) {
    if (!query) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
}

// Initialize search when DOM is ready
window.DocsSearch = new DocsSearch();

// Auto-initialize when document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.DocsSearch.init();
  });
} else {
  window.DocsSearch.init();
}

console.log('DocsSearch exported:', window.DocsSearch);
