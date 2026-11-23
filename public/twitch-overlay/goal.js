// Goal bar: followers, subscribers, the channel's Twitch goal, or the active poll (§12.9.2).
import { el, clear, setVisible, startOverlay } from './overlay.js';
import { applyGoalEvent, formatCount, goalFromState, goalPercent, pollShares } from './overlay-core.js';

const root = document.getElementById('root');
const panel = el('section', 'panel');
root.appendChild(panel);

let source = 'followers';
let configTitle = '';
let goal = null;
let pollHideTimer = null;

function bar(percent, left, right) {
  const wrap = el('div', '');
  const track = el('div', 'bar');
  const fill = el('div', 'bar-fill');
  fill.style.width = `${percent.toFixed(1)}%`;
  track.appendChild(fill);
  wrap.appendChild(track);
  const text = el('div', 'bar-text');
  text.appendChild(el('span', 'ellipsis', left));
  text.appendChild(el('span', '', right));
  wrap.appendChild(text);
  return wrap;
}

function render() {
  clear(panel);
  if (!goal) {
    setVisible(root, false);
    return;
  }
  if (source === 'poll') {
    const poll = goal.poll;
    if (!poll) {
      setVisible(root, false);
      return;
    }
    panel.appendChild(el('div', 'bar-title', configTitle || poll.title));
    for (const choice of pollShares(poll)) {
      const row = el('div', 'poll-choice');
      row.appendChild(bar(choice.percent, choice.title, `${Math.round(choice.percent)}%`));
      panel.appendChild(row);
    }
    setVisible(root, true);
    return;
  }
  const title = goal.title || (source === 'subscribers' ? 'Subscriber goal' : source === 'twitch_goal' ? 'Goal' : 'Follower goal');
  panel.appendChild(el('div', 'bar-title', title));
  panel.appendChild(bar(goalPercent(goal.current, goal.target), '', `${formatCount(goal.current)} / ${formatCount(goal.target)}`));
  setVisible(root, true);
}

function schedulePollHide() {
  if (pollHideTimer) clearTimeout(pollHideTimer);
  pollHideTimer = null;
  const status = goal && goal.poll ? goal.poll.status : '';
  if (goal && goal.poll && status && status !== 'ACTIVE') {
    pollHideTimer = setTimeout(() => {
      goal = { ...goal, poll: null };
      render();
    }, 30000);
  }
}

startOverlay('goal', {
  onConfig(config) {
    source = typeof config.source === 'string' ? config.source : 'followers';
    configTitle = typeof config.title === 'string' ? config.title : '';
  },
  onState(state) {
    goal = goalFromState(state);
    schedulePollHide();
    render();
  },
  onEvent(envelope) {
    if (!goal) return;
    const next = applyGoalEvent(goal, envelope, configTitle);
    if (next !== goal) {
      goal = next;
      if (envelope.type === 'poll.update') schedulePollHide();
      render();
    }
  },
  onRevoked() {
    goal = null;
    render();
  },
});
