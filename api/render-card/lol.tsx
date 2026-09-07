import satori from 'satori';
import { Resvg } from '@resvg/resvg-wasm';

import { LOL_CARD_HEIGHT, LOL_CARD_WIDTH, LolCard, type LolCardAssets } from '../../src/cards/LolCards';
import type {
  LolCardData,
  LolHistoryCardData,
  LolMatchCardData,
  LolParticipant,
  LolPlayerCardData,
  LolProfileCardData,
  LolRankedEntry,
  LolTeam,
  LolTimelineCardData,
} from '../../src/cards/types';

type Font = { name: string; data: Buffer; weight: 400 | 700; style: 'normal' };

const LOL_PLATFORMS = new Set([
  'BR1', 'EUN1', 'EUW1', 'JP1', 'KR', 'LA1', 'LA2', 'NA1', 'OC1',
  'PH2', 'RU', 'SG2', 'TH2', 'TR1', 'TW2', 'VN2',
]);
const RESULTS = new Set(['victory', 'defeat', 'remake', 'unknown']);
const ROLES = new Set(['top', 'jungle', 'middle', 'bottom', 'support', 'unknown']);
const EVENT_TYPES = new Set(['champion-kill', 'tower', 'inhibitor', 'dragon', 'herald', 'baron', 'unknown']);
const SIDES = new Set(['blue', 'red']);
const EVENT_SIDES = new Set(['blue', 'red', 'neutral']);

const DDRAGON_HOST = 'ddragon.leagueoflegends.com';
const MAX_DDRAGON_ASSETS = 96;
const DDRAGON_FETCH_CONCURRENCY = 6;
const MAX_DDRAGON_ASSET_BYTES = 384 * 1024;
const MAX_DDRAGON_TOTAL_BYTES = 3 * 1024 * 1024;
const DDRAGON_TIMEOUT_MS = 3_500;
const DDRAGON_CACHE_MAX_ENTRIES = 256;
const DDRAGON_CACHE_MAX_BYTES = 12 * 1024 * 1024;
const MAX_DDRAGON_CATALOG_BYTES = 768 * 1024;
const DDRAGON_CATALOG_MAX_ENTRIES = 16;

interface AssetRequest {
  key: string;
  url: string;
}

interface CachedAsset {
  dataUri: string;
  bytes: number;
  usedAt: number;
}

interface CatalogAsset {
  path: string;
  name: string;
}

interface CachedCatalog {
  champions: Map<number, CatalogAsset>;
  spells: Map<number, CatalogAsset>;
  runes: Map<number, CatalogAsset>;
  loadedAt: number;
  usedAt: number;
}

const ddragonCache = new Map<string, CachedAsset>();
let ddragonCacheBytes = 0;
const ddragonCatalogCache = new Map<string, CachedCatalog>();

const isRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]) => (
  Object.keys(value).every((key) => keys.includes(key))
);

const isString = (value: unknown, max: number, pattern?: RegExp) => (
  typeof value === 'string'
  && value.length > 0
  && value.length <= max
  && !Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  })
  && (!pattern || pattern.test(value))
);

const isOptionalString = (value: unknown, max: number, pattern?: RegExp) => (
  value === undefined || isString(value, max, pattern)
);

const hasCoreControlCharacter = (value: string) => Array.from(value).some((character) => {
  const code = character.codePointAt(0) ?? 0;
  return code <= 0x1F || (code >= 0x7F && code <= 0x9F);
});

const isFiniteNumber = (value: unknown, min: number, max: number, integer = false) => (
  typeof value === 'number'
  && Number.isFinite(value)
  && value >= min
  && value <= max
  && (!integer || Number.isInteger(value))
);

