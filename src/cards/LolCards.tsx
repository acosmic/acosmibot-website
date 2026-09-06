import React from 'react';
import type {
  LolCardData,
  LolHistoryCardData,
  LolMatchCardData,
  LolParticipant,
  LolPlayerCardData,
  LolProfileCardData,
  LolResult,
  LolTeam,
  LolTimelineCardData,
} from './types';

/**
 * THESIS: A public League lookup reads like an Acosmibot ranked field report,
 * not a League-client clone or a generic dashboard. OWN-WORLD: Observatory
 * graphite planes, fine instrument dividers, Signal Cyan selection, literal
 * result colors, and compressed Urbanist data ledgers. STORY: Identity and the
 * match truth resolve before derived context; unavailable inputs stay visible.
 * FIRST VIEWPORT: A 1200×675 report has one decisive header, then team or
 * player facts in stable reading columns, closing with delay/source context.
 * FORM: Extension composition A Balanced Ledger for the stable scoreboard;
 * B informs Player Detail and C informs Timeline only; seed N/A.
 */

export const LOL_CARD_WIDTH = 1200;
export const LOL_CARD_HEIGHT = 675;

export type LolCardAssets = Record<string, string>;

const FONT_STACK = 'Urbanist, sans-serif';
const VOID = '#05080D';
const SPACE = '#08111A';
const PANEL = '#0D151D';
const RAISED = '#111C26';
const TEXT = '#F4FBFF';
const SECONDARY = '#A9BAC7';
const MUTED = '#8293A0';
const CYAN = '#67ECFF';
const SUCCESS = '#4FE3A1';
const ERROR = '#FF8F72';
const WARNING = '#FFB800';
const BORDER = 'rgba(244,251,255,0.11)';
const VICTORY_TINT = 'rgba(79,227,161,0.08)';
const DEFEAT_TINT = 'rgba(255,143,114,0.08)';

const commonRoot = {
  position: 'relative' as const,
  display: 'flex',
  flexDirection: 'column' as const,
  width: LOL_CARD_WIDTH,
  height: LOL_CARD_HEIGHT,
  overflow: 'hidden',
  color: TEXT,
  fontFamily: FONT_STACK,
  backgroundColor: VOID,
};

/** Truncate user-facing text by Unicode code point, never by UTF-16 code unit. */
export const compactLolText = (value: string, max: number) => {
  const characters = Array.from(value);
  return characters.length > max ? `${characters.slice(0, Math.max(1, max - 1)).join('')}…` : value;
};

const compact = compactLolText;

const formatNumber = (value: number) => Number.isFinite(value)
  ? Math.round(value).toLocaleString('en-US')
  : '—';

const formatDuration = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const resultTone = (result: LolResult) => {
  if (result === 'victory') return SUCCESS;
  if (result === 'defeat') return ERROR;
  if (result === 'remake') return WARNING;
  return MUTED;
};

const resultLabel = (result: LolResult) => {
  if (result === 'victory') return 'VICTORY';
  if (result === 'defeat') return 'DEFEAT';
  if (result === 'remake') return 'REMAKE';
  return 'RESULT UNKNOWN';
};

const asset = (assets: LolCardAssets, kind: string, id?: string | number | null) => (
  id !== undefined && id !== null ? assets[`${kind}:${id}`] || '' : ''
);

const assetLabel = (assets: LolCardAssets, kind: string, id: number | undefined | null, fallback: string) => (
  id !== undefined && id !== null ? assets[`label:${kind}:${id}`] || fallback : fallback
);

function AssetSquare({
  src,
  label,
  kind,
  assetId,
  size = 30,
  tone = CYAN,
}: {
  src?: string;
  label: string;
  kind?: 'champion' | 'item' | 'spell' | 'rune' | 'profile';
  assetId?: number | null;
  size?: number;
  tone?: string;
}) {
  const genericLabel = /^(?:champion|item|(?:summoner )?spell|rune|profile icon)\s+\d+$/i.test(label);
  const kindLabel = kind === 'profile' ? 'PROFILE' : (kind || 'asset').toUpperCase();
  const fallbackName = genericLabel ? kindLabel : compact(label, size <= 22 ? 5 : size <= 35 ? 8 : 12);
  const fallbackId = assetId && assetId > 0 ? `#${assetId}` : '';
  const fallbackFontSize = Math.max(7, Math.min(11, Math.round(size * 0.24)));
  return src ? (
    <img
      src={src}
      width={size}
      height={size}
      aria-label={label}
      style={{
        display: 'flex', width: size, height: size, objectFit: 'cover',
        borderRadius: 5, backgroundColor: RAISED,
      }}
    />
  ) : (
    <div
      aria-label={`${label} icon unavailable`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: size, height: size,
        boxSizing: 'border-box', border: `1px solid ${tone}66`, borderRadius: 5,
        color: tone, backgroundColor: RAISED, fontSize: fallbackFontSize,
        fontWeight: 700, letterSpacing: 0.15, lineHeight: 1.05,
      }}
    >
      <span>{fallbackName}</span>
      {fallbackId ? <span style={{ marginTop: 1, color: SECONDARY, fontSize: Math.max(6, fallbackFontSize - 1), letterSpacing: 0 }}>{fallbackId}</span> : null}
    </div>
  );
}

