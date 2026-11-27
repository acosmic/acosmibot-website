import React, { useEffect, useState } from 'react';
import type { StreamAlertAsset, StreamAlertDesign, StreamAlertDesignText, StreamAlertType } from '@/api/streamAlerts';
import {
  alertLength,
  defaultText,
  fieldTextIndex,
  formatLength,
  MAX_TEXTS,
  newDesign,
} from '@/utils/streamAlertDesigns';
import { DesignStage, BOX_COLOURS } from './DesignStage';
import { FieldError, TextBoxProperties } from './TextBoxProperties';
import { QuickUpload } from './assetUpload';
import { useDesignFonts } from './designFonts';
import './StreamAlertDesigns.css';

/** Fields the editor has an input for. Any other design field is shown under the stage. */
const TOP_FIELDS = ['video', 'image', 'sound', 'duration_ms', 'x', 'y', 'scale', 'volume', 'texts'];
const TEXT_FIELDS = ['template', 'font', 'size', 'color', 'appear_ms', 'disappear_ms'];

/**
 * The Custom style: a video or picture from the media library, placed on the screen, with up to
 * four text boxes on it. The page owns the design and saves it with the rest of the alert; this
 * only edits it.
 */
export const CustomDesignEditor: React.FC<{
  accountId: number;
  kind: StreamAlertType;
  design: StreamAlertDesign | null;
  onChange: (next: StreamAlertDesign | null) => void;
  assets: StreamAlertAsset[];
  assetsLoading: boolean;
  fonts: string[];
  variables: string[];
  /** Sample text for each variable, as the stage fills the templates. */
  values: Record<string, string>;
  /** The problem for a design field ("texts.0.template", "video"), or null. */
  problem: (field: string) => string | null;
  /** A text box the page wants opened, such as the one a refused save is about. */
  focusText?: number | null;
}> = ({ accountId, kind, design, onChange, assets, assetsLoading, fonts, variables, values, problem, focusText }) => {
  const [selected, setSelected] = useState<number | null>(design && design.texts.length > 0 ? 0 : null);
  const [time, setTime] = useState(0);
  const [startWith, setStartWith] = useState('');
  const fontsVersion = useDesignFonts(fonts, assets);

  const readyMedia = assets.filter((asset) => asset.status === 'ready' && asset.url && (asset.kind === 'video' || asset.kind === 'image'));
  const readySounds = assets.filter((asset) => asset.status === 'ready' && asset.url && asset.kind === 'sound');
  const readyFonts = assets.filter((asset) => asset.status === 'ready' && asset.url && asset.kind === 'font');
  const mediaId = design ? design.video ?? design.image : null;
  const media = mediaId === null ? null : assets.find((asset) => asset.id === mediaId) ?? null;
  const mediaReady = media && media.status === 'ready' && media.url ? media : null;
  const length = design ? alertLength(design, design.video !== null ? media : null) : 0;

  // A new kind (or a newly loaded video) starts the scrubber in the middle, where the text usually shows.
  const lengthKey = `${kind}:${mediaId}:${length}`;
  useEffect(() => { setTime(Math.round(length / 2)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lengthKey]);
  useEffect(() => { if (focusText !== null && focusText !== undefined) setSelected(focusText); }, [focusText]);
  useEffect(() => {
    if (selected !== null && (!design || selected >= design.texts.length)) setSelected(design && design.texts.length ? design.texts.length - 1 : null);
  }, [design, selected]);

  const boxProblem = (index: number): string | null => {
    for (const field of ['x', 'y', 'w', 'h', '']) {
      const text = problem(field ? `texts.${index}.${field}` : `texts.${index}`);
      if (text) return text;
    }
    return null;
  };
  const otherProblem = ['x', 'y'].map((field) => problem(field)).find(Boolean) ?? null;

  if (!design) {
    return (
      <div className="stream-designs__builtin">
        <p><strong>No custom design yet.</strong></p>
        {readyMedia.length === 0 ? (
          <p className="stream-accounts__empty">
            {assetsLoading ? 'Loading the media library…' : 'Upload a video or a picture to start. The design opens with it when it is ready.'}
          </p>
        ) : (
          <div className="stream-designs__start">
            <label className="stream-props__field">
              <span>Start with</span>
              <select className="form-control" value={startWith || String(readyMedia[0].id)} onChange={(event) => setStartWith(event.target.value)}>
                {readyMedia.map((asset) => <option key={asset.id} value={asset.id}>{asset.original_name}</option>)}
              </select>
            </label>
            <button
              type="button"
              className="is-primary"
              onClick={() => {
                const pick = readyMedia.find((asset) => String(asset.id) === startWith) ?? readyMedia[0];
                onChange(newDesign(kind, pick));
                setSelected(0);
              }}
            >
              Make a custom design
            </button>
          </div>
        )}
        {!assetsLoading && (
          <QuickUpload accountId={accountId} assets={assets} purpose="media" onReady={(asset) => { onChange(newDesign(kind, asset)); setSelected(0); }} />
        )}
        <FieldError id="stream-design-missing" text={problem('')} />
      </div>
    );
  }

  const change = (next: StreamAlertDesign) => onChange(next);
  const changeText = (index: number, text: StreamAlertDesignText) => change({ ...design, texts: design.texts.map((item, i) => (i === index ? text : item)) });
  const pickMedia = (value: string) => {
    const asset = readyMedia.find((item) => String(item.id) === value);
    if (!asset) return;
    change({
      ...design,
      video: asset.kind === 'video' ? asset.id : null,
      image: asset.kind === 'image' ? asset.id : null,
      // A video with its own sound plays that; the extra sound is for pictures and silent videos.
      sound: asset.kind === 'video' && asset.has_audio ? null : design.sound,
    });
  };
  const addText = () => {
    if (design.texts.length >= MAX_TEXTS) return;
    const text = defaultText(kind, design.texts.length, mediaReady);
    change({ ...design, texts: [...design.texts, { ...text, appear_ms: Math.min(Math.round(time), 30000) }] });
    setSelected(design.texts.length);
  };
  const removeText = (index: number) => {
    change({ ...design, texts: design.texts.filter((_, i) => i !== index) });
    setSelected(design.texts.length > 1 ? Math.max(0, index - 1) : null);
  };

  return (
    <div className="stream-designs stream-designs__panel">
      <div className="stream-designs__media">
        <div className="stream-designs__pick">
          <label className="stream-props__field">
            <span>Video or picture</span>
            <select
              className="form-control"
              value={mediaId === null ? '' : String(mediaId)}
              aria-invalid={Boolean(problem('video') || problem('image'))}
              onChange={(event) => pickMedia(event.target.value)}
            >
              {mediaId === null && <option value="">Pick one</option>}
              {mediaId !== null && !mediaReady && <option value={String(mediaId)}>{media?.original_name ?? 'A file that is gone'} (not ready)</option>}
              {readyMedia.some((asset) => asset.kind === 'video') && (
                <optgroup label="Videos">
                  {readyMedia.filter((asset) => asset.kind === 'video').map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.original_name} ({formatLength(asset.duration_ms)})</option>
                  ))}
                </optgroup>
              )}
              {readyMedia.some((asset) => asset.kind === 'image') && (
                <optgroup label="Pictures">
                  {readyMedia.filter((asset) => asset.kind === 'image').map((asset) => <option key={asset.id} value={asset.id}>{asset.original_name}</option>)}
                </optgroup>
              )}
            </select>
            <FieldError id="stream-design-video" text={problem('video') ?? problem('image')} />
          </label>
          <QuickUpload accountId={accountId} assets={assets} purpose="media" onReady={(asset) => pickMedia(String(asset.id))} />
        </div>
        <div className="stream-designs__pick">
          <label className="stream-props__field">
            <span>Extra sound</span>
            <select
              className="form-control"
              value={design.sound === null ? '' : String(design.sound)}
              disabled={Boolean(media?.kind === 'video' && media.has_audio)}
              aria-invalid={Boolean(problem('sound'))}
              onChange={(event) => change({ ...design, sound: event.target.value ? Number(event.target.value) : null })}
            >
              <option value="">None</option>
              {readySounds.map((asset) => <option key={asset.id} value={asset.id}>{asset.original_name}</option>)}
            </select>
            {media?.kind === 'video' && media.has_audio && <small className="stream-props__hint">This video has its own sound, so it plays that.</small>}
            <FieldError id="stream-design-sound" text={problem('sound')} />
          </label>
          {!(media?.kind === 'video' && media.has_audio) && (
            <QuickUpload accountId={accountId} assets={assets} purpose="sound" onReady={(asset) => change({ ...design, sound: asset.id })} />
          )}
        </div>
        {design.video === null && (
          <label className="stream-props__field">
            <span>Shows for (seconds)</span>
            <input
              className="form-control"
              type="number"
              min={1}
              max={30}
              step={0.5}
              value={design.duration_ms / 1000}
              aria-invalid={Boolean(problem('duration_ms'))}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (event.target.value !== '' && Number.isFinite(value)) change({ ...design, duration_ms: Math.round(value * 1000) });
              }}
            />
            <FieldError id="stream-design-duration" text={problem('duration_ms')} />
          </label>
        )}
      </div>

      <div className="stream-designs__work">
        <div className="stream-designs__stage">
          <DesignStage
            design={design}
            media={mediaReady}
            length={length}
            time={time}
            onTime={setTime}
            values={values}
            selected={selected}
            onSelect={setSelected}
            onChange={change}
            fontsVersion={fontsVersion}
          />
          <FieldError id="stream-design-position" text={otherProblem} />
          <div className="stream-designs__sliders">
            <label className="stream-props__field">
              <span>Size: {Math.round(design.scale * 100)}%</span>
              <input
                type="range"
                min={10}
                max={300}
                step={5}
                value={Math.round(design.scale * 100)}
                aria-valuetext={`${Math.round(design.scale * 100)}%`}
                onChange={(event) => change({ ...design, scale: Number(event.target.value) / 100 })}
              />
              <FieldError id="stream-design-scale" text={problem('scale')} />
            </label>
            <label className="stream-props__field">
              <span>Volume: {Math.round(design.volume * 100)}%</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(design.volume * 100)}
                aria-valuetext={`${Math.round(design.volume * 100)}%`}
                onChange={(event) => change({ ...design, volume: Number(event.target.value) / 100 })}
              />
              <FieldError id="stream-design-volume" text={problem('volume')} />
            </label>
            <button type="button" onClick={() => change({ ...design, x: 960, y: 540 })}>Centre on screen</button>
          </div>
        </div>

        <div className="stream-designs__side">
          <div className="stream-designs__boxes" role="group" aria-label="Text boxes">
            {design.texts.map((_text, index) => (
              <button
                key={index}
                type="button"
                aria-pressed={selected === index}
                className={selected === index ? 'is-current' : ''}
                style={{ '--box-colour': BOX_COLOURS[index] } as React.CSSProperties}
                onClick={() => setSelected(index)}
              >
                Text {index + 1}
              </button>
            ))}
            <button type="button" disabled={design.texts.length >= MAX_TEXTS} onClick={addText}>
              {design.texts.length >= MAX_TEXTS ? 'Up to 4 texts' : 'Add text'}
            </button>
          </div>
          <FieldError id="stream-design-texts" text={problem('texts')} />
          {selected !== null && design.texts[selected] ? (
            <TextBoxProperties
              key={selected}
              index={selected}
              text={design.texts[selected]}
              kind={kind}
              variables={variables}
              fonts={fonts}
              uploadedFonts={readyFonts}
              time={time}
              length={length}
              problem={(name) => problem(`texts.${selected}.${name}`)}
              boxProblem={boxProblem(selected)}
              onChange={(next) => changeText(selected, next)}
              onRemove={() => removeText(selected)}
            />
          ) : (
            <p className="stream-accounts__empty">
              {design.texts.length === 0 ? 'No text yet. Add text to draw the viewer’s name on the alert.' : 'Pick a text box on the stage or above to change it.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

/** Which text box a design field is about, and whether the editor has an input for the field. */
export function designFieldOwner(field: string): { text: number | null; known: boolean } {
  const text = fieldTextIndex(field);
  if (text !== null) return { text, known: true };
  return { text: null, known: TOP_FIELDS.includes(field) || TEXT_FIELDS.includes(field) };
}