const isVersion = (value: unknown) => isString(value, 16, /^\d{1,2}\.\d{1,2}\.\d{1,3}$/);
const isPatch = (value: unknown) => isString(value, 16, /^\d{1,2}\.\d{1,2}(?:\.\d{1,3})?$/);
const isNumericAssetId = (value: unknown) => isFiniteNumber(value, 1, 1_000_000, true);
/**
 * Keep this aligned with Core's `parse_riot_id`: a display game name may use
 * any non-control character except `#`; only a tag line is alphanumeric.
 * Count Unicode code points, not UTF-16 code units, so Core-produced names
 * containing astral characters cannot be rejected here.
 */
const isRiotId = (value: unknown) => {
  if (typeof value !== 'string' || hasCoreControlCharacter(value)) return false;
  const parts = value.split('#');
  if (parts.length !== 2) return false;
  const [gameName, tagLine] = parts;
  const gameLength = Array.from(gameName).length;
  const tagLength = Array.from(tagLine).length;
  return gameLength >= 3
    && gameLength <= 16
    && tagLength >= 3
    && tagLength <= 5
    && /^[\p{L}\p{N}]+$/u.test(tagLine);
};

function isRankedEntry(value: unknown): value is LolRankedEntry {
  if (!isRecord(value) || typeof value.status !== 'string') return false;
  if (value.status === 'ranked') {
    return hasOnlyKeys(value, ['status', 'tier', 'division', 'leaguePoints', 'wins', 'losses'])
      && isString(value.tier, 30, /^[A-Za-z ]+$/)
      && isString(value.division, 12, /^[A-Za-z0-9 ]+$/)
      && isFiniteNumber(value.leaguePoints, 0, 9_999, true)
      && isFiniteNumber(value.wins, 0, 100_000, true)
      && isFiniteNumber(value.losses, 0, 100_000, true);
  }
  return (value.status === 'unranked' || value.status === 'unavailable')
    && hasOnlyKeys(value, ['status', 'detail'])
    && isOptionalString(value.detail, 120);
}

function isBase(data: Record<string, unknown>, card: LolCardData['card']) {
  return data.card === card
    && isRiotId(data.riotId)
    && typeof data.platform === 'string'
    && LOL_PLATFORMS.has(data.platform)
    && (data.dataDragonVersion === undefined || data.dataDragonVersion === null || isVersion(data.dataDragonVersion))
    && isOptionalString(data.notice, 240);
}

function isProfile(data: unknown): data is LolProfileCardData {
  if (!isRecord(data) || !hasOnlyKeys(data, ['card', 'riotId', 'platform', 'dataDragonVersion', 'notice', 'level', 'profileIconId', 'soloDuo', 'flex', 'mastery'])) return false;
  return isBase(data, 'lol-profile')
    && isFiniteNumber(data.level, 0, 10_000, true)
    && (data.profileIconId === undefined || isNumericAssetId(data.profileIconId))
    && isRankedEntry(data.soloDuo)
    && isRankedEntry(data.flex)
    && Array.isArray(data.mastery)
    && data.mastery.length <= 3
    && data.mastery.every((entry) => isRecord(entry)
      && hasOnlyKeys(entry, ['championId', 'championName', 'level', 'points', 'lastPlayed'])
      && isNumericAssetId(entry.championId)
      && isString(entry.championName, 64)
      && isFiniteNumber(entry.level, 0, 10, true)
      && isFiniteNumber(entry.points, 0, 100_000_000, true)
      && isOptionalString(entry.lastPlayed, 40));
}

function isHistoryMatch(value: unknown) {
  if (!isRecord(value) || !hasOnlyKeys(value, ['result', 'relativeTime', 'durationSeconds', 'queueLabel', 'championId', 'championName', 'role', 'kills', 'deaths', 'assists', 'cs', 'csPerMin'])) return false;
  return typeof value.result === 'string' && RESULTS.has(value.result)
    && isString(value.relativeTime, 48)
    && isFiniteNumber(value.durationSeconds, 0, 28_800, true)
    && isString(value.queueLabel, 72)
    && (value.championId === undefined || isNumericAssetId(value.championId))
    && isString(value.championName, 64)
    && typeof value.role === 'string' && ROLES.has(value.role)
    && isFiniteNumber(value.kills, 0, 1_000, true)
    && isFiniteNumber(value.deaths, 0, 1_000, true)
    && isFiniteNumber(value.assists, 0, 1_000, true)
    && isFiniteNumber(value.cs, 0, 10_000, true)
    && (value.csPerMin === undefined || isFiniteNumber(value.csPerMin, 0, 1_000));
}