function ReportHeader({
  title,
  riotId,
  platform,
  right,
}: {
  title: string;
  riotId: string;
  platform: string;
  right?: string;
}) {
  return (
    <div
      style={{
        position: 'relative', display: 'flex', height: 52,
        borderBottom: `1px solid ${BORDER}`, backgroundColor: SPACE,
      }}
    >
      <span style={{ position: 'absolute', display: 'flex', left: 38, top: 18, color: CYAN, fontSize: 12, fontWeight: 700, letterSpacing: 1.6 }}>ACOSMIBOT</span>
      <span style={{ position: 'absolute', display: 'flex', left: 129, top: 16, color: MUTED, fontSize: 15 }}>//</span>
      <span style={{ position: 'absolute', display: 'flex', left: 161, top: 18, color: SECONDARY, fontSize: 12, fontWeight: 700, letterSpacing: 1.4 }}>{compact(title, 20)}</span>
      <span style={{ position: 'absolute', display: 'flex', left: 298, top: 13, width: 550, color: TEXT, fontSize: 20, fontWeight: 700 }}>{compact(riotId, 32)}</span>
      <span style={{ position: 'absolute', display: 'flex', right: 231, top: 18, color: CYAN, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>{platform}</span>
      {right ? <span style={{ position: 'absolute', display: 'flex', right: 38, top: 18, width: 166, justifyContent: 'flex-end', color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 0.7 }}>{compact(right.toUpperCase(), 34)}</span> : null}
    </div>
  );
}

function Footer({ notice }: { notice?: string }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', minHeight: 32, padding: '0 38px',
        borderTop: `1px solid ${BORDER}`, color: MUTED, fontSize: 11, fontWeight: 600,
      }}
    >
      <span>{compact(notice || 'Riot Games data · may be delayed', 108)}</span>
      <span style={{ marginLeft: 'auto', color: MUTED, letterSpacing: 0.7 }}>ACOSMIBOT FIELD REPORT</span>
    </div>
  );
}

/** One text run avoids Satori eliding History's individual header siblings. */
function HistoryHeader({ riotId, platform, count }: { riotId: string; platform: string; count: number }) {
  const context = `ACOSMIBOT // MATCH HISTORY · ${compact(riotId, 32)} · ${platform} · ${count} PUBLIC MATCH${count === 1 ? '' : 'ES'}`;
  return (
    <div style={{ position: 'relative', display: 'flex', height: 52, borderBottom: `1px solid ${BORDER}`, backgroundColor: SPACE }}>
      <span style={{ position: 'absolute', display: 'flex', left: 38, top: 18, color: CYAN, fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}>
        {context}
      </span>
    </div>
  );
}

function RankBand({ label, entry }: { label: string; entry: LolProfileCardData['soloDuo'] }) {
  const isRanked = entry.status === 'ranked';
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 342, height: 168,
        padding: '18px 20px', boxSizing: 'border-box', backgroundColor: PANEL,
        borderTop: `1px solid ${BORDER}`,
      }}
    >
      <div style={{ display: 'flex', color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 1.1 }}>
        {label}
      </div>
      {isRanked ? (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div style={{ display: 'flex', color: TEXT, fontSize: 29, lineHeight: 1, fontWeight: 700 }}>
            {compact(`${entry.tier} ${entry.division}`, 19)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 11, color: CYAN, fontSize: 17, fontWeight: 700 }}>
            {`${formatNumber(entry.leaguePoints)} LP`}
            <span style={{ marginLeft: 'auto', color: SECONDARY, fontSize: 12, fontWeight: 600 }}>
              {`${entry.wins}W · ${entry.losses}L`}
            </span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div style={{ display: 'flex', color: entry.status === 'unranked' ? SECONDARY : WARNING, fontSize: 26, fontWeight: 700 }}>
            {entry.status === 'unranked' ? 'Unranked' : 'Unavailable'}
          </div>
          <div style={{ display: 'flex', marginTop: 11, color: MUTED, fontSize: 12 }}>
            {compact(entry.detail || 'No ranked entry returned', 38)}
          </div>
        </div>
      )}
    </div>
  );
}

