import type { AIStatusCardData, AIStatusUsage } from './types';

/**
 * THESIS: AI status should read like a live observatory instrument, not a stack
 * of Discord embed fields. It refuses the generic vertical status list.
 * OWN-WORLD: Observatory black, stepped graphite, polar white, signal cyan,
 * literal state colors, fine instrument rules, and the Acosmibot rocket scene.
 * STORY: Confirm readiness, scan allowance headroom, then understand funding,
 * ambient behavior, and personality without opening another surface.
 * FIRST VIEWPORT: Identity and readiness lead; six telemetry cells form one
 * full-width ledger; funding and behavior share a final instrument band; the
 * mascot remains visible beneath the translucent information layer.
 * FORM: Established-world extension in Operate mode; restrained color strategy.
 */

export const CARD_WIDTH = 1600;
export const CARD_HEIGHT = 1000;

const FONT_STACK = 'Urbanist, sans-serif';

const COLORS = {
  void: '#05080D',
  border: 'rgba(244,251,255,0.20)',
  borderStrong: 'rgba(103,236,255,0.42)',
  cyan: '#67ECFF',
  cyanDeep: '#00A0CC',
  white: '#F4FBFF',
  text: '#C8D6DE',
  muted: '#AFC0CB',
  quiet: '#8FA0AC',
  success: '#4FE3A1',
  error: '#FF6B6B',
  warning: '#FFBE5C',
} as const;

const CONTENT_LEFT = 64;
const CONTENT_WIDTH = CARD_WIDTH - CONTENT_LEFT * 2;
const USAGE_GAP = 18;
const USAGE_CELL_WIDTH = (CONTENT_WIDTH - USAGE_GAP * 2) / 3;
const USAGE_CELL_HEIGHT = 154;
const GLASS_PANEL = 'rgba(5,8,13,0.56)';
const GLASS_PANEL_QUIET = 'rgba(5,8,13,0.48)';

const fmt = (value: number): string => Math.max(0, value || 0).toLocaleString('en-US');

const compact = (value: string, max: number): string => {
  const text = String(value || '').trim();
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
};

function statusColor(status: AIStatusCardData['status']): string {
  return status === 'enabled' ? COLORS.success : COLORS.error;
}

function UsageCell({ item, index }: { item: AIStatusUsage; index: number }) {
  const fraction = item.limit > 0 ? Math.min(1, Math.max(0, item.used / item.limit)) : 0;
  const fillWidth = `${Math.round(fraction * 100)}%`;
  const overLimit = item.limit > 0 && item.used >= item.limit;
  const accent = item.locked ? COLORS.quiet : overLimit ? COLORS.warning : COLORS.cyan;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: USAGE_CELL_WIDTH,
        height: USAGE_CELL_HEIGHT,
        padding: '20px 22px 18px',
        boxSizing: 'border-box',
        backgroundColor: index % 2 === 0 ? GLASS_PANEL : GLASS_PANEL_QUIET,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 15,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: COLORS.muted,
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: 1.8,
        }}
      >
        <span>{compact(item.label.toUpperCase(), 28)}</span>
        <span style={{ color: accent, fontSize: 14, letterSpacing: 1.4 }}>
          {item.locked ? 'PLAN LOCKED' : 'LIVE'}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          marginTop: 12,
          color: item.locked ? COLORS.quiet : COLORS.white,
        }}
      >
        <span style={{ fontSize: 35, fontWeight: 700, lineHeight: 1 }}>
          {item.locked ? '—' : fmt(item.used)}
        </span>
        <span style={{ marginLeft: 8, fontSize: 22, color: COLORS.text }}>
          {item.locked ? '' : `/ ${fmt(item.limit)}`}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 17, color: COLORS.text }}>
          {compact(item.detail, 24)}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 8,
          marginTop: 15,
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: 'rgba(244,251,255,0.14)',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: item.locked ? '0%' : fillWidth,
            height: '100%',
            borderRadius: 4,
            background: `linear-gradient(90deg, ${COLORS.cyanDeep}, ${accent})`,
          }}
        />
      </div>
    </div>
  );
}