function isHistory(data: unknown): data is LolHistoryCardData {
  if (!isRecord(data) || !hasOnlyKeys(data, ['card', 'riotId', 'platform', 'dataDragonVersion', 'notice', 'matches', 'unavailableCount'])) return false;
  return isBase(data, 'lol-history')
    && Array.isArray(data.matches)
    && data.matches.length <= 10
    && data.matches.every(isHistoryMatch)
    && (data.unavailableCount === undefined || isFiniteNumber(data.unavailableCount, 0, 10, true));
}

function isItemSlot(value: unknown) {
  return isRecord(value)
    && hasOnlyKeys(value, ['itemId', 'itemName'])
    && (value.itemId === null || isNumericAssetId(value.itemId))
    && (value.itemName === null || isString(value.itemName, 80));
}

function isParticipant(value: unknown, extraKeys: string[] = []): value is LolParticipant {
  if (!isRecord(value) || !hasOnlyKeys(value, ['riotId', 'teamSide', 'championId', 'championName', 'role', 'level', 'summonerSpellIds', 'kills', 'deaths', 'assists', 'cs', 'gold', 'damage', 'items', ...extraKeys])) return false;
  return isRiotId(value.riotId)
    && typeof value.teamSide === 'string' && SIDES.has(value.teamSide)
    && (value.championId === undefined || isNumericAssetId(value.championId))
    && isString(value.championName, 64)
    && typeof value.role === 'string' && ROLES.has(value.role)
    && isFiniteNumber(value.level, 0, 30, true)
    && Array.isArray(value.summonerSpellIds) && value.summonerSpellIds.length <= 2 && value.summonerSpellIds.every(isNumericAssetId)
    && isFiniteNumber(value.kills, 0, 1_000, true)
    && isFiniteNumber(value.deaths, 0, 1_000, true)
    && isFiniteNumber(value.assists, 0, 1_000, true)
    && isFiniteNumber(value.cs, 0, 10_000, true)
    && isFiniteNumber(value.gold, 0, 1_000_000, true)
    && isFiniteNumber(value.damage, 0, 10_000_000, true)
    && Array.isArray(value.items) && value.items.length <= 7 && value.items.every(isItemSlot);
}

function isTeam(value: unknown): value is LolTeam {
  if (!isRecord(value) || !hasOnlyKeys(value, ['side', 'result', 'kills', 'deaths', 'assists', 'gold', 'towers', 'dragons', 'heralds', 'barons', 'inhibitors'])) return false;
  return typeof value.side === 'string' && SIDES.has(value.side)
    && typeof value.result === 'string' && RESULTS.has(value.result)
    && ['kills', 'deaths', 'assists', 'gold', 'towers', 'dragons', 'heralds', 'barons', 'inhibitors']
      .every((key) => isFiniteNumber(value[key], 0, key === 'gold' ? 1_000_000 : 10_000, true));
}

function isMatch(data: unknown): data is LolMatchCardData {
  if (!isRecord(data) || !hasOnlyKeys(data, ['card', 'riotId', 'platform', 'dataDragonVersion', 'notice', 'matchSuffix', 'queueLabel', 'durationSeconds', 'patch', 'teams', 'participants'])) return false;
  return isBase(data, 'lol-match')
    && isString(data.matchSuffix, 18, /^[A-Za-z0-9_-]{4,18}$/)
    && isString(data.queueLabel, 72)
    && isFiniteNumber(data.durationSeconds, 0, 28_800, true)
    && isPatch(data.patch)
    && Array.isArray(data.teams) && data.teams.length === 2 && data.teams.every(isTeam)
    && new Set(data.teams.map((team) => team.side)).size === 2
    && Array.isArray(data.participants) && data.participants.length <= 10 && data.participants.every((participant) => isParticipant(participant));
}