export function LolProfileCard({ data, assets = {} }: { data: LolProfileCardData; assets?: LolCardAssets }) {
  return (
    <div style={commonRoot}>
      <ReportHeader title="LEAGUE PROFILE" riotId={data.riotId} platform={data.platform} right={`level ${data.level}`} />
      <div style={{ display: 'flex', flex: 1, padding: '30px 38px 22px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 382, paddingRight: 34, borderRight: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
          <AssetSquare src={asset(assets, 'profile', data.profileIconId)} label={data.profileIconId ? `profile icon ${data.profileIconId}` : 'profile icon unavailable'} kind="profile" assetId={data.profileIconId} size={82} tone={CYAN} />
            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 17 }}>
              <span style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 1.1 }}>SUMMONER LEVEL</span>
              <strong style={{ color: TEXT, fontSize: 48, lineHeight: 1, fontWeight: 700 }}>{formatNumber(data.level)}</strong>
              <span style={{ color: data.profileIconId ? SECONDARY : WARNING, fontSize: 11, fontWeight: 600, marginTop: 6 }}>
                {data.profileIconId ? 'Public profile icon' : 'Profile icon unavailable'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36 }}>
            <span style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 1.1 }}>ACCOUNT SCOPE</span>
            <strong style={{ color: TEXT, fontSize: 22, marginTop: 8 }}>{data.platform} public data</strong>
            <span style={{ color: SECONDARY, fontSize: 13, lineHeight: 1.35, marginTop: 8 }}>
              Ranked entries and mastery are shown only when returned by the public API.
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginLeft: 34 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 1.1 }}>
            <span>RANKED QUEUES</span><span>RIOT-REPORTED</span>
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 11 }}>
            <RankBand label="SOLO / DUO" entry={data.soloDuo} />
            <RankBand label="FLEX" entry={data.flex} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 25, color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 1.1 }}>
            <span>TOP CHAMPION MASTERY</span><span>UP TO THREE ENTRIES</span>
          </div>
          <div style={{ display: 'flex', marginTop: 10, borderTop: `1px solid ${BORDER}` }}>
            {data.mastery.length ? data.mastery.map((mastery, index) => (
              <div key={`${mastery.championId}-${index}`} style={{ display: 'flex', alignItems: 'center', width: 228, height: 83, padding: '0 12px', boxSizing: 'border-box', borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
                <AssetSquare src={asset(assets, 'champion', mastery.championId)} label={assetLabel(assets, 'champion', mastery.championId, mastery.championName)} kind="champion" assetId={mastery.championId} size={38} />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, marginLeft: 10 }}>
                  <strong style={{ color: TEXT, fontSize: 13 }}>{compact(mastery.championName, 16)}</strong>
                  <span style={{ color: CYAN, fontSize: 12, fontWeight: 700, marginTop: 4 }}>{`M${mastery.level} · ${formatNumber(mastery.points)}`}</span>
                  {mastery.lastPlayed ? <span style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>{compact(mastery.lastPlayed, 18)}</span> : null}
                </div>
              </div>
            )) : (
              <div style={{ display: 'flex', alignItems: 'center', height: 83, width: '100%', color: WARNING, fontSize: 14, borderBottom: `1px solid ${BORDER}` }}>
                Champion mastery unavailable for this profile.
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer notice={data.notice} />
    </div>
  );
}

