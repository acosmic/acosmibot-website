// Spectator emoji reactions: picker data, most-used tracking, and the float layer.
// Presentation only; nothing here touches the ranked simulation.
export const STANDARD = [
  ['🔥','fire lit hot'],['👏','clap applause'],['😂','joy laugh lol'],['😱','scream shock'],['💀','skull dead rip'],
  ['🚀','rocket launch'],['❤️','heart love'],['🎉','party tada celebrate'],['👀','eyes watching'],['😭','sob cry'],
  ['🤯','mind blown'],['😮','wow open mouth'],['😬','grimace yikes'],['🫡','salute'],['🙏','pray please'],
  ['💪','muscle strong'],['👍','thumbs up yes'],['👎','thumbs down no'],['🤣','rofl laugh'],['😎','cool sunglasses'],
  ['🥶','cold freezing'],['🥵','hot sweating'],['😤','huff triumph'],['🤡','clown'],['👑','crown king queen'],
  ['🏆','trophy win'],['⭐','star'],['✨','sparkles'],['💥','boom explosion'],['⚡','zap lightning'],
  ['🌌','galaxy space'],['🕳️','hole black hole'],['☄️','comet asteroid'],['🛸','ufo'],['💎','gem shard diamond'],
  ['🎯','target bullseye'],['🍿','popcorn'],['🫣','peek scared'],['😈','devil smiling'],['💯','hundred'],
].map(([char, keywords]) => ({char, name: keywords.split(' ')[0], keywords}));
export const DEFAULT_QUICK = ['🔥', '👏', '😂'].map(char => STANDARD.find(e => e.char === char));

export const emojiKey = emoji => emoji.id ? `c:${emoji.id}` : emoji.char;
// The Activity proxy maps /discord-cdn to Discord's CDN.
export const emojiSource = emoji => /^[0-9]{1,20}$/.test(emoji.id || '') ? `/discord-cdn/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'webp'}?size=64` : null;
export const wireEmoji = emoji => emoji.id ? {id: emoji.id, animated: emoji.animated === true} : emoji.char;

// Sections for the picker: the viewer's servers first, then standard emoji.
export function searchEmojis(servers, query) {
  const q = String(query || '').trim().toLowerCase().replace(/^:|:$/g, '');
  const sections = (servers || []).map(server => ({
    title: server.name,
    emojis: (server.emojis || []).filter(e => !q || e.name.toLowerCase().includes(q)),
  }));
  sections.push({title: 'Standard', emojis: STANDARD.filter(e => !q || e.keywords.includes(q) || e.char === q)});
  return sections.filter(section => section.emojis.length);
}

// Most-used counts are remembered per device. A custom emoji only counts while
// it is still in the viewer's catalog, so a removed emoji drops out on its own.
// Until a viewer has favourites, quick buttons are Acosmibot's own emotes.
const FEATURED_FIRST = ['acocelebrate', 'acohearteyes', 'acoflex'];
export function defaultQuick(servers) {
  const featured = (servers || []).find(server => server.featured)?.emojis || [];
  const named = FEATURED_FIRST.map(name => featured.find(e => e.name.toLowerCase() === name)).filter(Boolean);
  return [...named, ...featured.filter(e => !named.includes(e)), ...DEFAULT_QUICK];
}
export function quickEmojis(usage, servers, count = 3) {
  const custom = new Map((servers || []).flatMap(s => s.emojis || []).map(e => [emojiKey(e), e]));
  const standard = new Map(STANDARD.map(e => [e.char, e]));
  const ranked = Object.entries(usage || {}).filter(([, n]) => Number.isFinite(n) && n > 0)
    .sort((a, b) => b[1] - a[1]).map(([key]) => custom.get(key) || standard.get(key)).filter(Boolean);
  const picked = [];
  for (const emoji of [...ranked, ...defaultQuick(servers)]) {
    if (picked.length >= count) break;
    if (!picked.some(p => emojiKey(p) === emojiKey(emoji))) picked.push(emoji);
  }
  return picked;
}
export function recordUse(usage, emoji) {
  const next = {...usage, [emojiKey(emoji)]: (Number(usage?.[emojiKey(emoji)]) || 0) + 1};
  // Keep the table small: forget the least used beyond 60 entries.
  return Object.fromEntries(Object.entries(next).sort((a, b) => b[1] - a[1]).slice(0, 60));
}
export function loadUsage(storage) {
  try { const value = JSON.parse(storage.getItem('eh-emoji-usage') || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
}
export function saveUsage(storage, usage) { try { storage.setItem('eh-emoji-usage', JSON.stringify(usage)); } catch { /* per-session only */ } }

// A relayed reaction is untrusted: accept only a short emoji string or a numeric id.
export function reactionForView(message) {
  const emoji = message?.emoji;
  if (!emoji || typeof emoji !== 'object') return null;
  if (typeof emoji.char === 'string' && emoji.char.length <= 16 && !emoji.id) return {char: emoji.char};
  if (typeof emoji.id === 'string' && /^[0-9]{1,20}$/.test(emoji.id)) return {id: emoji.id, animated: emoji.animated === true};
  return null;
}

export function emojiNode(emoji, doc = document) {
  const source = emojiSource(emoji);
  if (!source) { const span = doc.createElement('span'); span.textContent = emoji.char; return span; }
  const image = doc.createElement('img'); image.src = source; image.alt = emoji.name ? `:${emoji.name}:` : ''; image.draggable = false; image.referrerPolicy = 'no-referrer';
  return image;
}

// Floats one emoji up the left edge, away from the flight's focus. Bounded so a burst
// of reactions can never pile up unbounded DOM.
export function floatEmoji(layer, emoji, {max = 36, random = Math.random} = {}) {
  while (layer.childElementCount >= max) layer.firstElementChild.remove();
  const node = layer.ownerDocument.createElement('div'); node.className = 'reaction';
  node.style.setProperty('--x', `${Math.round(random() * 100)}%`);
  node.style.setProperty('--drift', `${Math.round((random() - .5) * 90)}px`);
  node.style.setProperty('--spin', `${Math.round((random() - .5) * 40)}deg`);
  node.style.setProperty('--time', `${(3 + random() * 1.4).toFixed(2)}s`);
  node.style.setProperty('--size', `${Math.round(30 + random() * 18)}px`);
  const content = emojiNode(emoji, layer.ownerDocument);
  content.addEventListener?.('error', () => node.remove(), {once: true});
  node.append(content); node.addEventListener('animationend', () => node.remove(), {once: true});
  layer.append(node); return node;
}