function isPlayer(data: unknown): data is LolPlayerCardData {
  if (!isRecord(data) || !hasOnlyKeys(data, ['card', 'riotId', 'platform', 'dataDragonVersion', 'notice', 'matchSuffix', 'queueLabel', 'durationSeconds', 'patch', 'result', 'player', 'derived', 'purchaseOrder'])) return false;
  if (!isBase(data, 'lol-player')
    || !isString(data.matchSuffix, 18, /^[A-Za-z0-9_-]{4,18}$/)
    || !isString(data.queueLabel, 72)
    || !isFiniteNumber(data.durationSeconds, 0, 28_800, true)
    || !isPatch(data.patch)
    || typeof data.result !== 'string' || !RESULTS.has(data.result)
    || !isRecord(data.player)
    || !isRecord(data.derived)) return false;

  const player = data.player;
  if (!hasOnlyKeys(player, ['riotId', 'teamSide', 'championId', 'championName', 'role', 'level', 'summonerSpellIds', 'kills', 'deaths', 'assists', 'cs', 'gold', 'damage', 'items', 'damageTaken', 'visionScore', 'runeIds'])
    || !isParticipant(player, ['damageTaken', 'visionScore', 'runeIds'])
    || !isFiniteNumber(player.damageTaken, 0, 10_000_000, true)
    || !isFiniteNumber(player.visionScore, 0, 100_000, true)
    || !Array.isArray(player.runeIds)
    || player.runeIds.length > 9
    || !player.runeIds.every(isNumericAssetId)) return false;

  const derived = data.derived;
  if (!hasOnlyKeys(derived, ['killParticipation', 'csPerMin', 'goldPerMin', 'teamDamageShare'])) return false;
  if (!['killParticipation', 'csPerMin', 'goldPerMin', 'teamDamageShare'].every((key) => (
    derived[key] === undefined || isFiniteNumber(derived[key], 0, key.endsWith('Share') || key === 'killParticipation' ? 1 : 100_000)
  ))) return false;
  return data.purchaseOrder === undefined || (
    Array.isArray(data.purchaseOrder)
    && data.purchaseOrder.length <= 20
    && data.purchaseOrder.every(isNumericAssetId)
  );
}

function isTimeline(data: unknown): data is LolTimelineCardData {
  if (!isRecord(data) || !hasOnlyKeys(data, ['card', 'riotId', 'platform', 'dataDragonVersion', 'notice', 'matchSuffix', 'queueLabel', 'durationSeconds', 'status', 'unavailableReason', 'leadFrames', 'events'])) return false;
  return isBase(data, 'lol-timeline')
    && isString(data.matchSuffix, 18, /^[A-Za-z0-9_-]{4,18}$/)
    && isString(data.queueLabel, 72)
    && isFiniteNumber(data.durationSeconds, 0, 28_800, true)
    && (data.status === 'available' || data.status === 'unavailable')
    && isOptionalString(data.unavailableReason, 180)
    && Array.isArray(data.leadFrames) && data.leadFrames.length <= 31
    && data.leadFrames.every((frame) => isRecord(frame)
      && hasOnlyKeys(frame, ['minute', 'blueGold', 'redGold'])
      && isFiniteNumber(frame.minute, 0, 480, true)
      && isFiniteNumber(frame.blueGold, 0, 1_000_000, true)
      && isFiniteNumber(frame.redGold, 0, 1_000_000, true))
    && Array.isArray(data.events) && data.events.length <= 40
    && data.events.every((event) => isRecord(event)
      && hasOnlyKeys(event, ['timestampSeconds', 'type', 'side', 'summary'])
      && isFiniteNumber(event.timestampSeconds, 0, 28_800, true)
      && typeof event.type === 'string' && EVENT_TYPES.has(event.type)
      && typeof event.side === 'string' && EVENT_SIDES.has(event.side)
      && isString(event.summary, 180));
}