function HistoryRow({ data, assets, height }: { data: LolHistoryCardData['matches'][number]; assets: LolCardAssets; height: number }) {
  const tone = resultTone(data.result);
  return (
    <div style={{ display: 'flex', alignItems: 'center', minHeight: height, padding: '0 22px', borderBottom: `1px solid ${BORDER}`, backgroundColor: data.result === 'victory' ? VICTORY_TINT : data.result === 'defeat' ? DEFEAT_TINT : PANEL }}>
      <div style={{ display: 'flex', width: 106, flexDirection: 'column' }}>
        <strong style={{ color: tone, fontSize: 12, letterSpacing: 0.6 }}>{resultLabel(data.result)}</strong>
        <span style={{ color: MUTED, fontSize: 11, marginTop: 4 }}>{compact(data.relativeTime, 18)}</span>
      </div>
      <AssetSquare src={asset(assets, 'champion', data.championId)} label={assetLabel(assets, 'champion', data.championId, data.championName)} kind="champion" assetId={data.championId} size={34} />
      <div style={{ display: 'flex', width: 164, flexDirection: 'column', marginLeft: 11 }}>
        <strong style={{ color: TEXT, fontSize: 13 }}>{compact(data.championName, 19)}</strong>
        <span style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>{data.role === 'unknown' ? 'Role unknown' : data.role.toUpperCase()}</span>
      </div>
      <div style={{ display: 'flex', width: 205, color: SECONDARY, fontSize: 12 }}>{compact(data.queueLabel, 27)}</div>
      <div style={{ display: 'flex', width: 76, color: TEXT, fontSize: 13, fontWeight: 700 }}>{formatDuration(data.durationSeconds)}</div>
      <div style={{ display: 'flex', width: 128, color: TEXT, fontSize: 14, fontWeight: 700 }}>{`${data.kills} / ${data.deaths} / ${data.assists}`}</div>
      <div style={{ display: 'flex', width: 86, color: SECONDARY, fontSize: 12 }}>{`${formatNumber(data.cs)} CS`}</div>
      <div style={{ display: 'flex', color: data.csPerMin === undefined ? MUTED : CYAN, fontSize: 11, fontWeight: 700 }}>
        {data.csPerMin === undefined ? 'CS/min unavailable' : `${data.csPerMin.toFixed(1)} CS/min · derived`}
      </div>
    </div>
  );
}

export function LolHistoryCard({ data, assets = {} }: { data: LolHistoryCardData; assets?: LolCardAssets }) {
  const rowHeight = data.matches.length > 5 ? 49 : 78;
  return (
    <div style={commonRoot}>
      <HistoryHeader riotId={data.riotId} platform={data.platform} count={data.matches.length} />
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 38, padding: '0 22px', color: MUTED, backgroundColor: PANEL, borderBottom: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 700, letterSpacing: 0.9 }}>
        <span style={{ width: 106 }}>RESULT / TIME</span><span style={{ width: 209 }}>CHAMPION / ROLE</span><span style={{ width: 205 }}>QUEUE</span><span style={{ width: 76 }}>LENGTH</span><span style={{ width: 128 }}>K / D / A</span><span>CS / DERIVED RATE</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 16px', backgroundColor: SPACE }}>
        {data.matches.length ? data.matches.map((match, index) => (
          <HistoryRow key={`${match.championName}-${match.relativeTime}-${index}`} data={match} assets={assets} height={rowHeight} />
        )) : (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, color: SECONDARY }}>
            <strong style={{ color: TEXT, fontSize: 24 }}>No eligible public matches</strong>
            <span style={{ marginTop: 9, fontSize: 14 }}>Custom and private games are not included in this history.</span>
          </div>
        )}
        {data.unavailableCount ? <div style={{ display: 'flex', color: WARNING, fontSize: 11, padding: '8px 6px' }}>{`${data.unavailableCount} requested match record${data.unavailableCount === 1 ? '' : 's'} unavailable.`}</div> : null}
      </div>
      <Footer notice={data.notice} />
    </div>
  );
}

function TeamBand({ team }: { team: LolTeam }) {
  const tone = resultTone(team.result);
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 23, padding: '0 22px', backgroundColor: team.side === 'blue' ? SPACE : RAISED, borderBottom: `1px solid ${BORDER}` }}>
      <strong style={{ display: 'flex', width: 190, color: tone, fontSize: 13, letterSpacing: 0.8 }}>{`${team.side.toUpperCase()} · ${resultLabel(team.result)}`}</strong>
      <span style={{ display: 'flex', width: 198, color: SECONDARY, fontSize: 11 }}>{`DERIVED TEAM K/D/A  ${team.kills}/${team.deaths}/${team.assists}`}</span>
      <span style={{ display: 'flex', width: 165, color: TEXT, fontSize: 11, fontWeight: 700 }}>{`DERIVED TEAM GOLD ${formatNumber(team.gold)}`}</span>
      <span style={{ display: 'flex', color: MUTED, fontSize: 11 }}>{`Towers ${team.towers} · Dragons ${team.dragons} · Heralds ${team.heralds} · Baron ${team.barons} · Inhibitors ${team.inhibitors}`}</span>
    </div>
  );
}

