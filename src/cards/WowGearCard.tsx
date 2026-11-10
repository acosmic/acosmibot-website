import type { WowGearCardData, WowGearItem, WowGearSlot } from './types';

/**
 * THESIS: The Gear page reads like Blizzard's own Armory character sheet so a
 * player recognizes it at a glance: paper-doll slot columns, quality-colored
 * icon frames and names, item level beneath, weapons along the base, and the
 * character standing in the middle.
 * OWN-WORLD: Owner-directed (2026-11-10) close match to the official Armory
 * layout and quality palette, with two deliberate departures: an Acosmibot
 * header instead of Blizzard branding or faction crests, and our own
 * ember-gradient backdrop and empty-slot tiles instead of Armory site art.
 * Item icons and the character render are Blizzard Profile/Game Data API media.
 */

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 820;

const FONT_STACK = 'Urbanist, sans-serif';

const LEFT_SLOTS: WowGearSlot[] = [
  'HEAD', 'NECK', 'SHOULDER', 'BACK', 'CHEST', 'SHIRT', 'TABARD', 'WRIST',
];
const RIGHT_SLOTS: WowGearSlot[] = [
  'HANDS', 'WAIST', 'LEGS', 'FEET', 'FINGER_1', 'FINGER_2', 'TRINKET_1', 'TRINKET_2',
];

const SLOT_LABELS: Record<WowGearSlot, string> = {
  HEAD: 'HEAD',
  NECK: 'NECK',
  SHOULDER: 'SHOULDER',
  BACK: 'BACK',
  CHEST: 'CHEST',
  SHIRT: 'SHIRT',
  TABARD: 'TABARD',
  WRIST: 'WRIST',
  HANDS: 'HANDS',
  WAIST: 'WAIST',
  LEGS: 'LEGS',
  FEET: 'FEET',
  FINGER_1: 'RING',
  FINGER_2: 'RING',
  TRINKET_1: 'TRINKET',
  TRINKET_2: 'TRINKET',
  MAIN_HAND: 'MAIN',
  OFF_HAND: 'OFF',
  RANGED: 'RANGED',
};

/** Blizzard item-quality colors as the Armory draws them on black. */
const QUALITY_COLORS: Record<string, string> = {
  POOR: '#9D9D9D',
  COMMON: '#FFFFFF',
  UNCOMMON: '#1EFF00',
  RARE: '#0080FF',
  EPIC: '#A335EE',
  LEGENDARY: '#FF8000',
  ARTIFACT: '#E6CC80',
  HEIRLOOM: '#00CCFF',
  WOW_TOKEN: '#00CCFF',
};

const CLASS_COLORS: Record<string, string> = {
  'death knight': '#C41E3A',
  'demon hunter': '#A330C9',
  druid: '#FF7C0A',
  evoker: '#33937F',
  hunter: '#AAD372',
  mage: '#3FC7EB',
  monk: '#00FF98',
  paladin: '#F48CBA',
  priest: '#F4FBFF',
  rogue: '#FFF468',
  shaman: '#0070DD',
  warlock: '#8788EE',
  warrior: '#C69B6D',
};

const FACTION_COLORS: Record<string, string> = {
  alliance: '#4A8BFF',
  horde: '#E44A4A',
};

const GOLD = '#F8B400';
const ITEM_LEVEL_GREY = '#B4B4B4';

const ICON = 56;
const ROW_TOP = 152;
const ROW_STEP = 66;
const SIDE = 44;
const WEAPON_TOP = 700;

