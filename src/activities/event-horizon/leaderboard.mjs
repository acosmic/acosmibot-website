import { avatarSource } from './avatar.mjs';
import { flightError } from './errors.mjs';
const $ = id => document.getElementById(id);
const number = value => Math.floor(Number(value) || 0).toLocaleString();
const duration = value => `${Math.floor((Number(value) || 0) / 60)}:${String(Math.floor((Number(value) || 0) % 60)).padStart(2, '0')}`;
let board;
let requestNumber = 0;
let sessionToken = null;
let rankedAvailable = false;
const compactBoard = matchMedia('(max-width:900px)');

function placeBoard() { if (compactBoard.matches) $('instructions').before($('leaderboard')); else $('overlay').append($('leaderboard')); }
compactBoard.addEventListener('change', placeBoard); placeBoard();

export function setSession(token) { sessionToken = token || null; rankedAvailable = Boolean(sessionToken); }
export function setRankedAvailable(available) { rankedAvailable = Boolean(available); }
export async function api(path, body) {
  if (!sessionToken) throw new Error('Discord verification is required for ranked flights.');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`/api/event-horizon${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${sessionToken}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    if (!response.ok) throw await flightError(response);
    return response.status === 204 ? null : response.json();
  } catch (error) { if (error?.name === 'AbortError') throw new Error('The request timed out. Check your connection and retry.'); throw error; } finally { clearTimeout(timeout); }
}

function row(entry, selfId) {
  const li = document.createElement('li'); if (entry.playerId === selfId || entry.userId === selfId) li.className = 'is-you';
  const rank = document.createElement('span'); rank.className = 'placing'; rank.textContent = String(entry.rank);
  const avatar = document.createElement('span'); avatar.className = 'pilot-avatar'; avatar.setAttribute('aria-hidden', 'true');
  const initial = String(entry.name || 'P').slice(0, 1);
  const source = avatarSource(entry); if (source) { const image = new Image(); image.src = source; image.alt = ''; image.referrerPolicy = 'no-referrer'; image.addEventListener('error', () => { avatar.textContent = initial; }); avatar.append(image); } else avatar.textContent = initial;
  const name = document.createElement('span'); name.className = 'pilot-name'; name.textContent = String(entry.name || 'Unknown pilot');
  const result = document.createElement('span'); result.className = 'pilot-result'; const score = document.createElement('strong'); score.textContent = number(entry.score); const time = document.createElement('small'); time.textContent = `${duration(entry.survival)} survived`; result.append(score, time); li.append(rank, avatar, name, result); return li;
}
export function renderBoard(data) {
  board = data; const entries = Array.isArray(data.entries) ? data.entries : [];
  $('board-scope').textContent = data.scope || 'Discord server standings'; $('board-status').textContent = data.verification || 'Verified Discord flights'; $('standings').replaceChildren(...entries.map(entry => row(entry, data.self?.playerId || data.self?.userId))); $('board-empty').hidden = entries.length > 0;
  $('your-standing').textContent = data.self ? `Your best ${number(data.self.score)} · #${data.self.rank}` : 'No verified flight yet. Finish a ranked run to set your mark.';
  $('nearest-rival').textContent = data.nearest ? `${number(data.nearest.gap)} points to pass ${data.nearest.name}.` : data.self ? 'You lead this server. Set the next target.' : '';
  $('board-expand').hidden = entries.length <= 3;
}
export async function refreshBoard() {
  if (!rankedAvailable) return; const request = ++requestNumber; $('board-refresh').disabled = true;
  try { const data = await api('/leaderboard'); if (request === requestNumber) renderBoard(data); }
  catch (error) { if (request === requestNumber) { $('board-status').textContent = error.message; $('your-standing').textContent = 'Verified standings could not be loaded. Retry when you are connected.'; } }
  finally { if (request === requestNumber) $('board-refresh').disabled = false; }
}
$('board-refresh').addEventListener('click', () => void refreshBoard());
$('board-expand').addEventListener('click', () => { const expanded = $('leaderboard').classList.toggle('expanded'); $('board-expand').textContent = expanded ? 'Show Top 3' : 'View Top 10'; $('board-expand').setAttribute('aria-expanded', String(expanded)); });
export const boardReady = Promise.resolve();