export function isValidLolCard(data: unknown): data is LolCardData {
  if (!isRecord(data)) return false;
  switch (data.card) {
    case 'lol-profile': return isProfile(data);
    case 'lol-history': return isHistory(data);
    case 'lol-match': return isMatch(data);
    case 'lol-player': return isPlayer(data);
    case 'lol-timeline': return isTimeline(data);
    default: return false;
  }
}

function dataDragonUrl(version: string, kind: 'champion' | 'item' | 'spell' | 'profile', id: string) {
  const base = `https://${DDRAGON_HOST}/cdn/${version}/img`;
  if (kind === 'champion') return `${base}/champion/${id}.png`;
  if (kind === 'item') return `${base}/item/${id}.png`;
  if (kind === 'spell') return `${base}/spell/${id}.png`;
  return `${base}/profileicon/${id}.png`;
}

function dataDragonRuneUrl(icon: string) {
  return `https://${DDRAGON_HOST}/cdn/img/${icon}`;
}

function dataDragonCatalogUrl(version: string, catalog: 'champion' | 'summoner' | 'runesReforged') {
  return `https://${DDRAGON_HOST}/cdn/${version}/data/en_US/${catalog}.json`;
}

/** Internal defense in depth: URLs are constructed here and still must match a reviewed path family. */
export function isAllowedDataDragonAssetUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return raw.startsWith(`https://${DDRAGON_HOST}/`)
      && url.protocol === 'https:'
      && url.hostname === DDRAGON_HOST
      && url.port === ''
      && url.username === ''
      && url.password === ''
      && url.search === ''
      && url.hash === ''
      && (/^\/cdn\/\d{1,2}\.\d{1,2}\.\d{1,3}\/img\/(?:champion\/[A-Za-z][A-Za-z0-9_]{0,63}|item\/\d{1,6}|spell\/[A-Za-z][A-Za-z0-9_]{0,63}|profileicon\/\d{1,6})\.png$/.test(url.pathname)
        || /^\/cdn\/img\/perk-images\/Styles\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\.png$/.test(url.pathname));
  } catch {
    return false;
  }
}

function isAllowedDataDragonCatalogUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return raw.startsWith(`https://${DDRAGON_HOST}/`)
      && url.protocol === 'https:'
      && url.hostname === DDRAGON_HOST
      && url.port === ''
      && url.username === ''
      && url.password === ''
      && url.search === ''
      && url.hash === ''
      && /^\/cdn\/\d{1,2}\.\d{1,2}\.\d{1,3}\/data\/en_US\/(?:champion|summoner|runesReforged)\.json$/.test(url.pathname);
  } catch {
    return false;
  }
}

function addAsset(requests: AssetRequest[], version: string, kind: 'champion' | 'item' | 'spell' | 'profile', id?: string | null, key?: string) {
  if (!id) return;
  const url = dataDragonUrl(version, kind, id);
  if (isAllowedDataDragonAssetUrl(url)) requests.push({ key: key || `${kind}:${id}`, url });
}

function addRuneAsset(requests: AssetRequest[], id: number, icon: string) {
  const url = dataDragonRuneUrl(icon);
  if (isAllowedDataDragonAssetUrl(url)) requests.push({ key: `rune:${id}`, url });
}

