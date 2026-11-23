// Giveaway status and winner with claim countdown (§12.9.2).
import { el, clear, setVisible, startOverlay } from './overlay.js';
import { applyGiveawayEvent, formatCount, giveawayFromState, giveawayStatusText, secondsUntil } from './overlay-core.js';

const root = document.getElementById('root');
const panel = el('section', 'panel');
root.appendChild(panel);

let model = { giveaway: null, winner: null };
let showEntries = true;

function render() {
  clear(panel);
  const { giveaway, winner } = model;
  const visible = giveaway && giveaway.status !== 'cancelled';
  if (!visible) {
    setVisible(root, false);
    return;
  }
  panel.appendChild(el('div', 'alert-kicker', 'Giveaway'));
  panel.appendChild(el('div', 'big', giveaway.title || 'Giveaway'));
  const status = giveawayStatusText(giveaway);
  if (status) panel.appendChild(el('div', 'accent', status));
  if (showEntries && giveaway.entryCount !== null) {
    panel.appendChild(el('div', 'muted', `${formatCount(giveaway.entryCount)} ${giveaway.entryCount === 1 ? 'entry' : 'entries'}`));
  }
  if (winner && winner.giveawayId === giveaway.id && winner.status !== 'rerolled') {
    let line = `Winner: ${winner.name}`;
    if (winner.status === 'claimed') line += ' (claimed)';
    else if (winner.status === 'expired') line += ' (not claimed)';
    else if (winner.status === 'pending') {
      const left = secondsUntil(winner.claimDeadline, Date.now());
      if (left > 0) line += ` (${left}s to claim)`;
    }
    panel.appendChild(el('div', 'winner', line));
  }
  setVisible(root, true);
}

setInterval(() => {
  if (model.winner && model.winner.status === 'pending' && model.winner.claimDeadline) render();
}, 1000);

startOverlay('giveaway', {
  onConfig(config) {
    showEntries = config.show_entries !== false;
  },
  onState(state) {
    model = giveawayFromState(state);
    render();
  },
  onEvent(envelope) {
    const next = applyGiveawayEvent(model, envelope);
    if (next !== model) {
      model = next;
      render();
    }
  },
  onRevoked() {
    model = { giveaway: null, winner: null };
    render();
  },
});