const compact = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, Math.max(1, max - 1))}…` : value;

const qualityColor = (quality: string): string =>
  QUALITY_COLORS[quality.toUpperCase()] || '#FFFFFF';

function SlotIcon({ item, slot }: { item?: WowGearItem; slot: WowGearSlot }) {
  if (!item) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: ICON,
          height: ICON,
          boxSizing: 'border-box',
          border: '1px solid #2B2622',
          backgroundColor: 'rgba(8,6,5,0.86)',
          color: '#4A423C',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0.8,
        }}
      >
        {SLOT_LABELS[slot]}
      </div>
    );
  }
  const color = qualityColor(item.quality);
  return (
    <div
      style={{
        display: 'flex',
        width: ICON,
        height: ICON,
        boxSizing: 'border-box',
        border: `2px solid ${color}`,
        backgroundColor: '#0B0907',
      }}
    >
      {item.iconUrl ? (
        <img
          src={item.iconUrl}
          width={ICON - 4}
          height={ICON - 4}
          style={{ width: ICON - 4, height: ICON - 4 }}
        />
      ) : null}
    </div>
  );
}

function ItemText({
  item,
  align,
  maxChars,
}: {
  item: WowGearItem;
  align: 'left' | 'right' | 'center';
  maxChars: number;
}) {
  const alignItems =
    align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems,
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          color: qualityColor(item.quality),
          fontSize: 17,
          fontWeight: 700,
          lineHeight: 1.15,
        }}
      >
        {compact(item.name, maxChars)}
      </div>
      {item.itemLevel > 0 ? (
        <div style={{ color: ITEM_LEVEL_GREY, fontSize: 14, marginTop: 3 }}>
          {`${item.itemLevel}`}
        </div>
      ) : null}
    </div>
  );
}

function ColumnSlot({
  slot,
  item,
  side,
  index,
}: {
  slot: WowGearSlot;
  item?: WowGearItem;
  side: 'left' | 'right';
  index: number;
}) {
  const top = ROW_TOP + index * ROW_STEP;
  return (
    <div
      style={{
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        flexDirection: side === 'left' ? 'row' : 'row-reverse',
        top,
        // Satori rejects undefined style values, so only set the anchored edge.
        ...(side === 'left' ? { left: SIDE } : { right: SIDE }),
        width: 360,
        height: ICON,
      }}
    >
      <SlotIcon item={item} slot={slot} />
      {item ? (
        <div
          style={{
            display: 'flex',
            marginLeft: side === 'left' ? 14 : 0,
            marginRight: side === 'right' ? 14 : 0,
          }}
        >
          <ItemText item={item} align={side} maxChars={30} />
        </div>
      ) : null}
    </div>
  );
}

function WeaponRow({
  bySlot,
  showRangedSlot,
}: {
  bySlot: Map<WowGearSlot, WowGearItem>;
  showRangedSlot: boolean;
}) {
  const slots: WowGearSlot[] = showRangedSlot
    ? ['MAIN_HAND', 'OFF_HAND', 'RANGED']
    : ['MAIN_HAND', 'OFF_HAND'];
  const gap = 48;
  const rowWidth = slots.length * ICON + (slots.length - 1) * gap;
  const firstLeft = Math.round((CARD_WIDTH - rowWidth) / 2);
  const last = slots.length - 1;

  return (
    <div
      style={{
        position: 'absolute',
        display: 'flex',
        left: 0,
        top: WEAPON_TOP,
        width: CARD_WIDTH,
        height: ICON + 30,
      }}
    >
      {slots.map((slot, index) => {
        const item = bySlot.get(slot);
        const left = firstLeft + index * (ICON + gap);
        // Outer weapons put their name outside the row like the Armory; a
        // middle (off-hand) weapon in a three-slot row names itself below.
        const textSide = index === 0 ? 'left' : index === last ? 'right' : 'below';
        return (
          <div key={slot} style={{ display: 'flex' }}>
            <div
              style={{
                position: 'absolute',
                display: 'flex',
                left,
                top: 0,
              }}
            >
              <SlotIcon item={item} slot={slot} />
            </div>
            {item && textSide === 'left' ? (
              <div
                style={{
                  position: 'absolute',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  left: left - 14 - 340,
                  top: 0,
                  width: 340,
                  height: ICON,
                }}
              >
                <ItemText item={item} align="right" maxChars={34} />
              </div>
            ) : null}
            {item && textSide === 'right' ? (
              <div
                style={{
                  position: 'absolute',
                  display: 'flex',
                  left: left + ICON + 14,
                  top: 0,
                  width: 340,
                  height: ICON,
                }}
              >
                <ItemText item={item} align="left" maxChars={34} />
              </div>
            ) : null}
            {item && textSide === 'below' ? (
              <div
                style={{
                  position: 'absolute',
                  display: 'flex',
                  justifyContent: 'center',
                  left: left + ICON / 2 - 90,
                  top: ICON + 6,
                  width: 180,
                  color: qualityColor(item.quality),
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {compact(item.name, 24)}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function WowGearCard({ data }: { data: WowGearCardData }) {
  const classAccent = CLASS_COLORS[data.characterClass.toLowerCase()] || '#9F8BFF';
  const factionAccent = FACTION_COLORS[data.faction.toLowerCase()] || GOLD;
  const bySlot = new Map<WowGearSlot, WowGearItem>();
  for (const item of data.items || []) {
    if (!bySlot.has(item.slot)) bySlot.set(item.slot, item);
  }
  const nameSize = data.characterName.length > 16 ? 44 : 54;
  const identity = `${data.level} ${data.race} ${data.characterClass}`.trim();

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        overflow: 'hidden',
        color: '#FFFFFF',
        fontFamily: FONT_STACK,
        background:
          'radial-gradient(ellipse at 50% 42%, #3A1A0C 0%, #1C0B05 42%, #0A0402 72%, #050201 100%)',
      }}
    >
      {/* Faint faction wash from the top edge. */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          left: 0,
          top: 0,
          width: CARD_WIDTH,
          height: 260,
          background: `linear-gradient(180deg, ${factionAccent}14 0%, rgba(0,0,0,0) 100%)`,
        }}
      />

      {/* Ground shadow and character. */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          left: 410,
          top: 640,
          width: 380,
          height: 50,
          borderRadius: '50%',
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 72%)',
        }}
      />
      {data.characterImageUrl ? (
        <img
          src={data.characterImageUrl}
          width={1320}
          height={990}
          style={{
            position: 'absolute',
            left: -48,
            top: -112,
            width: 1320,
            height: 990,
            objectFit: 'contain',
          }}
        />
      ) : null}

      {/* Header: identity like the Armory, branded as Acosmibot. */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          left: SIDE,
          top: 34,
          height: 84,
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 6,
            height: 70,
            borderRadius: 3,
            backgroundColor: factionAccent,
            marginRight: 20,
          }}
        />
        <div
          style={{
            display: 'flex',
            color: classAccent,
            fontSize: nameSize,
            fontWeight: 700,
            letterSpacing: -0.8,
            lineHeight: 1,
          }}
        >
          {compact(data.characterName, 24)}
        </div>
        <div
          style={{
            display: 'flex',
            width: 1,
            height: 52,
            backgroundColor: 'rgba(255,255,255,0.22)',
            margin: '0 20px',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {data.itemLevel > 0 ? (
            <div style={{ display: 'flex', color: GOLD, fontSize: 24, fontWeight: 400 }}>
              {`${data.itemLevel} ILVL`}
            </div>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 4, fontSize: 17 }}>
            <span style={{ color: '#FFFFFF' }}>{identity}</span>
            {data.guildName ? (
              <span style={{ color: GOLD, marginLeft: 6 }}>
                {`<${compact(data.guildName, 28)}>`}
              </span>
            ) : null}
            {data.realmName ? (
              <span style={{ color: '#FFFFFF', marginLeft: 6 }}>
                {compact(data.realmName, 24)}
              </span>
            ) : null}
            {data.ruleset ? (
              <span style={{ color: '#FFFFFF', marginLeft: 6 }}>
                {`- ${compact(data.ruleset, 16)}`}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          right: SIDE,
          top: 44,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 1.8,
        }}
      >
        <div style={{ display: 'flex' }}>
          <span style={{ color: '#67ECFF' }}>ACOSMIBOT</span>
          <span style={{ color: '#6B5A4E', margin: '0 9px' }}>//</span>
          <span style={{ color: GOLD }}>GEAR</span>
        </div>
        <div style={{ display: 'flex', marginTop: 8, color: '#9A8B80' }}>
          {`${data.region.toUpperCase()} // ${compact(data.versionLabel.toUpperCase(), 40)}`}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          display: 'flex',
          left: SIDE,
          top: 132,
          width: CARD_WIDTH - SIDE * 2,
          height: 1,
          backgroundColor: 'rgba(248,180,0,0.22)',
        }}
      />

      {LEFT_SLOTS.map((slot, index) => (
        <ColumnSlot
          key={slot}
          slot={slot}
          item={bySlot.get(slot)}
          side="left"
          index={index}
        />
      ))}
      {RIGHT_SLOTS.map((slot, index) => (
        <ColumnSlot
          key={slot}
          slot={slot}
          item={bySlot.get(slot)}
          side="right"
          index={index}
        />
      ))}

      <WeaponRow bySlot={bySlot} showRangedSlot={data.showRangedSlot} />

      <div
        style={{
          position: 'absolute',
          display: 'flex',
          right: SIDE,
          bottom: 22,
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

export default WowGearCard;
