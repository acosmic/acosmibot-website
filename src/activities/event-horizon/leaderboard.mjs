import { avatarSource } from './avatar.mjs';
import { flightError } from './errors.mjs';
const $ = id => document.getElementById(id);
const number = value => Math.floor(Number(value) || 0).toLocaleString();
const duration = value => `${Math.floor((Number(value) || 0) / 60)}:${String(Math.floor((Number(value) || 0) % 60)).padStart(2, '0')}`;
let board;
const boards = {};
const boardTypes = {
  scores: { button: 'board-scores', path: '/leaderboard', label: 'Top score standings' },
  failures: { button: 'board-failures', path: '/failures', label: 'Most Deaths standings' },
  averages: { button: 'board-averages', path: '/averages', label: 'Highest Average Score standings' },
  combos: { button: 'board-combos', path: '/combos', label: 'Longest combo chain standings' },
  daily: { button: 'board-daily', path: '/daily', label: 'Daily Challenge standings for today' },
};
const averageNumber = value => (Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let boardKind='scores';
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

function row(entry, selfId, kind) {
  const failures = kind === 'failures', averages = kind === 'averages', combos = kind === 'combos', daily = kind === 'daily';
  const li = document.createElement('li'); if (selfId && (entry.playerId === selfId || entry.userId === selfId)) li.className = 'is-you';
  const rank = document.createElement('span'); rank.className = 'placing'; rank.textContent = String(entry.rank);
  const avatar = document.createElement('span'); avatar.className = 'pilot-avatar'; avatar.setAttribute('aria-hidden', 'true');
  const initial = String(entry.name || 'P').slice(0, 1);
  const source = avatarSource(entry); if (source) { const image = new Image(); image.src = source; image.alt = ''; image.referrerPolicy = 'no-referrer'; image.addEventListener('error', () => { avatar.textContent = initial; }); avatar.append(image); } else avatar.textContent = initial;
  const name = document.createElement('span'); name.className = 'pilot-name'; name.textContent = String(entry.name || 'Unknown pilot');
  const result = document.createElement('span'); result.className = 'pilot-result'; const score = document.createElement('strong'); score.textContent = failures?`${number(entry.deaths)} deaths`:averages?`${averageNumber(entry.averageScore)} avg`:combos?`${number(entry.bestCombo)}× chain`:number(entry.score); const time = document.createElement('small'); time.textContent = (failures||averages||combos)?`${number(entry.attempts)} attempts`:daily?`${duration(entry.survival)} · ${number(entry.maxCombo)}× chain`:`${duration(entry.survival)} survived`; result.append(score, time); li.append(rank, avatar, name, result); return li;
}
export function renderBoard(data) {
  const kind = data.kind || 'scores';
  const failures = kind === 'failures', averages = kind === 'averages', combos = kind === 'combos', daily = kind === 'daily';
  boards[kind] = data;
  if (kind === 'scores') board = data;
  if (kind !== boardKind) { if (kind === 'scores') void refreshBoard(); return; }
  const entries = Array.isArray(data.entries) ? data.entries : [];
  $('board-scope').textContent = data.scope || 'Discord server standings'; $('board-status').textContent = data.verification || 'Verified Discord flights'; $('standings').replaceChildren(...entries.map(entry => row(entry, data.self?.playerId || data.self?.userId, kind))); $('board-empty').hidden = entries.length > 0;
  $('board-empty').textContent=failures?'No verified deaths yet. Every comeback starts somewhere.':averages?'No ranked attempts yet. Start a flight to join the board.':combos?'No chains yet. Skim hazards back to back to start one.':daily?'Nobody has flown today’s Daily Challenge yet. Be the first.':'An empty orbit. Be the first to put a score on the board.';
  $('your-standing').textContent = failures?(data.self?`Your deaths ${number(data.self.deaths)} · #${data.self.rank}`:'You have no verified deaths yet.'):averages?(data.self?`Your average ${averageNumber(data.self.averageScore)} · #${data.self.rank}`:'No ranked attempts yet.'):combos?(data.self?`Your longest chain ${number(data.self.bestCombo)}× · #${data.self.rank}`:'No verified chain yet.'):daily?(data.self?`Your best today ${number(data.self.score)} · #${data.self.rank} of ${number(data.pilots)}`:'You have not flown today’s Daily Challenge yet.'): data.self ? `Your best ${number(data.self.score)} · #${data.self.rank}` : 'No verified flight yet. Finish a ranked run to set your mark.';
  $('nearest-rival').textContent = failures?'Attempts count new ranked flights. Leaving a flight does not count as a death.':averages?'Total verified score ÷ all attempts. Unfinished attempts count as zero. Ties favor more attempts.':combos?'Longest verified combo in one flight. Chains of 13 or more can set a server combo record.':daily?`Same seed for everyone here. Unlimited attempts; your best counts. ${dailyReset()}`:data.nearest ? `${number(data.nearest.gap)} points to pass ${data.nearest.name}.` : data.self ? 'You lead this server. Set the next target.' : '';
  $('board-expand').hidden = entries.length <= 3;
}
export async function refreshBoard() {
  if (!rankedAvailable) return; const request = ++requestNumber; $('board-refresh').disabled = true;
  try { const data = await api(boardTypes[boardKind].path); if (request === requestNumber) renderBoard(data); }
  catch (error) { if (request === requestNumber) { $('board-status').textContent = error.message; $('your-standing').textContent = 'Verified standings could not be loaded. Retry when you are connected.'; } }
  finally { if (request === requestNumber) $('board-refresh').disabled = false; }
}
$('board-refresh').addEventListener('click', () => void refreshBoard());
$('board-expand').addEventListener('click', () => { const expanded = $('leaderboard').classList.toggle('expanded'); $('board-expand').textContent = expanded ? 'Show Top 3' : 'View Top 10'; $('board-expand').setAttribute('aria-expanded', String(expanded)); });
export const boardReady = Promise.resolve();
// Every server's Daily Challenge rolls over at 00:00 UTC.
export function dailyReset(now = Date.now()) {
  const next = new Date(now); next.setUTCHours(24, 0, 0, 0);
  const minutes = Math.max(1, Math.ceil((next - now) / 60000));
  return `New flight in ${minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`}.`;
}
// The pilot's verified server best; local session bests must never claim to beat it.
export const currentBoard = () => board;
export const verifiedBest = () => Number(board?.self?.score) || 0;

for (const [kind, type] of Object.entries(boardTypes)) $(type.button).addEventListener('click', () => {
  if (boardKind === kind) return;
  boardKind = kind; ++requestNumber;
  $('board-refresh').disabled = false;
  for (const [key, item] of Object.entries(boardTypes)) $(item.button).setAttribute('aria-pressed', String(key === kind));
  $('standings').setAttribute('aria-label', type.label);
  const cached = boards[kind];
  if (cached) renderBoard(cached);
  else { $('standings').replaceChildren(); $('board-empty').hidden = true; $('board-status').textContent = 'Loading standings…'; $('your-standing').textContent = ''; $('nearest-rival').textContent = ''; $('board-expand').hidden = true; }
  void refreshBoard();
});