function assetRequests(data: LolCardData): { requests: AssetRequest[]; championIds: Set<number>; spellIds: Set<number>; runeIds: Set<number> } {
  const requests: AssetRequest[] = [];
  const championIds = new Set<number>();
  const spellIds = new Set<number>();
  const runeIds = new Set<number>();
  const version = data.dataDragonVersion;
  if (!version) return { requests, championIds, spellIds, runeIds };
  const addParticipant = (participant: LolParticipant) => {
    if (participant.championId !== undefined) championIds.add(participant.championId);
    participant.summonerSpellIds.forEach((id) => spellIds.add(id));
    participant.items.forEach((item) => addAsset(requests, version, 'item', item.itemId === null ? null : String(item.itemId)));
  };
  switch (data.card) {
    case 'lol-profile':
      if (data.profileIconId !== undefined) addAsset(requests, version, 'profile', String(data.profileIconId));
      data.mastery.forEach((entry) => championIds.add(entry.championId));
      break;
    case 'lol-history':
      data.matches.forEach((entry) => { if (entry.championId !== undefined) championIds.add(entry.championId); });
      break;
    case 'lol-match':
      data.participants.forEach(addParticipant);
      break;
    case 'lol-player':
      addParticipant(data.player);
      data.player.runeIds.forEach((id) => runeIds.add(id));
      break;
    case 'lol-timeline':
      break;
  }
  return { requests, championIds, spellIds, runeIds };
}

function assertDeclaredByteLimit(response: Response, maximum: number, label: string) {
  const header = response.headers.get('content-length');
  if (header === null) return;
  const declared = Number(header);
  if (!Number.isSafeInteger(declared) || declared < 0 || declared > maximum) {
    throw new Error(`${label} too large`);
  }
}

/** Read a Fetch stream with a hard cap even if Content-Length is absent or lies. */
async function readBoundedResponseBytes(response: Response, maximum: number, label: string): Promise<Buffer> {
  assertDeclaredByteLimit(response, maximum, label);
  if (!response.body || typeof response.body.getReader !== 'function') {
    // A standards-compliant Fetch response in Node 18/Azure has a stream. Do
    // not fall back to an unbounded arrayBuffer() for a nonstandard response.
    throw new Error(`${label} body unavailable`);
  }
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw new Error(`${label} too large`);
      }
      parts.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(parts.map((part) => Buffer.from(part)));
}

async function boundedJson(url: string): Promise<unknown> {
  if (!isAllowedDataDragonCatalogUrl(url)) throw new Error('catalog URL rejected');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DDRAGON_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'error' });
    if (!response.ok || response.redirected) throw new Error('catalog request failed');
    const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() || '';
    if (contentType !== 'application/json') throw new Error('catalog was not JSON');
    const bytes = await readBoundedResponseBytes(response, MAX_DDRAGON_CATALOG_BYTES, 'catalog');
    return JSON.parse(bytes.toString('utf8'));
  } finally {
    clearTimeout(timer);
  }
}

function addRunes(value: unknown, output: Map<number, CatalogAsset>) {
  if (Array.isArray(value)) {
    value.forEach((entry) => addRunes(entry, output));
    return;
  }
  if (!isRecord(value)) return;
  if (isFiniteNumber(value.id, 0, 1_000_000, true) && isString(value.icon, 240, /^perk-images\/Styles\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\.png$/)) {
    output.set(value.id, { path: value.icon, name: isString(value.name, 80) ? value.name : `rune ${value.id}` });
  }
  if (Array.isArray(value.slots)) addRunes(value.slots, output);
}

