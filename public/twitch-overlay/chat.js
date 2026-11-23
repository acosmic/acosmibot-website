// Chat box: the last N chat messages; deleted messages and timed-out or banned
// users are removed as soon as the moderation events arrive (§12.9.2).
import { el, clear, renderParts, setVisible, startOverlay } from './overlay.js';
import { applyChatEvent, configInt } from './overlay-core.js';

const root = document.getElementById('root');
const list = el('ol', 'chat-list');
root.appendChild(list);

let messages = [];
let options = { maxMessages: 15, showBadges: true };
let fadeAfterMs = 0;
const shownAt = new Map(); // message id -> first render time (bounded by messages)

function render() {
  clear(list);
  const now = Date.now();
  for (const message of messages) {
    if (!shownAt.has(message.id)) shownAt.set(message.id, now);
    const line = el('li', 'chat-line');
    for (const badge of message.badges) line.appendChild(el('span', 'chat-badge', badge));
    const name = el('span', 'chat-name', message.name);
    if (message.color) name.style.color = message.color;
    line.appendChild(name);
    const body = el('span', 'chat-text');
    renderParts(body, message.parts);
    line.appendChild(body);
    if (fadeAfterMs > 0 && now - shownAt.get(message.id) >= fadeAfterMs) line.classList.add('faded');
    list.appendChild(line);
  }
  for (const id of [...shownAt.keys()]) {
    if (!messages.some((m) => m.id === id)) shownAt.delete(id);
  }
  setVisible(root, messages.length > 0);
}

setInterval(() => {
  if (fadeAfterMs <= 0 || !messages.length) return;
  const now = Date.now();
  const before = messages.length;
  messages = messages.filter((m) => now - (shownAt.get(m.id) ?? now) < fadeAfterMs + 1000);
  if (messages.length !== before || messages.some((m) => now - (shownAt.get(m.id) ?? now) >= fadeAfterMs)) render();
}, 1000);

startOverlay('chat', {
  onConfig(config) {
    options = { maxMessages: configInt(config.max_messages, 15, 5, 50), showBadges: config.show_badges !== false };
    fadeAfterMs = configInt(config.fade_after_s, 0, 0, 600) * 1000;
    messages = messages.slice(-options.maxMessages);
  },
  onState() {
    render();
  },
  onEvent(envelope) {
    const next = applyChatEvent(messages, envelope, options);
    if (next !== messages) {
      messages = next;
      render();
    }
  },
  onRevoked() {
    messages = [];
    render();
  },
});
