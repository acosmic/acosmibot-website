import type { WowTalentEntry, WowTalentSection, WowTalentsCardData } from './types';
import {
  ACOSMIBOT_CYAN,
  ARMORY_GOLD,
  ARMORY_GREEN,
  ARMORY_GREY,
  WOW_FONT_STACK,
  classColor,
  compact,
} from './wowTheme';

/**
 * THESIS: The Talents page mirrors the Armory's specialization window: an
 * "Active Specialization" header with the spec icon and points spent, then
 * each tree as a titled, ruled section of icon + gold talent name + rank rows.
 * OWN-WORLD: Owner-directed (2026-11-10) close match to the official modal on
 * its dark panel, under an Acosmibot header. Spell and spec icons are Blizzard
 * Game Data API media; Classic products expose none, so their talents draw a
 * lettered placeholder tile instead of Armory site art.
 * The card grows with the build: Retail loadouts list ~80 talents across spec,
 * hero, and class groups, so column count and row size step down as it grows.
 */

export const CARD_WIDTH = 1200;
export const MIN_CARD_HEIGHT = 675;
export const MAX_CARD_HEIGHT = 2000;

const PANEL_INSET = 24;
const CONTENT_LEFT = 80;
const CONTENT_WIDTH = CARD_WIDTH - CONTENT_LEFT * 2;
const HEADER_TOP = 68;
const SECTIONS_TOP = HEADER_TOP + 96 + 42;
const SECTION_HEAD = 58;
const SECTION_GAP = 26;
const FOOTER_SPACE = 64;

interface Density {
  columns: number;
  rowHeight: number;
  icon: number;
  nameSize: number;
  rankSize: number;
}

export function talentDensity(data: Pick<WowTalentsCardData, 'sections'>): Density {
  const total = data.sections.reduce((sum, section) => sum + section.talents.length, 0);
  if (total <= 30) return { columns: 2, rowHeight: 62, icon: 46, nameSize: 21, rankSize: 19 };
  if (total <= 60) return { columns: 3, rowHeight: 54, icon: 40, nameSize: 18, rankSize: 16 };
  return { columns: 4, rowHeight: 48, icon: 36, nameSize: 16, rankSize: 14 };
}

const sectionRows = (section: WowTalentSection, columns: number): number =>
  Math.max(1, Math.ceil(section.talents.length / columns));

export function talentCardHeight(data: Pick<WowTalentsCardData, 'sections'>): number {
  const density = talentDensity(data);
  const sections = data.sections.reduce(
    (sum, section) =>
      sum + SECTION_HEAD + sectionRows(section, density.columns) * density.rowHeight + SECTION_GAP,
    0,
  );
  const height = SECTIONS_TOP + sections + FOOTER_SPACE + PANEL_INSET;
  return Math.min(MAX_CARD_HEIGHT, Math.max(MIN_CARD_HEIGHT, Math.ceil(height)));
}

function IconTile({
  url,
  size,
  letter,
}: {
  url: string;
  size: number;
  letter: string;
}) {
  if (url) {
    return (
      <div
        style={{
          display: 'flex',
          width: size,
          height: size,
          flexShrink: 0,
          boxSizing: 'border-box',
          border: '1px solid #5A5A5A',
        }}
      >
        <img src={url} width={size - 2} height={size - 2} style={{ width: size - 2, height: size - 2 }} />
      </div>
    );
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        boxSizing: 'border-box',
        border: '1px solid #4A4A4A',
        background: 'linear-gradient(145deg, #2C2924 0%, #1B1A18 100%)',
        color: '#9A8656',
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
      }}
    >
      {letter}
    </div>
  );
}

function TalentCell({
  talent,
  density,
  width,
}: {
  talent: WowTalentEntry;
  density: Density;
  width: number;
}) {
  // Dense Retail layouts abbreviate the rank so names keep their room.
  const dense = density.columns >= 4;
  const rankText = talent.rank > 1 ? (dense ? `×${talent.rank}` : `Rank ${talent.rank}`) : '';
  const rankWidth = rankText ? density.rankSize * (dense ? 1.8 : 4.2) : 0;
  const nameWidth = width - density.icon - 14 - rankWidth - 8;
  const maxChars = Math.max(8, Math.floor(nameWidth / (density.nameSize * 0.47)));
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        width,
        height: density.rowHeight,
      }}
    >
      <IconTile
        url={talent.iconUrl}
        size={density.icon}
        letter={talent.name.slice(0, 1).toUpperCase()}
      />
      <div
        style={{
          display: 'flex',
          flexGrow: 1,
          marginLeft: 14,
          color: ARMORY_GOLD,
          fontSize: density.nameSize,
          lineHeight: 1.1,
        }}
      >
        {compact(talent.name, maxChars)}
      </div>
      {rankText ? (
        <div
          style={{
            display: 'flex',
            flexShrink: 0,
            marginLeft: 8,
            color: ARMORY_GREY,
            fontSize: density.rankSize,
          }}
        >
          {rankText}
        </div>
      ) : null}
    </div>
  );
}

