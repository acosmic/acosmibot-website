import type { AIStatusCardData, AIStatusUsage } from './types';

/**
 * THESIS: AI status is a portrait usage ledger framed like an Acosmibot slot
 * instrument, not a landscape dashboard of small cards.
 * OWN-WORLD: Opaque observatory black, a bundled gunmetal/cyan frame, the exact
 * Acosmibot wordmark, polar-white telemetry, and one literal status accent.
 * STORY: Recognize AI status, read every allowance immediately, then scan the
 * server's credit, ambient-chat, and personality state in one anchored band.
 * FIRST VIEWPORT: Identity and readiness lead; six label-plus-meter rows place
 * large values on one right edge; the navy status band closes against the frame.
 * FORM: Approved portrait usage ledger in Operate mode; restrained color.
 */

export const CARD_WIDTH = 1086;
export const CARD_HEIGHT = 1448;

const FONT_STACK = 'Urbanist, sans-serif';
const CONTENT_LEFT = 112;
const CONTENT_TOP = 106;
const CONTENT_WIDTH = 862;
const INNER_LEFT = 92;
const INNER_TOP = 86;
const INNER_WIDTH = 902;
const INNER_HEIGHT = 1280;
const USAGE_LEDGER_HEIGHT = 852;
const FOOTER_HEIGHT = 229;

const COLORS = {
  inner: '#050B11',
  footer: '#0A151E',
  track: '#2A3640',
  border: 'rgba(244,251,255,0.18)',
  cyan: '#00F0FF',
  cyanSoft: '#67ECFF',
  cyanDeep: '#00A0CC',
  white: '#F4FBFF',
  text: '#C8D6DE',
  muted: '#8FA0AC',
  quiet: '#667783',
  success: '#4FE3A1',
  error: '#FF6B6B',
  warning: '#FFBE5C',
} as const;

const fmt = (value: number): string => Math.max(0, value || 0).toLocaleString('en-US');

const compact = (value: string, max: number): string => {
  const text = String(value || '').trim();
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
};

function statusColor(status: AIStatusCardData['status']): string {
  if (status === 'enabled') return COLORS.success;
  if (status === 'not-configured') return COLORS.warning;
  return COLORS.error;
}

function ProgressMeter({ item }: { item: AIStatusUsage }) {
  const fraction = item.limit > 0 ? Math.min(1, Math.max(0, item.used / item.limit)) : 0;
  const overLimit = item.limit > 0 && item.used >= item.limit;
  const accent = item.locked ? COLORS.quiet : overLimit ? COLORS.warning : COLORS.cyan;
  const fillWidth = item.locked ? 0 : Math.max(item.used > 0 ? 3 : 0, Math.round(230 * fraction));

  return (
    <div
      style={{
        display: 'flex',
        width: 230,
        height: 10,
        borderRadius: 5,
        overflow: 'hidden',
        backgroundColor: COLORS.track,
      }}
    >
      <div
        style={{
          display: 'flex',
          width: fillWidth,
          height: 10,
          borderRadius: 5,
          backgroundColor: accent,
        }}
      />
    </div>
  );
}

