const { useState, useEffect } = React;

const GuildStats = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [guildStats, setGuildStats] = useState(null);
  const [levelLeaderboard, setLevelLeaderboard] = useState([]);
  const [messagesLeaderboard, setMessagesLeaderboard] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [permissions, setPermissions] = useState(null);

  const guildId = new URLSearchParams(window.location.search).get('guild');
  const getAuthToken = () => localStorage.getItem('discord_token');

  useEffect(() => {
    if (guildId) {
      fetchAllData();
    }
  }, [guildId]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      if (!token) {
        window.location.href = `${API_BASE_URL}/auth/login`;
        return;
      }

      // Fetch guild stats, leaderboards, and user stats in parallel
      const [statsRes, levelRes, messagesRes, permissionsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/guilds/${guildId}/stats-db`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/api/guilds/${guildId}/leaderboard/level?limit=25`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/api/guilds/${guildId}/leaderboard/messages-db?limit=25`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/api/guilds/${guildId}/permissions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => null) // Permissions endpoint might not exist yet
      ]);

      if (statsRes.status === 401 || levelRes.status === 401 || messagesRes.status === 401) {
        localStorage.removeItem('discord_token');
        window.location.href = `${API_BASE_URL}/auth/login`;
        return;
      }

      const statsData = await statsRes.json();
      const levelData = await levelRes.json();
      const messagesData = await messagesRes.json();
      const permissionsData = permissionsRes ? await permissionsRes.json() : null;

      if (statsData.success) {
        setGuildStats(statsData.data);
      }

      if (levelData.success) {
        setLevelLeaderboard(levelData.data);
      }

      if (messagesData.success) {
        setMessagesLeaderboard(messagesData.data);
      }

      if (permissionsData && permissionsData.success) {
        setPermissions(permissionsData.data);
      }

      // Fetch current user's guild stats
      const userResponse = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        const userGuildStatsRes = await fetch(
          `${API_BASE_URL}/api/guilds/${guildId}/user/${userData.id}/stats`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (userGuildStatsRes.ok) {
          const userGuildStatsData = await userGuildStatsRes.json();
          if (userGuildStatsData.success) {
            setUserStats(userGuildStatsData.data);
          }
        }
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!guildId) {
    return (
      <div className="error-screen">
        <div className="error-box">
          <h3>No Guild Selected</h3>
          <p>Please select a guild from the guild selector.</p>
          <a href="/guild-selector.html" className="btn btn-primary">Back to Guilds</a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p className="loading-text">Loading guild statistics...</p>
      </div>
    );
  }

  if (error || !guildStats) {
    return (
      <div className="error-screen">
        <div className="error-box">
          <h3>Error Loading Statistics</h3>
          <p>{error || 'Failed to load guild statistics'}</p>
          <button onClick={fetchAllData} className="btn btn-primary">Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container stats-container">
      <div className="stats-header">
        <div className="header-info">
          <h1>{guildStats.guild_name}</h1>
          <p>Server Statistics & Leaderboards</p>
        </div>
        <div className="header-actions">
          <a href="/guild-selector.html" className="btn btn-secondary">
            Back to Guilds
          </a>
          {permissions && permissions.has_admin && (
            <a href={`/guild-dashboard.html?guild=${guildId}`} className="btn btn-primary">
              Server Settings
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="stats-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'leaderboards' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboards')}
        >
          Leaderboards
        </button>
        <button
          className={`tab ${activeTab === 'mystats' ? 'active' : ''}`}
          onClick={() => setActiveTab('mystats')}
        >
          My Stats
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="tab-content">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-content">
                <div className="stat-label">Total Members</div>
                <div className="stat-value">{formatNumber(guildStats.member_count)}</div>
                <div className="stat-subtext">
                  {formatNumber(guildStats.total_active_members)} active
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">💬</div>
              <div className="stat-content">
                <div className="stat-label">Total Messages</div>
                <div className="stat-value">{formatNumber(guildStats.total_messages)}</div>
                <div className="stat-subtext">All time</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">⭐</div>
              <div className="stat-content">
                <div className="stat-label">Total Experience</div>
                <div className="stat-value">{formatNumber(guildStats.total_exp_distributed)}</div>
                <div className="stat-subtext">Distributed</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🏆</div>
              <div className="stat-content">
                <div className="stat-label">Highest Level</div>
                <div className="stat-value">{formatNumber(guildStats.highest_level)}</div>
                <div className="stat-subtext">Avg: {guildStats.avg_level || 0}</div>
              </div>
            </div>
          </div>

          <div className="info-card">
            <h3>Server Activity</h3>
            <p>Last activity: {formatDate(guildStats.last_activity)}</p>
          </div>
        </div>
      )}

      {/* Leaderboards Tab */}
      {activeTab === 'leaderboards' && (
        <div className="tab-content">
          <div className="leaderboard-section">
            <h3 className="leaderboard-title">Messages Leaderboard</h3>
            <div className="leaderboard-table">
              <div className="leaderboard-header">
                <div className="rank-col">Rank</div>
                <div className="user-col">User</div>
                <div className="messages-col-main">Messages</div>
                <div className="level-col">Level</div>
                <div className="exp-col">Experience</div>
              </div>
              {messagesLeaderboard.length > 0 ? (
                messagesLeaderboard.map((entry) => (
                  <div key={entry.user_id} className="leaderboard-row">
                    <div className="rank-col">
                      <span className={`rank-badge ${entry.rank <= 3 ? `rank-${entry.rank}` : ''}`}>
                        #{entry.rank}
                      </span>
                    </div>
                    <div className="user-col">{entry.username || `User ${entry.user_id}`}</div>
                    <div className="messages-col-main">{formatNumber(entry.messages)}</div>
                    <div className="level-col">{formatNumber(entry.level)}</div>
                    <div className="exp-col">{formatNumber(entry.exp)}</div>
                  </div>
                ))
              ) : (
                <div className="empty-leaderboard">No data available</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* My Stats Tab */}
      {activeTab === 'mystats' && (
        <div className="tab-content">
          {userStats ? (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">🎯</div>
                  <div className="stat-content">
                    <div className="stat-label">Your Level</div>
                    <div className="stat-value">{formatNumber(userStats.level)}</div>
                    <div className="stat-subtext">Rank #{formatNumber(userStats.rank)}</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">⭐</div>
                  <div className="stat-content">
                    <div className="stat-label">Your Experience</div>
                    <div className="stat-value">{formatNumber(userStats.exp)}</div>
                    <div className="stat-subtext">Total earned</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">💬</div>
                  <div className="stat-content">
                    <div className="stat-label">Your Messages</div>
                    <div className="stat-value">{formatNumber(userStats.messages)}</div>
                    <div className="stat-subtext">In this server</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">💰</div>
                  <div className="stat-content">
                    <div className="stat-label">Your Currency</div>
                    <div className="stat-value">{formatNumber(userStats.currency)}</div>
                    <div className="stat-subtext">Available</div>
                  </div>
                </div>
              </div>

              <div className="info-card">
                <h3>Activity Details</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Joined:</span>
                    <span className="info-value">{formatDate(userStats.joined_at)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Last Active:</span>
                    <span className="info-value">{formatDate(userStats.last_active)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Reactions Sent:</span>
                    <span className="info-value">{formatNumber(userStats.reactions)}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h3>No Stats Available</h3>
              <p>You don't have any recorded activity in this server yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Render the application
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<GuildStats />);
