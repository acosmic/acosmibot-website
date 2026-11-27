import React, { useRef } from 'react';
import type { StreamAlertAnimationNames, StreamAlertAsset, StreamAlertLook, StreamAlertType } from '@/api/streamAlerts';
import { fontCss, formatLength, insertAtCursor, MAX_TEMPLATE_LENGTH, templateProblem, uploadedFontFamily, variableLabel } from '@/utils/streamAlertDesigns';
import { hasMessage, LAYOUTS, nameLabel, STYLES } from '@/utils/streamAlertBox';
import { QuickUpload } from './assetUpload';
import { CustomDesignEditor } from './CustomDesignEditor';
import { FieldError } from './TextBoxProperties';

const seconds = (ms: number | null) => (ms === null ? '' : String(Math.round(ms / 100) / 10));
const toMs = (value: string) => {
  const number = Number(value);
  return value.trim() !== '' && Number.isFinite(number) ? Math.round(number * 1000) : null;
};
const percent = (value: number) => `${Math.round(value * 100)}%`;
const fieldId = (prefix: string, field: string) => `${prefix}-${field.replace(/[^a-z0-9]+/gi, '-')}`;

/** A titled box in the settings column. */
export const SettingsCard: React.FC<{ title: string; about?: string; children: React.ReactNode; id?: string }> = ({ title, about, children, id }) => (
  <section className="stream-box__card" aria-labelledby={id}>
    <div className="stream-box__card-head">
      <h3 id={id}>{title}</h3>
      {about && <p>{about}</p>}
    </div>
    {children}
  </section>
);

/**
 * Everything about one look: its style, and for the preset style the layout, media, text,
 * sound, animations and font. `defaults` mode is the Global editing form: only the parts
 * "Apply to all alerts" can copy.
 */
