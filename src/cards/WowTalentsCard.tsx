import type {
  WowTalentEntry,
  WowTalentSection,
  WowTalentTree,
  WowTalentTreeNode,
  WowTalentsCardData,
} from './types';
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
 * Classic-style products whose layout Blizzard publishes (WoW Forever) send
 * `trees` instead: every talent of each tree at its grid position, side by
 * side like the in-game talent window, with learned talents lit (gold when
 * maxed, green when partial), the rest dimmed, and prerequisite arrows. The
 * tree panels use our own tinted gradients, not Blizzard's background art.
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

export function talentCardHeight(data: Pick<WowTalentsCardData, 'sections' | 'trees'>): number {
  if (data.trees?.length) {
    const grid = treeGrid(data.trees);
    const height =
      SECTIONS_TOP + TREE_HEAD + TREE_GRID_GAP + grid.rows * grid.pitchY + TREE_BOTTOM + FOOTER_SPACE + PANEL_INSET;
    return Math.min(MAX_CARD_HEIGHT, Math.max(MIN_CARD_HEIGHT, Math.ceil(height)));
  }
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

// --- Classic-style tree grid -------------------------------------------------

const TREES_LEFT = PANEL_INSET + 16;
const TREES_WIDTH = CARD_WIDTH - TREES_LEFT * 2;
const TREE_HEAD = 64;
const TREE_GRID_GAP = 24;
const TREE_BOTTOM = 26;
const MAX_TREE_ROWS = 12;
const MAX_TREE_COLUMNS = 6;
const LIT_GOLD = '#F2C230';
const LIT_GREEN = '#3FD14A';
const ARROW_LIT = '#C9A43A';
const ARROW_DIM = '#4E4E4E';
/** Own tinted gradients per tree position (no Blizzard background art). */
const TREE_TINTS = [
  'linear-gradient(180deg, #17262C 0%, #0F1719 55%, #0C1112 100%)',
  'linear-gradient(180deg, #2B2117 0%, #18120C 55%, #110D09 100%)',
  'linear-gradient(180deg, #1D2622 0%, #111714 55%, #0D110F 100%)',
  'linear-gradient(180deg, #241B2B 0%, #150F19 55%, #100C13 100%)',
];

interface TreeGrid {
  rows: number;
  columns: number;
  panelWidth: number;
  pitchX: number;
  pitchY: number;
  icon: number;
}

export function treeGrid(trees: WowTalentTree[]): TreeGrid {
  const nodes = trees.flatMap((tree) => tree.nodes);
  const rows = Math.min(MAX_TREE_ROWS, Math.max(7, ...nodes.map((node) => node.row)));
  const columns = Math.min(MAX_TREE_COLUMNS, Math.max(4, ...nodes.map((node) => node.column)));
  const panelWidth = Math.floor(TREES_WIDTH / Math.max(1, trees.length));
  const pitchX = Math.min(84, Math.floor((panelWidth - 40) / columns));
  const icon = Math.round(pitchX * 0.66);
  const pitchY = rows > 9 ? icon + 16 : icon + 22;
  return { rows, columns, panelWidth, pitchX, pitchY, icon };
}

const nodeColor = (node: WowTalentTreeNode): string =>
  node.rank <= 0 ? '#3A3A3A' : node.rank >= node.maxRank ? LIT_GOLD : LIT_GREEN;

function TreeNode({ node, grid, left, top }: { node: WowTalentTreeNode; grid: TreeGrid; left: number; top: number }) {
  const lit = node.rank > 0;
  const color = nodeColor(node);
  const size = grid.icon;
  const inner = size - 6;
  const badge = Math.max(18, Math.round(size * 0.36));
  return (
    <div
      style={{
        position: 'absolute',
        display: 'flex',
        left,
        top,
        width: size,
        height: size,
        boxSizing: 'border-box',
        border: `3px solid ${color}`,
        borderRadius: 6,
        backgroundColor: '#0A0A0A',
      }}
    >
      {node.iconUrl ? (
        <img
          src={node.iconUrl}
          width={inner}
          height={inner}
          style={{ width: inner, height: inner, borderRadius: 3, opacity: lit ? 1 : 0.34 }}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: inner,
            height: inner,
            background: 'linear-gradient(145deg, #2C2924 0%, #1B1A18 100%)',
            color: lit ? '#C9B27A' : '#5C5548',
            fontSize: Math.round(inner * 0.44),
            fontWeight: 700,
          }}
        >
          {node.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      {lit ? null : (
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            left: 0,
            top: 0,
            width: inner,
            height: inner,
            borderRadius: 3,
            backgroundColor: 'rgba(70,70,70,0.38)',
          }}
        />
      )}
      {lit ? (
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            right: -8,
            bottom: -8,
            minWidth: badge,
            height: badge,
            padding: '0 4px',
            boxSizing: 'border-box',
            border: `1px solid ${color}`,
            borderRadius: 4,
            backgroundColor: '#0B0B0B',
            color,
            fontSize: Math.round(badge * 0.72),
            fontWeight: 700,
          }}
        >
          {String(node.rank)}
        </div>
      ) : null}
    </div>
  );
}

