// Now playing: the current song request with an optional progress bar (§12.9.2).
import { el, clear, setVisible, startOverlay } from './overlay.js';
import { applyNowPlayingEvent, formatClock, nowPlayingFromState, songProgress } from './overlay-core.js';

const root = document.getElementById('root');
const panel = el('section', 'panel');
root.appendChild(panel);

let model = { current: null, length: 0 };
let showRequester = true;
let showProgress = true;
let fill = null;
let clock = null;

function render() {
  clear(panel);
  fill = null;
  clock = null;
  const song = model.current;
  if (!song) {
    setVisible(root, false);
    return;
  }
  panel.appendChild(el('div', 'alert-kicker', 'Now playing'));
  panel.appendChild(el('div', 'big', song.title));
  const meta = [song.channel, showRequester && song.requester ? `requested by ${song.requester}` : ''].filter(Boolean).join(' · ');
  if (meta) panel.appendChild(el('div', 'muted ellipsis', meta));
  if (showProgress && songProgress(song, Date.now())) {
    const track = el('div', 'bar');
    fill = el('div', 'bar-fill');
    track.appendChild(fill);
    panel.appendChild(track);
    clock = el('div', 'bar-text');
    panel.appendChild(clock);
    tick();
  }
  setVisible(root, true);
}

function tick() {
  if (!fill || !clock || !model.current) return;
  const progress = songProgress(model.current, Date.now());
  if (!progress) return;
  fill.style.width = `${(progress.fraction * 100).toFixed(1)}%`;
  clock.textContent = `${formatClock(progress.elapsed)} / ${formatClock(progress.duration)}`;
}

setInterval(tick, 1000);

startOverlay('nowplaying', {
  onConfig(config) {
    showRequester = config.show_requester !== false;
    showProgress = config.show_progress !== false;
  },
  onState(state) {
    model = nowPlayingFromState(state);
    render();
  },
  onEvent(envelope) {
    const next = applyNowPlayingEvent(model, envelope);
    if (next !== model) {
      const songChanged = next.current !== model.current;
      model = next;
      if (songChanged) render();
    }
  },
  onRevoked() {
    model = { current: null, length: 0 };
    render();
  },
});