function ParticipantRow({ participant, assets }: { participant: LolParticipant; assets: LolCardAssets }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 43, padding: '0 22px', borderBottom: `1px solid ${BORDER}`, backgroundColor: PANEL }}>
      <AssetSquare src={asset(assets, 'champion', participant.championId)} label={assetLabel(assets, 'champion', participant.championId, participant.championName)} kind="champion" assetId={participant.championId} size={32} />
      <div style={{ display: 'flex', flexDirection: 'column', width: 162, minWidth: 0, marginLeft: 9 }}>
        <strong style={{ color: TEXT, fontSize: 14 }}>{compact(participant.riotId, 22)}</strong>
        <span style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>{`${compact(participant.championName, 17)} · ${participant.role === 'unknown' ? 'ROLE UNKNOWN' : participant.role.toUpperCase()} · LVL ${participant.level}`}</span>
      </div>
      <div style={{ display: 'flex', width: 52, gap: 4 }}>
        {participant.summonerSpellIds.slice(0, 2).map((spellId) => <AssetSquare key={spellId} src={asset(assets, 'spell', String(spellId))} label={assetLabel(assets, 'spell', spellId, `summoner spell ${spellId}`)} kind="spell" assetId={spellId} size={20} tone={SECONDARY} />)}
      </div>
      <strong style={{ display: 'flex', width: 91, color: TEXT, fontSize: 15 }}>{`${participant.kills}/${participant.deaths}/${participant.assists}`}</strong>
      <span style={{ display: 'flex', width: 62, color: SECONDARY, fontSize: 10 }}>{`${participant.cs} CS`}</span>
      <span style={{ display: 'flex', width: 78, color: SECONDARY, fontSize: 10 }}>{`${formatNumber(participant.gold)} G`}</span>
      <span style={{ display: 'flex', width: 90, color: SECONDARY, fontSize: 10 }}>{`${formatNumber(participant.damage)} DMG`}</span>
      <div style={{ display: 'flex', gap: 3, minWidth: 0 }}>
        {participant.items.slice(0, 7).map((slot, index) => <AssetSquare key={`${slot.itemId || 'empty'}-${index}`} src={asset(assets, 'item', slot.itemId)} label={slot.itemName || (slot.itemId ? `item ${slot.itemId}` : 'empty item slot')} kind="item" assetId={slot.itemId} size={21} tone={MUTED} />)}
      </div>
    </div>
  );
}

export function LolMatchCard({ data, assets = {} }: { data: LolMatchCardData; assets?: LolCardAssets }) {
  const blue = data.teams.find((team) => team.side === 'blue');
  const red = data.teams.find((team) => team.side === 'red');
  const rows = (side: 'blue' | 'red') => data.participants.filter((participant) => participant.teamSide === side).slice(0, 5);
  return (
    <div style={commonRoot}>
      <ReportHeader title="SCOREBOARD" riotId={data.riotId} platform={data.platform} right={`match #${data.matchSuffix}`} />
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 30, padding: '0 22px', backgroundColor: SPACE, borderBottom: `1px solid ${BORDER}` }}>
        <strong style={{ display: 'flex', color: TEXT, fontSize: 13 }}>{compact(data.queueLabel, 42)}</strong>
        <span style={{ display: 'flex', marginLeft: 18, color: SECONDARY, fontSize: 11 }}>{`${formatDuration(data.durationSeconds)} · patch ${compact(data.patch, 12)}`}</span>
        <span style={{ display: 'flex', marginLeft: 'auto', color: MUTED, fontSize: 11 }}>Team totals marked derived</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 20, padding: '0 22px', color: MUTED, backgroundColor: PANEL, borderBottom: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 700, letterSpacing: 0.7 }}>
        <span style={{ width: 204 }}>PLAYER / CHAMPION</span><span style={{ width: 52 }}>SPELLS</span><span style={{ width: 91 }}>K / D / A</span><span style={{ width: 62 }}>CS</span><span style={{ width: 78 }}>GOLD</span><span style={{ width: 90 }}>DAMAGE</span><span>ITEMS + TRINKET</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 16px', backgroundColor: SPACE }}>
        {blue ? <TeamBand team={blue} /> : null}
        {rows('blue').map((participant, index) => <ParticipantRow key={`${participant.riotId}-${index}`} participant={participant} assets={assets} />)}
        {red ? <TeamBand team={red} /> : null}
        {rows('red').map((participant, index) => <ParticipantRow key={`${participant.riotId}-${index}`} participant={participant} assets={assets} />)}
        {data.participants.length < 10 ? <div style={{ display: 'flex', padding: '7px 6px', color: WARNING, fontSize: 11 }}>Partial match record: fewer than ten participants returned.</div> : null}
      </div>
      <Footer notice={data.notice} />
    </div>
  );
}