export const LookForm: React.FC<{
  accountId: number;
  idPrefix: string;
  kind: StreamAlertType;
  look: StreamAlertLook;
  onChange: (next: StreamAlertLook) => void;
  mode: 'alert' | 'defaults';
  assets: StreamAlertAsset[];
  assetsLoading: boolean;
  fonts: string[];
  variables: string[];
  names: StreamAlertAnimationNames;
  values: Record<string, string>;
  /** The problem for a field of this look ("template", "font.family", "custom.texts.0.template"), or null. */
  problem: (field: string) => string | null;
  focusText?: number | null;
}> = ({ accountId, idPrefix, kind, look, onChange, mode, assets, assetsLoading, fonts, variables, names, values, problem, focusText }) => {
  const templateInput = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<StreamAlertLook>) => onChange({ ...look, ...patch });
  const id = (field: string) => fieldId(idPrefix, field);
  const invalid = (field: string) => ({ 'aria-invalid': Boolean(problem(field)), 'aria-describedby': problem(field) ? id(field) : undefined });

  const ready = assets.filter((asset) => asset.status === 'ready' && asset.url);
  const videos = ready.filter((asset) => asset.kind === 'video');
  const pictures = ready.filter((asset) => asset.kind === 'image');
  const sounds = ready.filter((asset) => asset.kind === 'sound');
  const uploadedFonts = ready.filter((asset) => asset.kind === 'font');
  const defaults = mode === 'defaults';
  const preset = defaults || look.style === 'preset';
  const mediaId = look.media.video ?? look.media.image;
  const media = mediaId === null ? null : assets.find((asset) => asset.id === mediaId) ?? null;
  const isVideo = defaults || look.media.video !== null;
  const templateError = problem('template') ?? (look.style === 'preset' && !defaults ? templateProblem(look.template, kind, variables) : null);
  const fontKnown = fonts.includes(look.font.family) || uploadedFonts.some((asset) => `asset:${asset.id}` === look.font.family);

  const insertVariable = (name: string) => {
    const input = templateInput.current;
    const next = insertAtCursor(look.template, input?.selectionStart ?? null, input?.selectionEnd ?? null, `{${name}}`);
    set({ template: next.value });
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(next.caret, next.caret);
    });
  };

  const pickMedia = (value: string) => {
    const asset = ready.find((item) => String(item.id) === value);
    if (!asset) { set({ media: { video: null, image: null } }); return; }
    const video = asset.kind === 'video';
    set({
      media: { video: video ? asset.id : null, image: video ? null : asset.id },
      // A picture cannot set the length, so a "match the video" length becomes six seconds.
      duration_ms: !video && look.duration_ms === null ? 6000 : look.duration_ms,
    });
  };

  const animationSelect = (field: 'show' | 'hide', label: string) => (
    <label className="stream-props__field">
      <span>{label}</span>
      <select
        className="form-control"
        value={look.animation[field]}
        {...invalid(`animation.${field}`)}
        onChange={(event) => set({ animation: { ...look.animation, [field]: event.target.value } })}
      >
        {!names[field].includes(look.animation[field]) && <option value={look.animation[field]}>{nameLabel(look.animation[field])} (not available)</option>}
        {names[field].map((name) => <option key={name} value={name}>{nameLabel(name)}</option>)}
      </select>
      <FieldError id={id(`animation.${field}`)} text={problem(`animation.${field}`)} />
    </label>
  );
  const textSelect = (field: 'intro' | 'loop' | 'outro', label: string) => (
    <label className="stream-props__field">
      <span>{label}</span>
      <select
        className="form-control"
        value={look.text[field]}
        {...invalid(`text.${field}`)}
        onChange={(event) => set({ text: { ...look.text, [field]: event.target.value } })}
      >
        {!names[field].includes(look.text[field]) && <option value={look.text[field]}>{nameLabel(look.text[field])} (not available)</option>}
        {names[field].map((name) => <option key={name} value={name}>{nameLabel(name)}</option>)}
      </select>
      <FieldError id={id(`text.${field}`)} text={problem(`text.${field}`)} />
    </label>
  );
  const slider = (field: 'size' | 'volume' | 'sound_volume', label: string, min: number, max: number, step: number) => {
    const scaled = field === 'size' ? look.size : Math.round(look[field] * 100);
    return (
      <label className="stream-props__field">
        <span>{label}: {field === 'size' ? `${look.size}%` : percent(look[field])}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={scaled}
          aria-valuetext={field === 'size' ? `${look.size}%` : percent(look[field])}
          onChange={(event) => set({ [field]: field === 'size' ? Number(event.target.value) : Number(event.target.value) / 100 } as Partial<StreamAlertLook>)}
        />
        <FieldError id={id(field)} text={problem(field)} />
      </label>
    );
  };

  return (
    <div className="stream-box__form">
      {!defaults && (
        <SettingsCard title="Style" id={id('style-title')} about="How this alert is drawn on stream.">
          <div className="stream-box__choices" role="radiogroup" aria-labelledby={id('style-title')}>
            {STYLES.map((style) => (
              <label key={style.value} className={`stream-box__choice ${look.style === style.value ? 'is-current' : ''}`}>
                <input type="radio" name={id('style')} value={style.value} checked={look.style === style.value} onChange={() => set({ style: style.value })} />
                <span><strong>{style.label}</strong><small>{style.about}</small></span>
              </label>
            ))}
          </div>
          <FieldError id={id('style')} text={problem('style')} />
        </SettingsCard>
      )}

      {look.style === 'custom' && !defaults && (
        <SettingsCard title="Custom design" id={id('custom-title')} about="Drag the media and the text boxes on the screen. The text fills in with the sample values beside the preview.">
          <CustomDesignEditor
            accountId={accountId}
            kind={kind}
            design={look.custom}
            onChange={(custom) => set({ custom })}
            assets={assets}
            assetsLoading={assetsLoading}
            fonts={fonts}
            variables={variables}
            values={values}
            problem={(field) => problem(field ? `custom.${field}` : 'custom')}
            focusText={focusText}
          />
        </SettingsCard>
      )}

      {preset && (
        <SettingsCard title="Layout" id={id('layout-title')} about={defaults ? undefined : 'Where the text sits next to the video or picture.'}>
          <div className="stream-box__choices is-layouts" role="radiogroup" aria-labelledby={id('layout-title')}>
            {LAYOUTS.map((layout) => (
              <label key={layout.value} className={`stream-box__choice ${look.layout === layout.value ? 'is-current' : ''}`}>
                <input type="radio" name={id('layout')} value={layout.value} checked={look.layout === layout.value} onChange={() => set({ layout: layout.value })} />
                <span className={`stream-box__layout-icon is-${layout.value}`} aria-hidden="true"><i /><b /></span>
                <span><strong>{layout.label}</strong></span>
              </label>
            ))}
          </div>
          <FieldError id={id('layout')} text={problem('layout')} />
        </SettingsCard>
      )}

      {preset && (
        <SettingsCard title={defaults ? 'Size and volume' : 'Media'} id={id('media-title')}>
          <div className="stream-box__grid">
            {!defaults && (
              <label className="stream-props__field is-wide">
                <span>Video or picture</span>
                <select
                  className="form-control"
                  value={mediaId === null ? '' : String(mediaId)}
                  {...invalid(look.media.video !== null ? 'media.video' : 'media.image')}
                  onChange={(event) => pickMedia(event.target.value)}
                >
                  <option value="">No media, text only</option>
                  {mediaId !== null && !ready.some((asset) => asset.id === mediaId) && (
                    <option value={String(mediaId)}>{media?.original_name ?? 'A file that is gone'} (not ready)</option>
                  )}
                  {videos.length > 0 && (
                    <optgroup label="Videos">
                      {videos.map((asset) => <option key={asset.id} value={asset.id}>{asset.original_name} ({formatLength(asset.duration_ms)})</option>)}
                    </optgroup>
                  )}
                  {pictures.length > 0 && (
                    <optgroup label="Pictures">
                      {pictures.map((asset) => <option key={asset.id} value={asset.id}>{asset.original_name}</option>)}
                    </optgroup>
                  )}
                </select>
                <FieldError id={id(look.media.video !== null ? 'media.video' : 'media.image')} text={problem('media.video') ?? problem('media.image')} />
              </label>
            )}
            {!defaults && !assetsLoading && (
              <div className="is-wide">
                <QuickUpload accountId={accountId} assets={assets} purpose="media" onReady={(asset) => pickMedia(String(asset.id))} />
              </div>
            )}
            {slider('size', 'Size', 10, 200, 5)}
            {isVideo && slider('volume', 'Video volume', 0, 100, 5)}
          </div>
        </SettingsCard>
      )}

      {preset && (
        <SettingsCard title={defaults ? 'Timing' : 'Message'} id={id('message-title')}>
          {!defaults && (
            <>
              <label className="stream-props__field is-wide">
                <span>Message template</span>
                <input
                  ref={templateInput}
                  className="form-control"
                  value={look.template}
                  maxLength={MAX_TEMPLATE_LENGTH + 20}
                  aria-invalid={Boolean(templateError)}
                  aria-describedby={templateError ? id('template') : undefined}
                  onChange={(event) => set({ template: event.target.value })}
                />
              </label>
              <div className="stream-props__chips" role="group" aria-label="Add a variable where the cursor is">
                {variables.map((name) => (
                  <button
                    key={name}
                    type="button"
                    title={`Add ${variableLabel(name).toLowerCase()}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertVariable(name)}
                  >
                    {`{${name}}`}
                    <small>{variableLabel(name)}</small>
                  </button>
                ))}
              </div>
              <FieldError id={id('template')} text={templateError} />
            </>
          )}
          <div className="stream-box__grid">
            <label className="stream-props__field">
              <span>Shows for (seconds)</span>
              <input
                className="form-control"
                type="number"
                min={2}
                max={30}
                step={0.5}
                disabled={look.duration_ms === null}
                value={look.duration_ms === null ? '' : seconds(look.duration_ms)}
                {...invalid('duration_ms')}
                onChange={(event) => { const ms = toMs(event.target.value); if (ms !== null) set({ duration_ms: ms }); }}
              />
              <FieldError id={id('duration_ms')} text={problem('duration_ms')} />
            </label>
            {isVideo && (
              <label className="stream-props__check">
                <input
                  type="checkbox"
                  checked={look.duration_ms === null}
                  onChange={(event) => set({ duration_ms: event.target.checked ? null : 6000 })}
                />
                <span>Match the video&apos;s length</span>
              </label>
            )}
            <label className="stream-props__field">
              <span>Text waits (seconds)</span>
              <input
                className="form-control"
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={seconds(look.text_delay_ms)}
                {...invalid('text_delay_ms')}
                onChange={(event) => { const ms = toMs(event.target.value); if (ms !== null) set({ text_delay_ms: ms }); }}
              />
              <FieldError id={id('text_delay_ms')} text={problem('text_delay_ms')} />
            </label>
          </div>
        </SettingsCard>
      )}

      {!defaults && hasMessage(kind) && look.style !== 'custom' && (
        <label className="stream-props__check stream-box__toggle">
          <input type="checkbox" checked={look.show_message} onChange={(event) => set({ show_message: event.target.checked })} />
          <span>Show the viewer&apos;s message under the alert</span>
        </label>
      )}

      {look.style !== 'custom' && (
        <SettingsCard title="Sound" id={id('sound-title')}>
          {!defaults && (
            <div className="stream-box__grid">
              <label className="stream-props__field">
                <span>Sound</span>
                <select
                  className="form-control"
                  value={String(look.sound)}
                  {...invalid('sound')}
                  onChange={(event) => {
                    const value = event.target.value;
                    set({ sound: value === 'builtin' || value === 'none' ? value : Number(value) });
                  }}
                >
                  <option value="builtin">Acosmibot sound</option>
                  <option value="none">No sound</option>
                  {typeof look.sound === 'number' && !sounds.some((asset) => asset.id === look.sound) && (
                    <option value={String(look.sound)}>A sound that is not ready</option>
                  )}
                  {sounds.length > 0 && (
                    <optgroup label="Your sounds">
                      {sounds.map((asset) => <option key={asset.id} value={asset.id}>{asset.original_name}</option>)}
                    </optgroup>
                  )}
                </select>
                <FieldError id={id('sound')} text={problem('sound')} />
              </label>
              {!assetsLoading && (
                <div className="is-wide">
                  <QuickUpload accountId={accountId} assets={assets} purpose="sound" onReady={(asset) => set({ sound: asset.id })} />
                </div>
              )}
            </div>
          )}
          {slider('sound_volume', 'Sound volume', 0, 100, 5)}
        </SettingsCard>
      )}

      {look.style !== 'custom' && (
        <SettingsCard title="Animations" id={id('animations-title')}>
          <div className="stream-box__grid">
            {animationSelect('show', 'Comes in with')}
            {animationSelect('hide', 'Goes away with')}
            {preset && textSelect('intro', 'Text comes in with')}
            {preset && textSelect('loop', 'Letter animation')}
            {preset && textSelect('outro', 'Text goes away with')}
          </div>
        </SettingsCard>
      )}

      {preset && (
        <details className="stream-box__card stream-box__font" open={Boolean(problem('font.family') || problem('font.size') || problem('font.color') || problem('font.highlight')) || undefined}>
          <summary>Font settings</summary>
          <div className="stream-box__grid">
            <label className="stream-props__field is-wide">
              <span>Font</span>
              <select
                className="form-control"
                value={look.font.family}
                style={{ fontFamily: fontCss(look.font.family) }}
                {...invalid('font.family')}
                onChange={(event) => set({ font: { ...look.font, family: event.target.value } })}
              >
                {!fontKnown && <option value={look.font.family}>{look.font.family} (not available)</option>}
                {fonts.map((font) => <option key={font} value={font} style={{ fontFamily: fontCss(font) }}>{font}</option>)}
                {uploadedFonts.length > 0 && (
                  <optgroup label="Your fonts">
                    {uploadedFonts.map((asset) => (
                      <option key={asset.id} value={`asset:${asset.id}`} style={{ fontFamily: `"${uploadedFontFamily(asset.id)}"` }}>
                        {asset.font_family || asset.original_name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <FieldError id={id('font.family')} text={problem('font.family')} />
            </label>
            {!assetsLoading && (
              <div className="is-wide">
                <QuickUpload accountId={accountId} assets={assets} purpose="font" onReady={(asset) => set({ font: { ...look.font, family: `asset:${asset.id}` } })} />
              </div>
            )}
            <label className="stream-props__field">
              <span>Size (px)</span>
              <input
                className="form-control"
                type="number"
                min={8}
                max={400}
                step={1}
                value={look.font.size}
                {...invalid('font.size')}
                onChange={(event) => { const value = Number(event.target.value); if (event.target.value !== '' && Number.isFinite(value)) set({ font: { ...look.font, size: value } }); }}
              />
              <FieldError id={id('font.size')} text={problem('font.size')} />
            </label>
            <label className="stream-props__field">
              <span>Weight</span>
              <select className="form-control" value={look.font.weight >= 600 ? '700' : '400'} onChange={(event) => set({ font: { ...look.font, weight: Number(event.target.value) } })}>
                <option value="400">Regular</option>
                <option value="700">Bold</option>
              </select>
            </label>
            <label className="stream-props__field stream-box__colour">
              <span>Text colour</span>
              <input type="color" value={look.font.color} {...invalid('font.color')} onChange={(event) => set({ font: { ...look.font, color: event.target.value } })} />
              <FieldError id={id('font.color')} text={problem('font.color')} />
            </label>
            <label className="stream-props__field stream-box__colour">
              <span>Highlight colour</span>
              <input type="color" value={look.font.highlight} {...invalid('font.highlight')} onChange={(event) => set({ font: { ...look.font, highlight: event.target.value } })} />
              <small className="stream-props__hint">Used for the variables, such as the name.</small>
              <FieldError id={id('font.highlight')} text={problem('font.highlight')} />
            </label>
            <label className="stream-props__check">
              <input type="checkbox" checked={look.font.shadow} onChange={(event) => set({ font: { ...look.font, shadow: event.target.checked } })} />
              <span>Shadow behind the text</span>
            </label>
          </div>
        </details>
      )}
    </div>
  );
};