function Section({ section, density }: { section: WowTalentSection; density: Density }) {
  const { columns } = density;
  const gap = 56;
  const columnWidth = Math.floor((CONTENT_WIDTH - gap * (columns - 1)) / columns);
  const rows = sectionRows(section, columns);
  const columnItems = Array.from({ length: columns }, (_, column) =>
    section.talents.slice(column * rows, column * rows + rows),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: CONTENT_WIDTH, marginBottom: SECTION_GAP }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          height: 42,
          paddingBottom: 10,
          boxSizing: 'border-box',
          borderBottom: '1px solid #5A5A5A',
        }}
      >
        <div style={{ display: 'flex', color: '#FFFFFF', fontSize: 28 }}>
          {compact(section.title, 40)}
        </div>
        <div style={{ display: 'flex', color: ARMORY_GREY, fontSize: 17 }}>
          {`${section.points} ${section.points === 1 ? 'point' : 'points'}`}
        </div>
      </div>
      <div style={{ display: 'flex', marginTop: SECTION_HEAD - 42 }}>
        {columnItems.map((items, column) => (
          <div
            key={column}
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: columnWidth,
              marginLeft: column === 0 ? 0 : gap / 2,
              paddingLeft: column === 0 ? 0 : gap / 2,
              borderLeft: column === 0 ? '0px solid transparent' : '1px dashed #444444',
              height: rows * density.rowHeight,
            }}
          >
            {items.map((talent, index) => (
              <TalentCell
                key={`${talent.name}-${index}`}
                talent={talent}
                density={density}
                width={columnWidth}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function WowTalentsCard({ data }: { data: WowTalentsCardData }) {
  const height = talentCardHeight(data);
  const density = talentDensity(data);
  const accent = classColor(data.characterClass);
  const identity = `${data.level} ${data.race} ${data.characterClass}`.trim();
  const pointsLine = data.heroTree
    ? `${data.pointsSpent} Points Spent · ${data.heroTree}`
    : `${data.pointsSpent} Points Spent`;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: CARD_WIDTH,
        height,
        overflow: 'hidden',
        color: '#FFFFFF',
        fontFamily: WOW_FONT_STACK,
        backgroundColor: '#0B0A09',
      }}
    >
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          left: PANEL_INSET,
          top: PANEL_INSET,
          width: CARD_WIDTH - PANEL_INSET * 2,
          height: height - PANEL_INSET * 2,
          boxSizing: 'border-box',
          border: '1px solid #3C3C3C',
          backgroundColor: '#1A1A1A',
        }}
      />

      {/* Active specialization header, as in the Armory window. */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          left: CONTENT_LEFT,
          top: HEADER_TOP,
          height: 96,
        }}
      >
        <IconTile url={data.specIconUrl} size={92} letter={data.specName.slice(0, 1).toUpperCase()} />
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 20 }}>
          <div style={{ display: 'flex', color: ARMORY_GREEN, fontSize: 20 }}>ACTIVE SPECIALIZATION</div>
          <div style={{ display: 'flex', color: '#FFFFFF', fontSize: 38, lineHeight: 1.15 }}>
            {compact(data.specName || 'Unknown', 28)}
          </div>
          <div style={{ display: 'flex', color: '#FFFFFF', fontSize: 21 }}>
            {compact(pointsLine, 48)}
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          right: CONTENT_LEFT,
          top: HEADER_TOP + 6,
        }}
      >
        <div style={{ display: 'flex', fontSize: 13, fontWeight: 700, letterSpacing: 1.8 }}>
          <span style={{ color: ACOSMIBOT_CYAN }}>ACOSMIBOT</span>
          <span style={{ color: '#5E5A55', margin: '0 9px' }}>//</span>
          <span style={{ color: ARMORY_GOLD }}>TALENTS</span>
        </div>
        <div style={{ display: 'flex', marginTop: 12, color: accent, fontSize: 26, fontWeight: 700 }}>
          {compact(data.characterName, 26)}
        </div>
        <div style={{ display: 'flex', marginTop: 4, color: ARMORY_GREY, fontSize: 15 }}>
          {compact(
            [identity, data.realmName].filter(Boolean).join(' · '),
            48,
          )}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 4,
            color: '#8A847C',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.3,
          }}
        >
          {`${data.region.toUpperCase()} // ${compact(data.versionLabel.toUpperCase(), 40)}`}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          left: CONTENT_LEFT,
          top: SECTIONS_TOP,
          width: CONTENT_WIDTH,
        }}
      >
        {data.sections.map((section, index) => (
          <Section key={`${section.title}-${index}`} section={section} density={density} />
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          display: 'flex',
          right: CONTENT_LEFT,
          bottom: PANEL_INSET + 22,
          color: 'rgba(255,255,255,0.40)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.3,
        }}
      >
        {compact(data.footer.toUpperCase(), 60)}
      </div>
    </div>
  );
}

export default WowTalentsCard;