async function resolveCatalog(version: string): Promise<CachedCatalog | null> {
  const cached = ddragonCatalogCache.get(version);
  if (cached && Date.now() - cached.loadedAt <= 6 * 60 * 60 * 1000) {
    cached.usedAt = Date.now();
    return cached;
  }
  const [championsPayload, spellsPayload, runesPayload] = await Promise.all([
    boundedJson(dataDragonCatalogUrl(version, 'champion')),
    boundedJson(dataDragonCatalogUrl(version, 'summoner')),
    boundedJson(dataDragonCatalogUrl(version, 'runesReforged')),
  ]);
  if (!isRecord(championsPayload) || !isRecord(championsPayload.data) || !isRecord(spellsPayload) || !isRecord(spellsPayload.data) || !Array.isArray(runesPayload)) return null;
  const champions = new Map<number, CatalogAsset>();
  Object.values(championsPayload.data).forEach((entry) => {
    if (!isRecord(entry) || !isFiniteNumber(Number(entry.key), 0, 1_000_000, true) || !isString(entry.id, 64, /^[A-Za-z][A-Za-z0-9_]{0,63}$/)) return;
    champions.set(Number(entry.key), { path: entry.id, name: isString(entry.name, 80) ? entry.name : entry.id });
  });
  const spells = new Map<number, CatalogAsset>();
  Object.values(spellsPayload.data).forEach((entry) => {
    if (!isRecord(entry) || !isFiniteNumber(Number(entry.key), 0, 1_000_000, true) || !isRecord(entry.image) || !isString(entry.image.full, 68, /^[A-Za-z][A-Za-z0-9_]{0,63}\.png$/)) return;
    spells.set(Number(entry.key), { path: entry.image.full.slice(0, -4), name: isString(entry.name, 80) ? entry.name : `summoner spell ${entry.key}` });
  });
  const runes = new Map<number, CatalogAsset>();
  addRunes(runesPayload, runes);
  const resolved = { champions, spells, runes, loadedAt: Date.now(), usedAt: Date.now() };
  ddragonCatalogCache.set(version, resolved);
  while (ddragonCatalogCache.size > DDRAGON_CATALOG_MAX_ENTRIES) {
    const oldest = [...ddragonCatalogCache.entries()].reduce((current, item) => item[1].usedAt < current[1].usedAt ? item : current);
    ddragonCatalogCache.delete(oldest[0]);
  }
  return resolved;
}

function cacheAsset(url: string, dataUri: string, bytes: number) {
  const previous = ddragonCache.get(url);
  if (previous) ddragonCacheBytes -= previous.bytes;
  ddragonCache.set(url, { dataUri, bytes, usedAt: Date.now() });
  ddragonCacheBytes += bytes;
  while (ddragonCache.size > DDRAGON_CACHE_MAX_ENTRIES || ddragonCacheBytes > DDRAGON_CACHE_MAX_BYTES) {
    const oldest = [...ddragonCache.entries()].reduce((current, item) => (
      item[1].usedAt < current[1].usedAt ? item : current
    ));
    ddragonCache.delete(oldest[0]);
    ddragonCacheBytes -= oldest[1].bytes;
  }
}

async function boundedImageDataUri(url: string): Promise<{ dataUri: string; bytes: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DDRAGON_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'error' });
    if (!response.ok || response.redirected) throw new Error('asset request failed');
    const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() || '';
    if (!/^image\/(?:png|jpeg|webp|gif)$/.test(contentType)) throw new Error('asset was not an image');
    const bytes = await readBoundedResponseBytes(response, MAX_DDRAGON_ASSET_BYTES, 'asset');
    return { dataUri: `data:${contentType};base64,${bytes.toString('base64')}`, bytes: bytes.length };
  } finally {
    clearTimeout(timer);
  }
}

