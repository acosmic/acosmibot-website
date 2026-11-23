// Single text label (latest follower, latest sub, stream title …) (§12.9.2).
import { el, setVisible, startOverlay } from './overlay.js';
import { applyLabelEvent, createThrottle, labelText } from './overlay-core.js';

const root = document.getElementById('root');
const text = el('div', 'label-text');
root.appendChild(text);

let prefix = '';
let current = '';
const throttle = createThrottle(30000);
let refreshTimer = null;
let overlay = null;

function render() {
  const value = labelText(prefix, current);
  text.textContent = value;
  setVisible(root, value !== '');
}

function requestRefresh() {
  if (refreshTimer || !overlay) return;
  const wait = throttle.request(Date.now());
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    throttle.ran(Date.now());
    void overlay.refreshState();
  }, wait);
}

overlay = startOverlay('label', {
  onConfig(config) {
    prefix = typeof config.prefix === 'string' ? config.prefix : '';
  },
  onState(state) {
    current = state && typeof state.text === 'string' ? state.text : '';
    render();
  },
  onEvent(envelope) {
    const change = applyLabelEvent(envelope);
    if (!change) return;
    if (change.refresh) {
      requestRefresh();
      return;
    }
    current = change.text;
    render();
  },
  onRevoked() {
    current = '';
    render();
  },
});
