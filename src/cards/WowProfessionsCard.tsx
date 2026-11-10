import type { WowProfessionEntry, WowProfessionsCardData } from './types';
import {
  ACOSMIBOT_CYAN,
  ARMORY_GOLD,
  ARMORY_GREY,
  EMBER_BACKGROUND,
  WOW_FONT_STACK,
  classColor,
  compact,
  factionColor,
} from './wowTheme';

/**
 * THESIS: Professions read as a skill ledger: each profession's icon, name,
 * current expansion tier, and a gold skill bar with its level out of the cap.
 * OWN-WORLD: The gear card's ember backdrop and Armory gold under the
 * Acosmibot header, primary and secondary professions in two columns. Icons
 * are Blizzard Game Data API profession media.
 */

export const CARD_WIDTH = 1200;
export const MIN_CARD_HEIGHT = 420;

const COLUMN_TOP = 158;
const COLUMN_LABEL = 30;
const FOOTER_SPACE = 64;

const SIDE = 44;
const COLUMN_WIDTH = 530;
const ROW_HEIGHT = 84;
const ICON = 60;
const BAR_WIDTH = COLUMN_WIDTH - ICON - 20 - 10;

/** The card is only as tall as its longer column. */
export function professionsCardHeight(
  data: Pick<WowProfessionsCardData, 'primaries' | 'secondaries'>,
): number {
  const rows = Math.max(1, data.primaries.length, data.secondaries.length);
  return Math.max(MIN_CARD_HEIGHT, COLUMN_TOP + COLUMN_LABEL + rows * ROW_HEIGHT + FOOTER_SPACE);
}

function ProfessionRow({ profession }: { profession: WowProfessionEntry }) {
  const ratio = profession.maxSkill > 0
    ? Math.max(0, Math.min(1, profession.skill / profession.maxSkill))
    : 0;
  const skillText = profession.maxSkill > 0
    ? `${profession.skill} / ${profession.maxSkill}`
    : `${profession.skill}`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: ROW_HEIGHT }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: ICON,
          height: ICON,
          flexShrink: 0,
          boxSizing: 'border-box',
          border: '2px solid #7A6236',
          backgroundColor: '#14100C',
          color: '#9A8656',
          fontSize: 26,
          fontWeight: 700,
        }}
      >
        {profession.iconUrl ? (
          <img
            src={profession.iconUrl}
            width={ICON - 4}
            height={ICON - 4}
            style={{ width: ICON - 4, height: ICON - 4 }}
          />
        ) : (
          profession.name.slice(0, 1).toUpperCase()
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 20, width: BAR_WIDTH }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ color: '#FFFFFF', fontSize: 23, fontWeight: 700 }}>
              {compact(profession.name, 22)}
            </span>
            {profession.tier ? (
              <span style={{ color: ARMORY_GREY, fontSize: 14, marginLeft: 10 }}>
                {compact(profession.tier, 30)}
              </span>
            ) : null}
          </div>
          <span style={{ color: ARMORY_GOLD, fontSize: 18, fontWeight: 700 }}>{skillText}</span>
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 9,
            width: BAR_WIDTH,
            height: 10,
            borderRadius: 5,
            backgroundColor: 'rgba(255,255,255,0.10)',
          }}
        >
          {ratio > 0 ? (
            <div
              style={{
                display: 'flex',
                width: Math.max(10, Math.round(BAR_WIDTH * ratio)),
                height: 10,
                borderRadius: 5,
                background: 'linear-gradient(90deg, #B07A12 0%, #F8B400 100%)',
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Column({
  title,
  professions,
  left,
}: {
  title: string;
  professions: WowProfessionEntry[];
  left: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        display: 'flex',
        flexDirection: 'column',
        left,
        top: COLUMN_TOP,
        width: COLUMN_WIDTH,
      }}
    >
      <div
        style={{
          display: 'flex',
          color: ARMORY_GOLD,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: 2,
          height: COLUMN_LABEL - 8,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {professions.length ? (
        professions.map((profession, index) => (
          <ProfessionRow key={`${profession.name}-${index}`} profession={profession} />
        ))
      ) : (
        <div style={{ display: 'flex', color: ARMORY_GREY, fontSize: 18, marginTop: 12 }}>
          None learned
        </div>
      )}
    </div>
  );
}

export function WowProfessionsCard({ data }: { data: WowProfessionsCardData }) {
  const height = professionsCardHeight(data);
  const accent = classColor(data.characterClass);
  const faction = factionColor(data.faction);
  const identity = `${data.level} ${data.race} ${data.characterClass}`.trim();

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
        background: EMBER_BACKGROUND,
      }}
    >
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          left: 0,
          top: 0,
          width: CARD_WIDTH,
          height: 260,
          background: `linear-gradient(180deg, ${faction}14 0%, rgba(0,0,0,0) 100%)`,
        }}
      />

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
            backgroundColor: faction,
            marginRight: 20,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', color: accent, fontSize: 50, fontWeight: 700, lineHeight: 1 }}>
            {compact(data.characterName, 24)}
          </div>
          <div style={{ display: 'flex', marginTop: 8, color: '#FFFFFF', fontSize: 17 }}>
            {compact([identity, data.realmName].filter(Boolean).join(' · '), 60)}
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
          <span style={{ color: ACOSMIBOT_CYAN }}>ACOSMIBOT</span>
          <span style={{ color: '#6B5A4E', margin: '0 9px' }}>//</span>
          <span style={{ color: ARMORY_GOLD }}>PROFESSIONS</span>
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

      <Column title="PRIMARY" professions={data.primaries} left={SIDE} />
      <Column
        title="SECONDARY"
        professions={data.secondaries}
        left={CARD_WIDTH - SIDE - COLUMN_WIDTH}
      />

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

export default WowProfessionsCard;
