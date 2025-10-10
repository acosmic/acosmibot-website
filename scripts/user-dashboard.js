// Note: API_BASE_URL and currentUser are now provided by nav.js
// This avoids variable redeclaration errors

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async function() {
    await checkAuthAndLoadData();
});

// Check authentication and load user data
async function checkAuthAndLoadData() {
    // Check for token in URL parameters first (from OAuth redirect)
    const urlParams = new URLSearchParams(window.location.search);
    let token = urlParams.get('token');

    if (token) {
        // Store token from URL and clean up URL
        localStorage.setItem('discord_token', token);
        window.history.replaceState({}, document.title, window.location.pathname);
        console.log('Token received from URL and stored');
    } else {
        // Try to get token from localStorage
        token = localStorage.getItem('discord_token');
        console.log('Token from localStorage:', token ? 'Found' : 'Not found');
    }

    if (!token) {
        console.log('No token found, redirecting to home');
        setTimeout(() => window.location.href = '/', 1000); // Delay to see what's happening
        return;
    }

    try {
        console.log('Making API request to validate token...');
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('API response status:', response.status);

        if (response.ok) {
            currentUser = await response.json();
            console.log('User data loaded:', currentUser);
            await loadUserData();
            await loadLeaderboards();
        } else {
            const errorData = await response.json();
            console.error('API error:', errorData);
            localStorage.removeItem('discord_token');
            showNotification(`Authentication failed: ${errorData.error}`, 'error');
            setTimeout(() => window.location.href = '/', 3000);
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        showNotification(`Failed to connect to API: ${error.message}`, 'error');
        setTimeout(() => window.location.href = '/', 3000);
    }
}

// Load user data into the dashboard
async function loadUserData() {
    if (!currentUser) return;

    // Basic user info
    document.getElementById('userName').textContent = currentUser.username;
    document.getElementById('userLevel').textContent = currentUser.level || 1;
    document.getElementById('userCredits').textContent = (currentUser.currency || 0).toLocaleString();

    // Set avatar
    const avatarUrl = currentUser.avatar || `https://cdn.discordapp.com/embed/avatars/0.png`;
    document.getElementById('userAvatar').src = avatarUrl;

    // Load detailed user stats
    try {
        const response = await fetch(`${API_BASE_URL}/api/user/${currentUser.id}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('discord_token')}`
            }
        });

        if (response.ok) {
            const userData = await response.json();
            updateUserStats(userData);
        }

        // Get user rank info
        await loadUserRankings();

        // Get game stats
        await loadGameStats();
    } catch (error) {
        console.error('Failed to load detailed user data:', error);
        showNotification('Some data could not be loaded', 'error');
    }
}

// Update user stats display
function updateUserStats(userData) {
    document.getElementById('totalMessages').textContent = (userData.total_messages || 0).toLocaleString();
    document.getElementById('totalReactions').textContent = (userData.total_reactions || 0).toLocaleString();
    document.getElementById('totalCurrency').textContent = (userData.currency || 0).toLocaleString();
    document.getElementById('totalExp').textContent = (userData.global_exp || 0).toLocaleString();
}

// Load user rankings
async function loadUserRankings() {
    try {
        // Load currency rank
        const currencyRankResponse = await fetch(`${API_BASE_URL}/api/user/${currentUser.id}/rank/currency`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` }
        });
        if (currencyRankResponse.ok) {
            const currencyRank = await currencyRankResponse.json();
            document.getElementById('currencyRank').textContent = `Rank #${currencyRank.rank}`;
            document.getElementById('userRank').textContent = currencyRank.rank;
        }

        // Load experience rank
        const expRankResponse = await fetch(`${API_BASE_URL}/api/user/${currentUser.id}/rank/exp`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` }
        });
        if (expRankResponse.ok) {
            const expRank = await expRankResponse.json();
            document.getElementById('expRank').textContent = `Rank #${expRank.rank}`;
        }

        // For message and reaction ranks, we'll show placeholder for now
        document.getElementById('messageRank').textContent = 'Global ranking';
        document.getElementById('reactionRank').textContent = 'Global ranking';

    } catch (error) {
        console.error('Failed to load rankings:', error);
        document.getElementById('messageRank').textContent = 'Unable to load';
        document.getElementById('reactionRank').textContent = 'Unable to load';
        document.getElementById('currencyRank').textContent = 'Unable to load';
        document.getElementById('expRank').textContent = 'Unable to load';
        document.getElementById('userRank').textContent = '?';
    }
}

