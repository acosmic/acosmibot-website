// Recent events list (§12.9.2).
import { el, clear, setVisible, startOverlay } from './overlay.js';
import { addEventLine, configInt, eventLinesFromState } from './overlay-core.js';

const root = document.getElementById('root');
const list = el('ol', 'event-list');
root.appendChild(list);

let maxItems = 8;
let lines = [];

function render() {
  clear(list);
  for (const line of lines) {
    const item = el('li', 'event-line');
    item.appendChild(el('span', 'event-name', line.name));
    item.appendChild(el('span', 'event-text', line.text));
    if (line.test) item.appendChild(el('span', 'tag', 'Test'));
    list.appendChild(item);
  }
  setVisible(root, lines.length > 0);
}

startOverlay('events', {
  onConfig(config) {
    maxItems = configInt(config.max_items, 8, 3, 20);
  },
  onState(state) {
    lines = eventLinesFromState(state, maxItems);
    render();
  },
  onEvent(envelope) {
    const next = addEventLine(lines, envelope, maxItems);
    if (next !== lines) {
      lines = next;
      render();
    }
  },
  onRevoked() {
    lines = [];
    render();
  },
});
