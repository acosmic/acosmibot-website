// Alert box: one alert card at a time from a bounded queue (§12.9.2).
import { el, clear, setVisible, startOverlay } from './overlay.js';
import { BoundedQueue, configInt, describeAlert } from './overlay-core.js';

const root = document.getElementById('root');
const stage = el('div', 'alert-stage');
root.appendChild(stage);

const queue = new BoundedQueue(50);
let durationMs = 6000;
let playSounds = false;
let ready = false;
let showing = false;

function playSound(url) {
  if (!playSounds || !url) return;
  try {
    const audio = new Audio(url);
    audio.volume = 0.6;
    audio.preload = 'auto';
    const done = () => audio.removeAttribute('src');
    audio.addEventListener('ended', done, { once: true });
    audio.addEventListener('error', done, { once: true });
    const played = audio.play();
    if (played && typeof played.catch === 'function') played.catch(() => {});
  } catch {
    /* sound is optional */
  }
}

function renderCard(card) {
  const node = el('section', 'alert-card panel');
  const kicker = el('div', 'alert-kicker', card.kicker);
  if (card.test) kicker.appendChild(el('span', 'tag', 'Test'));
  node.appendChild(kicker);
  node.appendChild(el('div', 'alert-name', card.name));
  if (card.detail) node.appendChild(el('div', 'alert-detail', card.detail));
  if (card.message) node.appendChild(el('div', 'alert-message', card.message));
  return node;
}

function showNext() {
  if (showing || !ready) return;
  const card = queue.shift();
  if (!card) {
    setVisible(root, false);
    return;
  }
  showing = true;
  clear(stage);
  const node = renderCard(card);
  stage.appendChild(node);
  setVisible(root, true);
  playSound(card.soundUrl);
  setTimeout(() => {
    node.classList.add('leaving');
    setTimeout(() => {
      if (node.parentNode) node.parentNode.removeChild(node);
      showing = false;
      setTimeout(showNext, 400);
    }, 320);
  }, durationMs);
}

startOverlay('alerts', {
  onConfig(config) {
    durationMs = configInt(config.duration_ms, 6000, 2000, 15000);
    playSounds = config.sound === true;
    ready = true;
  },
  onState() {
    showNext();
  },
  onEvent(envelope) {
    const card = describeAlert(envelope);
    if (!card) return;
    queue.push(card);
    showNext();
  },
  onRevoked() {
    queue.clear();
  },
});