function MetricLine({ label, value, derived = false }: { label: string; value: string; derived?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', minHeight: 39, borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ display: 'flex', width: 150, color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}>{label}</span>
      <strong style={{ display: 'flex', color: derived ? CYAN : TEXT, fontSize: 18, fontWeight: 700 }}>{value}</strong>
      {derived ? <span style={{ display: 'flex', marginLeft: 7, color: MUTED, fontSize: 11 }}>DERIVED</span> : null}
    </div>
  );
}

const percentOrUnavailable = (value?: number) => value === undefined ? 'Unavailable' : `${(value * 100).toFixed(1)}%`;
const decimalOrUnavailable = (value?: number, suffix = '') => value === undefined ? 'Unavailable' : `${value.toFixed(1)}${suffix}`;

export function LolPlayerCard({ data, assets = {} }: { data: LolPlayerCardData; assets?: LolCardAssets }) {
  const player = data.player;
  return (
    <div style={commonRoot}>
      <ReportHeader title="PLAYER DETAIL" riotId={data.riotId} platform={data.platform} right={`match #${data.matchSuffix}`} />
      <div style={{ display: 'flex', flex: 1, padding: '28px 38px 22px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 355, paddingRight: 34, borderRight: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <AssetSquare src={asset(assets, 'champion', player.championId)} label={assetLabel(assets, 'champion', player.championId, player.championName)} kind="champion" assetId={player.championId} size={86} />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, marginLeft: 15 }}>
              <strong style={{ color: TEXT, fontSize: 26 }}>{compact(player.riotId, 22)}</strong>
              <span style={{ color: CYAN, fontSize: 14, fontWeight: 700, marginTop: 5 }}>{compact(player.championName, 21)}</span>
              <span style={{ color: SECONDARY, fontSize: 11, marginTop: 5 }}>{`${player.role === 'unknown' ? 'Role unknown' : player.role.toUpperCase()} · level ${player.level}`}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 25, color: resultTone(data.result), fontSize: 17, fontWeight: 700 }}>
            {resultLabel(data.result)}
            <span style={{ marginLeft: 'auto', color: SECONDARY, fontSize: 11, fontWeight: 600 }}>{`${formatDuration(data.durationSeconds)} · ${compact(data.queueLabel, 19)}`}</span>
          </div>
          <div style={{ display: 'flex', marginTop: 15, gap: 6 }}>
            {player.summonerSpellIds.slice(0, 2).map((spellId) => <AssetSquare key={spellId} src={asset(assets, 'spell', String(spellId))} label={assetLabel(assets, 'spell', spellId, `summoner spell ${spellId}`)} kind="spell" assetId={spellId} size={35} />)}
            {player.runeIds[0] !== undefined ? <AssetSquare src={asset(assets, 'rune', String(player.runeIds[0]))} label={assetLabel(assets, 'rune', player.runeIds[0], `rune ${player.runeIds[0]}`)} kind="rune" assetId={player.runeIds[0]} size={35} tone={SECONDARY} /> : <AssetSquare label="rune unavailable" kind="rune" size={35} tone={MUTED} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 29 }}>
            <span style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}>ITEMS + TRINKET</span>
            <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
              {player.items.slice(0, 7).map((slot, index) => <AssetSquare key={`${slot.itemId || 'empty'}-${index}`} src={asset(assets, 'item', slot.itemId)} label={slot.itemName || (slot.itemId ? `item ${slot.itemId}` : 'empty item slot')} kind="item" assetId={slot.itemId} size={35} tone={MUTED} />)}
            </div>
          </div>
          {data.purchaseOrder?.length ? <div style={{ display: 'flex', flexDirection: 'column', marginTop: 23 }}><span style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}>TIMELINE PURCHASE ORDER · DERIVED</span><span style={{ color: SECONDARY, fontSize: 11, marginTop: 6 }}>{compact(data.purchaseOrder.map(String).join(' → '), 55)}</span></div> : <div style={{ display: 'flex', color: MUTED, fontSize: 11, marginTop: 23 }}>Purchase order unavailable until Timeline is requested.</div>}
        </div>
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', marginLeft: 38 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}><span>DIRECT + DERIVED READOUT</span><span>PUBLIC MATCH DATA</span></div>
          <div style={{ display: 'flex', gap: 38, marginTop: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', width: 276 }}>
              <MetricLine label="K / D / A" value={`${player.kills} / ${player.deaths} / ${player.assists}`} />
              <MetricLine label="CS · RAW" value={`${formatNumber(player.cs)} CS`} />
              <MetricLine label="GOLD · RAW" value={`${formatNumber(player.gold)} G`} />
              <MetricLine label="DAMAGE DEALT" value={formatNumber(player.damage)} />
              <MetricLine label="DAMAGE TAKEN" value={formatNumber(player.damageTaken)} />
              <MetricLine label="VISION SCORE" value={formatNumber(player.visionScore)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', width: 276 }}>
              <MetricLine label="KILL PARTICIPATION" value={percentOrUnavailable(data.derived.killParticipation)} derived />
              <MetricLine label="CS / MIN" value={decimalOrUnavailable(data.derived.csPerMin)} derived />
              <MetricLine label="GOLD / MIN" value={decimalOrUnavailable(data.derived.goldPerMin)} derived />
              <MetricLine label="TEAM DAMAGE SHARE" value={percentOrUnavailable(data.derived.teamDamageShare)} derived />
            </div>
          </div>
        </div>
      </div>
      <Footer notice={data.notice} />
    </div>
  );
}

const eventLabel = (type: LolTimelineCardData['events'][number]['type']) => type
  .split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');

const timelineSideTone = (side: LolTimelineCardData['events'][number]['side']) => (
  side === 'blue' ? CYAN : side === 'red' ? ERROR : SECONDARY
);

const timelineSideLabel = (side: LolTimelineCardData['events'][number]['side']) => side.toUpperCase();

export function LolTimelineCard({ data }: { data: LolTimelineCardData; assets?: LolCardAssets }) {
  const maxGold = Math.max(1, ...data.leadFrames.flatMap((frame) => [frame.blueGold, frame.redGold]));
  const minGold = Math.min(0, ...data.leadFrames.flatMap((frame) => [frame.blueGold, frame.redGold]));
  const range = Math.max(1, maxGold - minGold);
  const frameWidth = Math.max(1, data.leadFrames.length - 1);
  const plotWidth = 1112;
  const plotHeight = 167;
  const plotPoint = (gold: number) => ((gold - minGold) / range) * plotHeight;
  return (
    <div style={commonRoot}>
      <ReportHeader title="MATCH TIMELINE" riotId={data.riotId} platform={data.platform} right={`match #${data.matchSuffix}`} />
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 42, padding: '0 38px', backgroundColor: SPACE, borderBottom: `1px solid ${BORDER}` }}>
        <strong style={{ display: 'flex', color: TEXT, fontSize: 14 }}>{compact(data.queueLabel, 48)}</strong>
        <span style={{ display: 'flex', marginLeft: 15, color: SECONDARY, fontSize: 11 }}>{formatDuration(data.durationSeconds)}</span>
        <span style={{ display: 'flex', marginLeft: 'auto', color: data.status === 'available' ? CYAN : WARNING, fontSize: 11, fontWeight: 700 }}>{data.status === 'available' ? 'TIMELINE LOADED ON REQUEST' : 'TIMELINE UNAVAILABLE'}</span>
      </div>
      {data.status === 'unavailable' ? (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '0 180px', textAlign: 'center', backgroundColor: SPACE }}>
          <strong style={{ color: WARNING, fontSize: 25 }}>Timeline unavailable</strong>
          <span style={{ color: SECONDARY, fontSize: 15, lineHeight: 1.4, marginTop: 10 }}>{compact(data.unavailableReason || 'The scoreboard remains available, but timeline events could not be loaded.', 145)}</span>
          <span style={{ color: MUTED, fontSize: 12, marginTop: 16 }}>No event sequence has been estimated or reconstructed.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '24px 38px 15px', backgroundColor: SPACE }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}><span>DERIVED GOLD TOTALS BY MINUTE</span><span><span style={{ color: CYAN }}>BLUE</span><span> / </span><span style={{ color: ERROR }}>RED</span></span></div>
          <div style={{ position: 'relative', display: 'flex', height: 177, marginTop: 14, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, backgroundColor: PANEL }}>
            {data.leadFrames.map((frame, index) => {
              const left = (index / frameWidth) * plotWidth;
              const blueBottom = plotPoint(frame.blueGold);
              const redBottom = plotPoint(frame.redGold);
              const next = data.leadFrames[index + 1];
              const nextLeft = next ? ((index + 1) / frameWidth) * plotWidth : 0;
              const line = (start: number, end: number, tone: string) => {
                if (!next) return null;
                const deltaX = nextLeft - left;
                const deltaY = end - start;
                const length = Math.sqrt(deltaX ** 2 + deltaY ** 2);
                const angle = -Math.atan2(deltaY, deltaX) * (180 / Math.PI);
                return <div style={{ position: 'absolute', display: 'flex', left, bottom: start - 1, width: length, height: 2, borderRadius: 1, backgroundColor: tone, transform: `rotate(${angle}deg)`, transformOrigin: 'left center' }} />;
              };
              return (
                <React.Fragment key={`${frame.minute}-${index}`}>
                  {line(blueBottom, plotPoint(next?.blueGold || 0), CYAN)}
                  {line(redBottom, plotPoint(next?.redGold || 0), ERROR)}
                  <div style={{ position: 'absolute', display: 'flex', left, bottom: blueBottom, width: 7, height: 7, marginLeft: -3, marginBottom: -3, borderRadius: 4, backgroundColor: CYAN }} />
                  <div style={{ position: 'absolute', display: 'flex', left, bottom: redBottom, width: 7, height: 7, marginLeft: -3, marginBottom: -3, borderRadius: 4, backgroundColor: ERROR }} />
                  {index % Math.ceil(Math.max(1, data.leadFrames.length / 8)) === 0 ? <span style={{ position: 'absolute', display: 'flex', left, bottom: -19, marginLeft: -7, color: MUTED, fontSize: 11 }}>{`${frame.minute}m`}</span> : null}
                </React.Fragment>
              );
            })}
            {!data.leadFrames.length ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', color: MUTED, fontSize: 13 }}>No minute frames were returned.</div> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 25, color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}><span>CONNECTED EVENT SPINE · DETERMINISTIC SUMMARIES</span><span style={{ marginLeft: 'auto' }}>{`${data.events.length} / 40 events`}</span></div>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, marginTop: 7, borderTop: `1px solid ${BORDER}` }}>
            {data.events.length ? <div style={{ position: 'absolute', display: 'flex', left: 62, top: 17, bottom: 17, width: 1, backgroundColor: BORDER }} /> : null}
            {data.events.slice(0, 5).map((event, index) => (
              <div key={`${event.timestampSeconds}-${index}`} style={{ display: 'flex', alignItems: 'center', minHeight: 35, borderBottom: `1px solid ${BORDER}` }}>
                <strong style={{ display: 'flex', width: 58, color: CYAN, fontSize: 11 }}>{formatDuration(event.timestampSeconds)}</strong>
                <span style={{ display: 'flex', alignItems: 'center', width: 135, color: timelineSideTone(event.side), fontSize: 11, fontWeight: 700 }}><span style={{ display: 'flex', width: 9, height: 9, marginRight: 8, borderRadius: 5, backgroundColor: timelineSideTone(event.side) }} />{timelineSideLabel(event.side)}</span>
                <span style={{ display: 'flex', width: 120, color: TEXT, fontSize: 12, fontWeight: 700 }}>{eventLabel(event.type)}</span>
                <span style={{ display: 'flex', color: SECONDARY, fontSize: 12 }}>{compact(event.summary, 105)}</span>
              </div>
            ))}
            {!data.events.length ? <div style={{ display: 'flex', alignItems: 'center', minHeight: 67, color: MUTED, fontSize: 13 }}>No supported events were returned for this match.</div> : null}
          </div>
        </div>
      )}
      <Footer notice={data.notice} />
    </div>
  );
}

export function LolCard({ data, assets = {} }: { data: LolCardData; assets?: LolCardAssets }) {
  switch (data.card) {
    case 'lol-profile': return <LolProfileCard data={data} assets={assets} />;
    case 'lol-history': return <LolHistoryCard data={data} assets={assets} />;
    case 'lol-match': return <LolMatchCard data={data} assets={assets} />;
    case 'lol-player': return <LolPlayerCard data={data} assets={assets} />;
    case 'lol-timeline': return <LolTimelineCard data={data} assets={assets} />;
  }
}