async function resolveAssets(data: LolCardData): Promise<{ assets: LolCardAssets; degraded: boolean }> {
  if (!data.dataDragonVersion) return { assets: {}, degraded: true };
  const requested = assetRequests(data);
  const assets: LolCardAssets = {};
  let degraded = false;
  const version = data.dataDragonVersion;
  if (version && (requested.championIds.size || requested.spellIds.size || requested.runeIds.size)) {
    try {
      const catalog = await resolveCatalog(version);
      if (!catalog) {
        degraded = true;
      } else {
        requested.championIds.forEach((id) => {
          const champion = catalog.champions.get(id);
          if (champion) {
            assets[`label:champion:${id}`] = champion.name;
            addAsset(requested.requests, version, 'champion', champion.path, `champion:${id}`);
          }
          else degraded = true;
        });
        requested.spellIds.forEach((id) => {
          const spell = catalog.spells.get(id);
          if (spell) {
            assets[`label:spell:${id}`] = spell.name;
            addAsset(requested.requests, version, 'spell', spell.path, `spell:${id}`);
          }
          else degraded = true;
        });
        requested.runeIds.forEach((id) => {
          const rune = catalog.runes.get(id);
          if (rune) {
            assets[`label:rune:${id}`] = rune.name;
            addRuneAsset(requested.requests, id, rune.path);
          }
          else degraded = true;
        });
      }
    } catch {
      // Static catalog failure is an optional visual degradation. Text labels
      // stay on the card and no caller-supplied URL is attempted as a fallback.
      degraded = true;
    }
  }
  const aliases = new Map<string, string[]>();
  requested.requests.forEach((request) => {
    const keys = aliases.get(request.url) || [];
    keys.push(request.key);
    aliases.set(request.url, keys);
  });
  const urls = [...aliases.keys()];
  const permitted = urls.slice(0, MAX_DDRAGON_ASSETS);
  let totalBytes = 0;
  degraded = degraded || urls.length > MAX_DDRAGON_ASSETS;

  await Promise.all(Array.from({ length: Math.min(DDRAGON_FETCH_CONCURRENCY, permitted.length) }, async (_, worker) => {
    for (let index = worker; index < permitted.length; index += DDRAGON_FETCH_CONCURRENCY) {
      const url = permitted[index];
      const cached = ddragonCache.get(url);
      if (cached) {
        // This is a per-render byte budget, not merely a network budget. A
        // warm cache must not make the Satori image map exceed its 3 MiB cap.
        if (totalBytes + cached.bytes > MAX_DDRAGON_TOTAL_BYTES) {
          degraded = true;
          continue;
        }
        totalBytes += cached.bytes;
        cached.usedAt = Date.now();
        aliases.get(url)?.forEach((key) => { assets[key] = cached.dataUri; });
        continue;
      }
      try {
        const loaded = await boundedImageDataUri(url);
        if (totalBytes + loaded.bytes > MAX_DDRAGON_TOTAL_BYTES) {
          degraded = true;
          continue;
        }
        totalBytes += loaded.bytes;
        cacheAsset(url, loaded.dataUri, loaded.bytes);
        aliases.get(url)?.forEach((key) => { assets[key] = loaded.dataUri; });
      } catch {
        degraded = true;
      }
    }
  }));

  return { assets, degraded };
}

export async function renderLolPng(
  data: LolCardData,
  loadFonts: () => Promise<Font[]>,
  ensureWasm: () => Promise<void>,
): Promise<Buffer> {
  const [fonts, resolved] = await Promise.all([loadFonts(), resolveAssets(data)]);
  const notice = resolved.degraded
    ? `${data.notice || 'Riot Games data · may be delayed'} · Some visual assets were unavailable; Core public stats remain readable.`
    : data.notice;
  const svg = await satori(<LolCard data={{ ...data, notice } as LolCardData} assets={resolved.assets} />, {
    width: LOL_CARD_WIDTH,
    height: LOL_CARD_HEIGHT,
    fonts,
  });
  await ensureWasm();
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: LOL_CARD_WIDTH } });
  return Buffer.from(resvg.render().asPng());
}

export const LOL_RENDER_LIMITS = {
  assetConcurrency: DDRAGON_FETCH_CONCURRENCY,
  maxAssets: MAX_DDRAGON_ASSETS,
  maxAssetBytes: MAX_DDRAGON_ASSET_BYTES,
  maxCatalogBytes: MAX_DDRAGON_CATALOG_BYTES,
  maxTotalAssetBytes: MAX_DDRAGON_TOTAL_BYTES,
  timeoutMs: DDRAGON_TIMEOUT_MS,
};
