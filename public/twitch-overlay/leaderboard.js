// Leaderboard: top N viewers by points or watch time (§12.9.2).
import { el, clear, setVisible, startOverlay } from './overlay.js';
import { cleanText, configInt, createThrottle, leaderboardRows } from './overlay-core.js';

const root = document.getElementById('root');
const panel = el('section', 'panel');
root.appendChild(panel);

let count = 5;
let configTitle = '';
let by = 'points';
const throttle = createThrottle(30000);
let refreshTimer = null;
let overlay = null;

function render(state) {
  clear(panel);
  const rows = leaderboardRows(state, count);
  if (!rows.length) {
    setVisible(root, false);
    return;
  }
  const title = cleanText(configTitle, 40) || cleanText(state && state.title, 40) || (by === 'watch_minutes' ? 'Top watch time' : 'Top viewers');
  panel.appendChild(el('div', 'bar-title', title));
  const list = el('ol', 'board-rows');
  for (const row of rows) {
    const item = el('li', 'board-row');
    item.appendChild(el('span', 'board-rank', `${row.rank}.`));
    item.appendChild(el('span', 'ellipsis', row.name));
    item.appendChild(el('span', 'board-value', by === 'watch_minutes' ? `${row.value} min` : row.value));
    list.appendChild(item);
  }
  panel.appendChild(list);
  setVisible(root, true);
}

function requestRefresh() {
  if (refreshTimer || !overlay) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    throttle.ran(Date.now());
    void overlay.refreshState();
  }, throttle.request(Date.now()));
}

overlay = startOverlay('leaderboard', {
  onConfig(config) {
    count = configInt(config.count, 5, 3, 10);
    configTitle = typeof config.title === 'string' ? config.title : '';
    by = config.by === 'watch_minutes' ? 'watch_minutes' : 'points';
  },
  onState(state) {
    render(state);
  },
  onEvent(envelope) {
    if (envelope.type === 'leaderboard.changed') requestRefresh();
  },
  onRevoked() {
    render(null);
  },
});
