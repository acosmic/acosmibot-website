import type { WowProfileCardData, WowProfileTalent } from './types';

/**
 * THESIS: A Blizzard character render becomes the subject of a legible armory
 * dossier, refusing both the generic Armory clone and the stats-over-a-face card.
 * OWN-WORLD: Observatory graphite, class atmosphere, faction signal, etched
 * rings, hard data cells, and one cyan Acosmibot signature.
 * STORY: Identity resolves first, live stats scan second, the talent build closes.
 * FIRST VIEWPORT: A 61/39 split ledger; unobstructed character at right, compact
 * identity and a 3×3 stat field at left, build band along the lower edge.
 * FORM: Approved delegated split-dossier composition A; precise extension, so
 * concept seed is intentionally N/A. Generated comp is direction, not literal UI.
 */

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 675;

const FONT_STACK = 'Urbanist, sans-serif';

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

const TALENT_COLORS = ['#9F8BFF', '#4FE3A1', '#FF9A57'];

const compact = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, Math.max(1, max - 1))}…` : value;

function TalentReadout({
  talent,
  index,
}: {
  talent: WowProfileTalent;
  index: number;
}) {
  const tone = TALENT_COLORS[index % TALENT_COLORS.length];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        width: 196,
        height: 66,
        padding: '0 16px',
        borderLeft: index === 0 ? '0px solid transparent' : '1px solid rgba(255,255,255,0.10)',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: 7,
          height: 42,
          borderRadius: 4,
          backgroundColor: tone,
          marginRight: 13,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ color: '#A9BAC7', fontSize: 14, fontWeight: 700, letterSpacing: 0.7 }}>
          {compact(talent.name.toUpperCase(), 18)}
        </div>
        <div style={{ color: tone, fontSize: 31, lineHeight: 1.05, fontWeight: 700 }}>
          {`${talent.points} POINTS`}
        </div>
      </div>
    </div>
  );
}

export function WowProfileCard({ data }: { data: WowProfileCardData }) {
  const classAccent =
    CLASS_COLORS[data.characterClass.toLowerCase()] || '#9F8BFF';
  const factionAccent = FACTION_COLORS[data.faction.toLowerCase()] || '#4A8BFF';
  const nameSize = data.characterName.length > 12 ? 52 : 66;
  const stats = (data.stats || []).slice(0, 9);
  const talents = (data.talents || []).slice(0, 3);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        overflow: 'hidden',
        color: '#F4FBFF',
        fontFamily: FONT_STACK,
        background: 'linear-gradient(135deg, #071019 0%, #0B1118 56%, #100D19 100%)',
      }}
    >
      {/* Right-hand character stage. The large transparent Blizzard canvas is
          deliberately oversized and offset so its centered subject fills this crop. */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          left: 732,
          top: 0,
          width: 468,
          height: CARD_HEIGHT,
          overflow: 'hidden',
          background: `linear-gradient(155deg, ${classAccent}24 0%, #09121B 48%, ${factionAccent}18 100%)`,
          borderLeft: '1px solid rgba(255,255,255,0.10)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            left: 54,
            top: 108,
            width: 360,
            height: 360,
            border: `1px solid ${classAccent}45`,
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            left: 101,
            top: 155,
            width: 266,
            height: 266,
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            left: 64,
            bottom: 58,
            width: 340,
            height: 40,
            borderRadius: '50%',
            background: `radial-gradient(ellipse at center, ${classAccent}32 0%, rgba(0,0,0,0) 72%)`,
          }}
        />
        {data.characterImageUrl ? (
          <img
            src={data.characterImageUrl}
            width={1360}
            height={1020}
            style={{
              position: 'absolute',
              left: -430,
              top: -180,
              width: 1360,
              height: 1020,
              objectFit: 'contain',
            }}
          />
        ) : null}
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            left: 34,
            right: 34,
            bottom: 29,
            justifyContent: 'space-between',
            color: 'rgba(244,251,255,0.54)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 1.2,
          }}
        >
          <span>{data.faction.toUpperCase()}</span>
          <span>{data.characterClass.toUpperCase()}</span>
        </div>
      </div>

      {/* Primary information ledger. */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          left: 0,
          top: 0,
          width: 732,
          height: CARD_HEIGHT,
          padding: '42px 48px 34px 52px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            color: '#8293A0',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          <span style={{ color: '#67ECFF' }}>ACOSMIBOT</span>
          <span style={{ margin: '0 10px', color: '#4B5B68' }}>//</span>
          <span>ARMORY DOSSIER</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 8 }}>
          <div
            style={{
              fontSize: nameSize,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: -1.6,
              color: '#F4FBFF',
            }}
          >
            {compact(data.characterName.toUpperCase(), 22)}
          </div>
          <div
            style={{
              marginLeft: 18,
              fontSize: 25,
              fontWeight: 700,
              letterSpacing: 1.4,
              color: classAccent,
            }}
          >
            {compact(data.realmName.toUpperCase(), 22)}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: 13,
            color: '#D9E4EA',
            fontSize: 22,
          }}
        >
          <span style={{ fontWeight: 400 }}>{`Level ${data.level} ${data.race}`}</span>
          <span style={{ marginLeft: 8, fontWeight: 700 }}>{data.characterClass}</span>
          <span style={{ margin: '0 12px', color: '#52616D' }}>·</span>
          <span style={{ color: factionAccent, fontWeight: 700 }}>{data.faction}</span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: 7,
            paddingBottom: 19,
            borderBottom: '1px solid rgba(255,255,255,0.10)',
            color: '#8293A0',
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: 0.8,
          }}
        >
          <span>{data.region.toUpperCase()}</span>
          <span style={{ margin: '0 9px', color: '#4B5B68' }}>//</span>
          <span>{compact(data.versionLabel.toUpperCase(), 42)}</span>
          {data.guildName ? (
            <span style={{ marginLeft: 'auto', color: '#A9BAC7', letterSpacing: 0 }}>
              {compact(data.guildName, 24)}
            </span>
          ) : null}
          {data.itemLevel > 0 ? (
            <span style={{ marginLeft: 15, color: '#67ECFF', letterSpacing: 0 }}>
              {`ILVL ${data.itemLevel}`}
            </span>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 18,
            color: '#71808D',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 1.5,
          }}
        >
          <span>FIELD READOUT</span>
          <span>LIVE CHARACTER PROFILE</span>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            width: 632,
            marginTop: 8,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {stats.map((stat, index) => (
            <div
              key={`${stat.label}-${index}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                width: 210,
                height: 90,
                paddingLeft: 17,
                boxSizing: 'border-box',
                borderRight: '1px solid rgba(255,255,255,0.08)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                backgroundColor: index % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.012)',
              }}
            >
              <div
                style={{
                  color: '#8293A0',
                  fontSize: 15,
                  fontWeight: 700,
                  lineHeight: 1.1,
                  letterSpacing: 0.8,
                }}
              >
                {compact(stat.label.toUpperCase(), 18)}
              </div>
              <div
                style={{
                  color: '#F4FBFF',
                  fontSize: 34,
                  fontWeight: 700,
                  lineHeight: 1.05,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            left: 52,
            bottom: 33,
            width: 632,
            height: 82,
            borderTop: `1px solid ${classAccent}70`,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: 44,
              marginRight: 4,
              color: '#71808D',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.4,
            }}
          >
            <span>BUILD</span>
            <span style={{ marginTop: 4, color: classAccent }}>ACTIVE</span>
          </div>
          {data.isRetail && data.activeSpec ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                height: 66,
                marginLeft: 18,
              }}
            >
              <div
                style={{
                  color: '#8293A0',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 1.1,
                }}
              >
                ACTIVE SPECIALIZATION
              </div>
              <div
                style={{
                  color: classAccent,
                  fontSize: 32,
                  fontWeight: 700,
                  lineHeight: 1.15,
                }}
              >
                {compact(data.activeSpec.toUpperCase(), 28)}
              </div>
            </div>
          ) : talents.length ? (
            talents.map((talent, index) => (
              <TalentReadout key={`${talent.name}-${index}`} talent={talent} index={index} />
            ))
          ) : (
            <div style={{ display: 'flex', color: '#8293A0', fontSize: 18, marginLeft: 18 }}>
              Talent data unavailable
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          display: 'flex',
          left: 0,
          top: 0,
          width: CARD_WIDTH,
          height: 1,
          background: `linear-gradient(90deg, ${factionAccent}, ${classAccent}, transparent)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          right: 28,
          top: 24,
          color: 'rgba(244,251,255,0.46)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.3,
        }}
      >
        {compact(data.footer.toUpperCase(), 48)}
      </div>
    </div>
  );
}

export default WowProfileCard;