function ToggleReadout({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        marginTop: 12,
        color: COLORS.text,
        fontSize: 21,
      }}
    >
      <div
        style={{
          display: 'flex',
          width: 12,
          height: 12,
          marginRight: 12,
          borderRadius: '50%',
          backgroundColor: enabled ? COLORS.success : COLORS.error,
          boxShadow: `0 3px 10px ${enabled ? 'rgba(79,227,161,0.28)' : 'rgba(255,107,107,0.26)'}`,
        }}
      />
      <span>{label}</span>
      <span
        style={{
          marginLeft: 'auto',
          color: enabled ? COLORS.success : COLORS.error,
          fontWeight: 700,
        }}
      >
        {enabled ? 'ON' : 'OFF'}
      </span>
    </div>
  );
}

export function AIStatusCard({
  data,
  mascotImageUrl,
}: {
  data: AIStatusCardData;
  mascotImageUrl: string;
}) {
  const stateColor = statusColor(data.status);
  const usage = (data.usage || []).slice(0, 6);
  const configured = data.status !== 'not-configured';
  const guildNameSize = data.guildName.length > 28 ? 34 : data.guildName.length > 23 ? 40 : 51;
  const personalityNameSize =
    data.personalityName.length > 21 ? 21 : data.personalityName.length > 16 ? 25 : 31;
  const serverCreditText = fmt(data.serverCredits);
  const serverCreditSize = serverCreditText.length > 10 ? 24 : serverCreditText.length > 7 ? 35 : 43;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        overflow: 'hidden',
        backgroundColor: COLORS.void,
        color: COLORS.white,
        fontFamily: FONT_STACK,
      }}
    >
      {mascotImageUrl ? (
        <img
          src={mascotImageUrl}
          alt=""
          width={1320}
          height={825}
          style={{
            position: 'absolute',
            left: 280,
            top: 110,
            width: 1320,
            height: 825,
            objectFit: 'cover',
          }}
        />
      ) : null}

      <div
        style={{
          position: 'absolute',
          display: 'flex',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(5,8,13,0.72) 0%, rgba(5,8,13,0.28) 27%, rgba(5,8,13,0.10) 64%, rgba(5,8,13,0.46) 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          left: CONTENT_LEFT,
          top: 52,
          width: CONTENT_WIDTH,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            color: COLORS.muted,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 2.4,
          }}
        >
          <span style={{ color: COLORS.cyan }}>ACOSMIBOT</span>
          <span style={{ margin: '0 12px', color: COLORS.quiet }}>//</span>
          <span>AI SYSTEM TELEMETRY</span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginTop: 14,
            paddingBottom: 22,
            borderBottom: `1px solid ${COLORS.borderStrong}`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', width: 900 }}>
            <div
              style={{
                fontSize: guildNameSize,
                lineHeight: 1.04,
                fontWeight: 700,
                letterSpacing: -1.2,
                width: 900,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {compact(data.guildName, 32)}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                marginTop: 14,
                color: COLORS.text,
                fontSize: 18,
                width: 900,
                overflow: 'hidden',
              }}
            >
              <span style={{ color: COLORS.cyan, fontWeight: 700 }}>{compact(data.tierName, 20)}</span>
              {data.accessLabel || data.accessTerm ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: 900,
                    marginTop: 6,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    fontSize: 16,
                  }}
                >
                  {data.accessLabel ? (
                    <span style={{ color: COLORS.warning }}>{compact(data.accessLabel, 28)}</span>
                  ) : null}
                  {data.accessTerm ? (
                    <span style={{ marginLeft: 10, color: COLORS.muted }}>
                      {compact(data.accessTerm, 24)}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: 470 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 15px',
                borderRadius: 8,
                border: `1px solid ${stateColor}66`,
                backgroundColor: `${stateColor}18`,
                color: stateColor,
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              <span>{compact(data.statusLabel.toUpperCase(), 28)}</span>
            </div>
            <div
              style={{
                marginTop: 10,
                color: COLORS.muted,
                fontSize: 17,
                textAlign: 'right',
              }}
            >
              {compact(data.statusDetail, 42)}
            </div>
            {data.monthlyReset ? (
              <div style={{ marginTop: 7, color: COLORS.text, fontSize: 17, textAlign: 'right' }}>
                {`Allowance reset · ${compact(data.monthlyReset, 36)}`}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {configured ? (
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            flexWrap: 'wrap',
            left: CONTENT_LEFT,
            top: 250,
            width: CONTENT_WIDTH,
            gap: USAGE_GAP,
          }}
        >
          {usage.map((item, index) => (
            <UsageCell key={item.key} item={item} index={index} />
          ))}
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            left: CONTENT_LEFT,
            top: 250,
            width: CONTENT_WIDTH,
            height: 326,
            padding: '0 46px',
            boxSizing: 'border-box',
            border: `1px solid ${COLORS.border}`,
            borderRadius: 15,
            backgroundColor: GLASS_PANEL,
          }}
        >
          <div style={{ color: COLORS.error, fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>
            SETUP REQUIRED
          </div>
          <div style={{ marginTop: 13, color: COLORS.white, fontSize: 42, fontWeight: 700 }}>
            AI settings are not configured.
          </div>
          <div style={{ marginTop: 12, width: 760, color: COLORS.text, fontSize: 22, lineHeight: 1.45 }}>
            A server manager can configure AI from the Acosmibot dashboard. The shared credit reserve remains available below.
          </div>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          display: 'flex',
          left: CONTENT_LEFT,
          top: 606,
          width: CONTENT_WIDTH,
          height: 316,
          boxSizing: 'border-box',
          border: `1px solid ${COLORS.border}`,
          borderRadius: 15,
          overflow: 'hidden',
          backgroundColor: GLASS_PANEL_QUIET,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 500,
            padding: '32px 36px',
            boxSizing: 'border-box',
            borderRight: `1px solid ${COLORS.border}`,
          }}
        >
          <span style={{ color: COLORS.cyan, fontSize: 17, fontWeight: 700, letterSpacing: 1.9 }}>
            AI CREDIT RESERVE
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', width: 428, marginTop: 18, overflow: 'hidden' }}>
            <span style={{ color: COLORS.white, fontSize: serverCreditSize, fontWeight: 700 }}>
              {serverCreditText}
            </span>
          </div>
          <span style={{ marginTop: 4, color: COLORS.text, fontSize: 20 }}>Server pool</span>
          <div style={{ display: 'flex', marginTop: 27, color: COLORS.text, fontSize: 18 }}>
            <span>{`Server-paid images  ${fmt(data.guildCreditImages)}`}</span>
          </div>
          <div style={{ display: 'flex', marginTop: 10, color: COLORS.text, fontSize: 18 }}>
            <span>{`Personal-paid images  ${fmt(data.personalCreditImages)}`}</span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 412,
            padding: '32px 36px',
            boxSizing: 'border-box',
            borderRight: `1px solid ${COLORS.border}`,
          }}
        >
          <span style={{ color: COLORS.cyan, fontSize: 17, fontWeight: 700, letterSpacing: 1.9 }}>
            AMBIENT CHAT
          </span>
          {data.ambientAvailable ? (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
              <ToggleReadout label="Replies" enabled={data.ambientRepliesEnabled} />
              <ToggleReadout label="Meme images" enabled={data.ambientImagesEnabled} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 18 }}>
              <span style={{ color: COLORS.quiet, fontSize: 27, fontWeight: 700 }}>PLAN LOCKED</span>
              <span style={{ marginTop: 8, color: COLORS.text, fontSize: 19, lineHeight: 1.4 }}>
                Ambient replies are not included in this plan.
              </span>
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 558,
            padding: '32px 36px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: COLORS.cyan, fontSize: 17, fontWeight: 700, letterSpacing: 1.9 }}>
              ACTIVE PERSONALITY
            </span>
            {data.personalityTemporary ? (
              <span style={{ color: COLORS.warning, fontSize: 15, fontWeight: 700 }}>TEMPORARY</span>
            ) : null}
          </div>
          <span
            style={{
              marginTop: 16,
              width: 488,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              color: COLORS.white,
              fontSize: personalityNameSize,
              fontWeight: 700,
            }}
          >
            {compact(data.personalityName || 'Default', 26)}
          </span>
          {data.personalityTraits ? (
            <span style={{ marginTop: 12, color: COLORS.text, fontSize: 19, lineHeight: 1.4 }}>
              {compact(data.personalityTraits, 82)}
            </span>
          ) : null}
          {data.customPersonalityLocked ? (
            <span style={{ marginTop: 'auto', color: COLORS.muted, fontSize: 17 }}>
              Custom personalities are not included in this plan.
            </span>
          ) : null}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          left: CONTENT_LEFT,
          bottom: 38,
          width: CONTENT_WIDTH,
          color: COLORS.muted,
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: 1.2,
        }}
      >
        <span>DAILY CHAT RESETS AT 00:00 UTC</span>
        <span style={{ margin: '0 12px', color: COLORS.quiet }}>//</span>
        <span>MEDIA AND SUMMARIES RESET MONTHLY</span>
      </div>
    </div>
  );
}

export default AIStatusCard;