/** Prerequisite arrows for one tree, drawn under the icons. */
function TreeArrows({ tree, grid, gridLeft, width, height }: {
  tree: WowTalentTree;
  grid: TreeGrid;
  gridLeft: number;
  width: number;
  height: number;
}) {
  const half = grid.icon / 2;
  const x = (node: WowTalentTreeNode) => gridLeft + (node.column - 1) * grid.pitchX + half;
  const y = (node: WowTalentTreeNode) => (node.row - 1) * grid.pitchY + half;
  const paths: { d: string; head: string; lit: boolean }[] = [];
  tree.nodes.forEach((target) => {
    for (const index of target.requires) {
      const source = tree.nodes[index];
      if (!source || source === target) continue;
      const lit = source.rank >= source.maxRank && source.rank > 0;
      const tx = x(target);
      const ty = y(target);
      const sx = x(source);
      const sy = y(source);
      if (source.row === target.row) {
        const dir = tx > sx ? 1 : -1;
        const end = tx - dir * (half + 3);
        paths.push({
          d: `M ${sx + dir * half} ${sy} L ${end - dir * 6} ${ty}`,
          head: `${end},${ty} ${end - dir * 9},${ty - 6} ${end - dir * 9},${ty + 6}`,
          lit,
        });
      } else {
        const end = ty - half - 3;
        const start = sx === tx ? `M ${sx} ${sy + half}` : `M ${sx + (tx > sx ? half : -half)} ${sy} L ${tx} ${sy}`;
        paths.push({
          d: `${start} L ${tx} ${end - 6}`,
          head: `${tx},${end} ${tx - 6},${end - 9} ${tx + 6},${end - 9}`,
          lit,
        });
      }
    }
  });
  if (!paths.length) return null;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: 'absolute', left: 0, top: 0 }}
    >
      {paths.map((path, index) => (
        <path
          key={`l${index}`}
          d={path.d}
          fill="none"
          stroke={path.lit ? ARROW_LIT : ARROW_DIM}
          strokeWidth={4}
          strokeLinejoin="round"
        />
      ))}
      {paths.map((path, index) => (
        <polygon key={`h${index}`} points={path.head} fill={path.lit ? ARROW_LIT : ARROW_DIM} />
      ))}
    </svg>
  );
}

function TreePanel({ tree, index, grid, height }: {
  tree: WowTalentTree;
  index: number;
  grid: TreeGrid;
  height: number;
}) {
  const gridWidth = (grid.columns - 1) * grid.pitchX + grid.icon;
  const gridLeft = Math.floor((grid.panelWidth - gridWidth) / 2);
  const gridHeight = (grid.rows - 1) * grid.pitchY + grid.icon + 12;
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: grid.panelWidth,
        height,
        boxSizing: 'border-box',
        borderLeft: index === 0 ? '0px solid transparent' : '1px solid #6B5527',
        background: TREE_TINTS[index % TREE_TINTS.length],
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: TREE_HEAD,
          boxSizing: 'border-box',
          borderBottom: '1px solid #6B5527',
        }}
      >
        <div style={{ display: 'flex', position: 'relative', width: 40, height: 40 }}>
          {tree.iconUrl ? (
            <img src={tree.iconUrl} width={40} height={40} style={{ width: 40, height: 40, borderRadius: 20 }} />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#2A2620',
                color: '#C9B27A',
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              {tree.title.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              right: -10,
              bottom: -6,
              minWidth: 22,
              height: 18,
              padding: '0 4px',
              boxSizing: 'border-box',
              border: '1px solid #8A6D2C',
              borderRadius: 3,
              backgroundColor: '#0B0B0B',
              color: tree.points > 0 ? LIT_GOLD : ARMORY_GREY,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {String(tree.points)}
          </div>
        </div>
        <div style={{ display: 'flex', marginLeft: 20, color: '#FFFFFF', fontSize: 22 }}>
          {compact(tree.title, 20)}
        </div>
      </div>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          width: grid.panelWidth,
          height: gridHeight,
          marginTop: TREE_GRID_GAP,
        }}
      >
        <TreeArrows tree={tree} grid={grid} gridLeft={gridLeft} width={grid.panelWidth} height={gridHeight} />
        {tree.nodes.map((node, nodeIndex) =>
          node.row <= grid.rows && node.column <= grid.columns ? (
            <TreeNode
              key={`${node.row}-${node.column}-${nodeIndex}`}
              node={node}
              grid={grid}
              left={gridLeft + (node.column - 1) * grid.pitchX}
              top={(node.row - 1) * grid.pitchY}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}

function TalentTrees({ trees, cardHeight }: { trees: WowTalentTree[]; cardHeight: number }) {
  const grid = treeGrid(trees);
  const height = cardHeight - SECTIONS_TOP - FOOTER_SPACE - PANEL_INSET + 8;
  return (
    <div
      style={{
        position: 'absolute',
        display: 'flex',
        left: TREES_LEFT,
        top: SECTIONS_TOP - 10,
        width: grid.panelWidth * trees.length,
        height,
        boxSizing: 'border-box',
        border: '1px solid #6B5527',
        overflow: 'hidden',
      }}
    >
      {trees.map((tree, index) => (
        <TreePanel key={`${tree.title}-${index}`} tree={tree} index={index} grid={grid} height={height} />
      ))}
    </div>
  );
}

export function WowTalentsCard({ data }: { data: WowTalentsCardData }) {
  const height = talentCardHeight(data);
  const density = talentDensity(data);
  const accent = classColor(data.characterClass);
  const identity = `${data.level} ${data.race} ${data.characterClass}`.trim();
  const trees = data.trees?.length ? data.trees : null;
  const pointsLine = trees
    ? `${data.pointsSpent} Points Spent · ${trees.map((tree) => tree.points).join(' / ')}`
    : data.heroTree
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
          <div style={{ display: 'flex', color: ARMORY_GREEN, fontSize: 20 }}>
            {trees ? 'PRIMARY TREE' : 'ACTIVE SPECIALIZATION'}
          </div>
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

      {trees ? (
        <TalentTrees trees={trees} cardHeight={height} />
      ) : (
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
      )}

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