function UsageRow({ item, height, isLast }: { item: AIStatusUsage; height: number; isLast: boolean }) {
  const usedText = fmt(item.used);
  const limitText = fmt(item.limit);
  const combinedLength = usedText.length + limitText.length;
  const valueSize = combinedLength > 16 ? 52 : combinedLength > 13 ? 62 : combinedLength > 10 ? 72 : 82;
  const limitSize = valueSize <= 52 ? 30 : valueSize <= 62 ? 34 : 39;
  const atLimit = item.limit > 0 && item.used >= item.limit;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        height,
        padding: '0 8px',
        boxSizing: 'border-box',
        borderBottom: isLast ? 'none' : `1px solid ${COLORS.border}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: 470,
          height: '100%',
          paddingBottom: 8,
        }}
      >
        <span
          style={{
            color: item.locked ? COLORS.quiet : COLORS.white,
            fontSize: 34,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: 0.2,
          }}
        >
          {compact(item.label.toUpperCase(), 24)}
        </span>
        <div style={{ display: 'flex', marginTop: 17 }}>
          <ProgressMeter item={item} />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'flex-end',
          width: 360,
          marginLeft: 'auto',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {item.locked ? (
          <span style={{ color: COLORS.quiet, fontSize: 42, fontWeight: 700 }}>PLAN LOCKED</span>
        ) : (
          <>
            <span
              style={{
                color: atLimit ? COLORS.warning : COLORS.white,
                fontSize: valueSize,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {usedText}
            </span>
            <span style={{ color: COLORS.text, fontSize: limitSize, marginLeft: 11 }}>
              {`/ ${limitText}`}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function ToggleReadout({ label, enabled }: { label: string; enabled: boolean }) {
  const color = enabled ? COLORS.success : COLORS.error;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        marginTop: 7,
        color: COLORS.white,
        fontSize: 32,
      }}
    >
      <div
        style={{
          display: 'flex',
          width: 12,
          height: 12,
          marginRight: 10,
          borderRadius: 6,
          backgroundColor: color,
        }}
      />
      <span>{label}</span>
      <span style={{ color, fontWeight: 700, marginLeft: 'auto' }}>{enabled ? 'ON' : 'OFF'}</span>
    </div>
  );
}

function StatusBand({ data }: { data: AIStatusCardData }) {
  const creditText = fmt(data.serverCredits);
  const creditSize = creditText.length > 12 ? 38 : creditText.length > 8 ? 48 : 58;
  const personality = compact(data.personalityName || 'Default', 22);
  const personalitySize = personality.length > 18 ? 29 : personality.length > 13 ? 35 : 43;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        width: INNER_WIDTH,
        height: FOOTER_HEIGHT,
        marginLeft: -20,
        marginTop: 2,
        backgroundColor: COLORS.footer,
        borderTop: `1px solid ${COLORS.cyanDeep}`,
        borderBottomLeftRadius: 9,
        borderBottomRightRadius: 9,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: '31%',
          padding: '0 28px',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ color: COLORS.muted, fontSize: 25, fontWeight: 700, letterSpacing: 1.2 }}>
          AI CREDITS
        </span>
        <span style={{ color: COLORS.white, fontSize: creditSize, fontWeight: 700, lineHeight: 1, marginTop: 12 }}>
          {creditText}
        </span>
        <span style={{ color: COLORS.text, fontSize: 24, lineHeight: 1.15, marginTop: 9 }}>
          {`${fmt(data.guildCreditImages)} server · ${fmt(data.personalCreditImages)} personal images`}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: '37%',
          padding: '0 28px',
          boxSizing: 'border-box',
          borderLeft: `1px solid ${COLORS.border}`,
          borderRight: `1px solid ${COLORS.border}`,
        }}
      >
        <span style={{ color: COLORS.muted, fontSize: 25, fontWeight: 700, letterSpacing: 1.2 }}>
          AMBIENT CHAT
        </span>
        {data.ambientAvailable ? (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
            <ToggleReadout label="Replies" enabled={data.ambientRepliesEnabled} />
            <ToggleReadout label="Memes" enabled={data.ambientImagesEnabled} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 15 }}>
            <span style={{ color: COLORS.quiet, fontSize: 30, fontWeight: 700 }}>PLAN LOCKED</span>
            <span style={{ color: COLORS.text, fontSize: 22, marginTop: 7 }}>Not included in this plan</span>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: '32%',
          padding: '0 28px',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ color: COLORS.muted, fontSize: 25, fontWeight: 700, letterSpacing: 1.2 }}>
          PERSONALITY
        </span>
        <span
          style={{
            color: COLORS.white,
            fontSize: personalitySize,
            fontWeight: 700,
            lineHeight: 1.05,
            marginTop: 15,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          {personality}
        </span>
        <span
          style={{
            color: data.personalityTemporary ? COLORS.warning : COLORS.text,
            fontSize: 24,
            marginTop: 7,
          }}
        >
          {data.personalityTemporary ? 'temporary style' : 'active style'}
        </span>
      </div>
    </div>
  );
}

function SetupRequired({ data }: { data: AIStatusCardData }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '100%',
        height: USAGE_LEDGER_HEIGHT,
        padding: '0 28px',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ color: COLORS.warning, fontSize: 28, fontWeight: 700, letterSpacing: 1.6 }}>
        SETUP REQUIRED
      </span>
      <span style={{ color: COLORS.white, fontSize: 54, fontWeight: 700, lineHeight: 1.12, marginTop: 18 }}>
        AI settings are not configured.
      </span>
      <span style={{ color: COLORS.text, fontSize: 30, lineHeight: 1.35, marginTop: 18 }}>
        {compact(data.statusDetail || 'A server manager can configure AI from the Acosmibot dashboard.', 92)}
      </span>
    </div>
  );
}

export function AIStatusCard({
  data,
  frameImageUrl,
  logoImageUrl,
}: {
  data: AIStatusCardData;
  frameImageUrl: string;
  logoImageUrl: string;
}) {
  const stateColor = statusColor(data.status);
  const usage = (data.usage || []).slice(0, 6);
  const configured = data.status !== 'not-configured' && usage.length > 0;
  const usageRowHeight = configured ? USAGE_LEDGER_HEIGHT / usage.length : USAGE_LEDGER_HEIGHT;
  const guildPlan = `${compact(data.guildName, 18)} · ${compact(data.tierName.toUpperCase(), 10)}`;
  const guildPlanSize = guildPlan.length > 28 ? 21 : guildPlan.length > 22 ? 24 : 28;
  const headerDetail =
    data.status === 'enabled' && data.monthlyReset
      ? `Monthly reset · ${compact(data.monthlyReset, 27)}`
      : compact(data.statusDetail, 35);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        overflow: 'hidden',
        backgroundColor: 'transparent',
        color: COLORS.white,
        fontFamily: FONT_STACK,
      }}
    >
      {frameImageUrl ? (
        <img
          src={frameImageUrl}
          alt=""
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          style={{ position: 'absolute', inset: 0, width: CARD_WIDTH, height: CARD_HEIGHT }}
        />
      ) : null}

      <div
        style={{
          position: 'absolute',
          display: 'flex',
          left: INNER_LEFT,
          top: INNER_TOP,
          width: INNER_WIDTH,
          height: INNER_HEIGHT,
          borderRadius: 9,
          backgroundColor: COLORS.inner,
        }}
      />

      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          left: CONTENT_LEFT,
          top: CONTENT_TOP,
          width: CONTENT_WIDTH,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          {logoImageUrl ? (
            <img
              src={logoImageUrl}
              alt="Acosmibot"
              width={455}
              height={69}
              style={{ width: 455, height: 69, objectFit: 'contain' }}
            />
          ) : (
            <span style={{ color: COLORS.cyan, fontSize: 38, fontWeight: 700 }}>ACOSMIBOT</span>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '9px 15px',
              border: `1px solid ${stateColor}`,
              borderRadius: 8,
              backgroundColor: `${stateColor}18`,
              color: stateColor,
              fontSize: data.statusLabel.length > 18 ? 17 : 20,
              fontWeight: 700,
              letterSpacing: 1.2,
            }}
          >
            {compact(data.statusLabel.toUpperCase(), 22)}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%', marginTop: 18 }}>
          <span style={{ color: COLORS.white, fontSize: 66, fontWeight: 700, lineHeight: 1, letterSpacing: -1.2 }}>
            AI STATUS
          </span>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              marginLeft: 'auto',
              paddingBottom: 2,
            }}
          >
            <span style={{ color: COLORS.cyanSoft, fontSize: guildPlanSize, fontWeight: 700 }}>{guildPlan}</span>
            <span style={{ color: COLORS.text, fontSize: 22, marginTop: 5 }}>{headerDetail}</span>
          </div>
        </div>

        <div style={{ display: 'flex', width: '100%', height: 2, backgroundColor: COLORS.cyanDeep, marginTop: 22 }} />

        {configured ? (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: USAGE_LEDGER_HEIGHT }}>
            {usage.map((item, index) => (
              <UsageRow key={item.key} item={item} height={usageRowHeight} isLast={index === usage.length - 1} />
            ))}
          </div>
        ) : (
          <SetupRequired data={data} />
        )}

        <StatusBand data={data} />
      </div>
    </div>
  );
}

export default AIStatusCard;