// Load game statistics
async function loadGameStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/user/${currentUser.id}/games`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` }
        });

        if (response.ok) {
            const gameStats = await response.json();
            document.getElementById('totalGames').textContent = gameStats.total_games.toLocaleString();
            document.getElementById('gameStats').textContent = `Win rate: ${gameStats.win_rate}%`;
        } else {
            document.getElementById('totalGames').textContent = '0';
            document.getElementById('gameStats').textContent = 'No games played';
        }

        // Set member info from user data
        if (currentUser.first_seen) {
            const firstSeen = new Date(currentUser.first_seen);
            document.getElementById('memberSince').textContent = firstSeen.toLocaleDateString();
        } else {
            document.getElementById('memberSince').textContent = 'Unknown';
        }

        if (currentUser.last_seen) {
            const lastSeen = new Date(currentUser.last_seen);
            const now = new Date();
            const diffHours = Math.floor((now - lastSeen) / (1000 * 60 * 60));

            if (diffHours < 1) {
                document.getElementById('lastSeen').textContent = 'Recently active';
            } else if (diffHours < 24) {
                document.getElementById('lastSeen').textContent = `${diffHours} hours ago`;
            } else {
                const diffDays = Math.floor(diffHours / 24);
                document.getElementById('lastSeen').textContent = `${diffDays} days ago`;
            }
        } else {
            document.getElementById('lastSeen').textContent = 'Unknown';
        }

    } catch (error) {
        console.error('Failed to load game stats:', error);
        document.getElementById('totalGames').textContent = 'N/A';
        document.getElementById('gameStats').textContent = 'Unable to load';
        document.getElementById('memberSince').textContent = 'N/A';
        document.getElementById('lastSeen').textContent = 'Unknown';
    }
}

// Load leaderboards
async function loadLeaderboards() {
    try {
        // Load currency leaderboard
        await loadLeaderboard('currency', 'currencyLeaderboard');

        // Load messages leaderboard
        await loadLeaderboard('messages', 'messagesLeaderboard');

        // Load level leaderboard
        await loadLeaderboard('level', 'levelLeaderboard');

    } catch (error) {
        console.error('Failed to load leaderboards:', error);
        showNotification('Failed to load leaderboards', 'error');
    }
}

// Load specific leaderboard
async function loadLeaderboard(type, elementId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/leaderboard/${type}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('discord_token')}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayLeaderboard(data, elementId, type);
        } else {
            throw new Error(`Failed to load ${type} leaderboard`);
        }
    } catch (error) {
        console.error(`Error loading ${type} leaderboard:`, error);
        document.getElementById(elementId).innerHTML = `<p style="text-align: center; opacity: 0.7;">Unable to load ${type} leaderboard</p>`;
    }
}

// Display leaderboard data
function displayLeaderboard(data, elementId, type) {
    const container = document.getElementById(elementId);

    if (!data || data.length === 0) {
        container.innerHTML = '<p style="text-align: center; opacity: 0.7;">No data available</p>';
        return;
    }

    const html = data.map((user, index) => {
        const value = type === 'currency' ? user[3] :
                      type === 'messages' ? user[3] :
                      type === 'level' ? `Level ${user[3].toLocaleString()} (${user[4]} XP)` : user[3];

        return `
            <div class="leaderboard-item">
                <span class="rank">#${index + 1}</span>
                <span class="username">${user[1] || user[2] || 'Unknown User'}</span>
                <span class="value">${typeof value === 'number' ? value.toLocaleString() : value}</span>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

// Note: logout() and showNotification() are now provided by nav.js