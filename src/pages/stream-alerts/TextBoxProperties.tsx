import React, { useRef } from 'react';
import type { StreamAlertAsset, StreamAlertDesignText, StreamAlertType } from '@/api/streamAlerts';
import {
  fontCss,
  formatLength,
  insertAtCursor,
  MAX_TEMPLATE_LENGTH,
  templateProblem,
  uploadedFontFamily,
  variableLabel,
} from '@/utils/streamAlertDesigns';
import { BOX_COLOURS } from './DesignStage';

const ENTRANCES: { value: StreamAlertDesignText['entrance']; label: string }[] = [
  { value: 'none', label: 'Appears at once' },
  { value: 'fade', label: 'Fades in' },
  { value: 'typewriter', label: 'Types in, letter by letter' },
];
const ALIGNS: { value: StreamAlertDesignText['align']; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Right' },
];

const seconds = (ms: number) => Math.round(ms / 100) / 10;
const toMs = (value: string) => {
  const number = Number(value);
  return value.trim() !== '' && Number.isFinite(number) ? Math.round(number * 1000) : null;
};

/** A field's error line, tied to its input by id. */
export const FieldError: React.FC<{ id: string; text: string | null | undefined }> = ({ id, text }) => (
  text ? <p id={id} className="stream-designs__field-error" role="alert">{text}</p> : null
);

/** Everything about the selected text box: what it says, how it looks and when it shows. */
export const TextBoxProperties: React.FC<{
  index: number;
  text: StreamAlertDesignText;
  kind: StreamAlertType;
  variables: string[];
  fonts: string[];
  uploadedFonts: StreamAlertAsset[];
  time: number;
  length: number;
  /** The error for a field of this box ("template", "font", ...), or null. */
  problem: (name: string) => string | null;
  /** An error about this box that no single input owns. */
  boxProblem: string | null;
  onChange: (next: StreamAlertDesignText) => void;
  onRemove: () => void;
}> = ({ index, text, kind, variables, fonts, uploadedFonts, time, length, problem, boxProblem, onChange, onRemove }) => {
  const templateInput = useRef<HTMLInputElement>(null);
  const id = (name: string) => `stream-text-${index}-${name}`;
  const set = (patch: Partial<StreamAlertDesignText>) => onChange({ ...text, ...patch });
  const templateError = templateProblem(text.template, kind, variables) ?? problem('template');
  const fontKnown = fonts.includes(text.font) || uploadedFonts.some((asset) => `asset:${asset.id}` === text.font);

  const insertVariable = (name: string) => {
    const input = templateInput.current;
    const next = insertAtCursor(text.template, input?.selectionStart ?? null, input?.selectionEnd ?? null, `{${name}}`);
    set({ template: next.value });
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(next.caret, next.caret);
    });
  };
  const describedBy = (name: string, error: string | null | undefined) => (error ? id(name) : undefined);

  return (
    <div className="stream-props" style={{ '--box-colour': BOX_COLOURS[index] } as React.CSSProperties}>
      <div className="stream-props__head">
        <strong>Text {index + 1}</strong>
        <button type="button" onClick={onRemove}>Remove text {index + 1}</button>
      </div>
      <FieldError id={id('box')} text={boxProblem} />

      <label className="stream-props__field is-wide">
        <span>Text</span>
        <input
          ref={templateInput}
          className="form-control"
          value={text.template}
          maxLength={MAX_TEMPLATE_LENGTH + 20}
          aria-invalid={Boolean(templateError)}
          aria-describedby={describedBy('template', templateError)}
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

      <div className="stream-props__grid">
        <label className="stream-props__field is-wide">
          <span>Font</span>
          <select
            className="form-control"
            value={text.font}
            style={{ fontFamily: fontCss(text.font) }}
            aria-invalid={Boolean(problem('font'))}
            aria-describedby={describedBy('font', problem('font'))}
            onChange={(event) => set({ font: event.target.value })}
          >
            {!fontKnown && <option value={text.font}>{text.font} (not available)</option>}
            {fonts.map((font) => <option key={font} value={font} style={{ fontFamily: fontCss(font) }}>{font}</option>)}
            {uploadedFonts.length > 0 && (
              <optgroup label="Your fonts">
                {uploadedFonts.map((asset) => (
                  <option key={asset.id} value={`asset:${asset.id}`} style={{ fontFamily: `"${uploadedFontFamily(asset.id)}", sans-serif` }}>
                    {asset.font_family || asset.original_name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <FieldError id={id('font')} text={problem('font')} />

        <label className="stream-props__field">
          <span>Size (px)</span>
          <input
            className="form-control"
            type="number"
            inputMode="numeric"
            min={8}
            max={400}
            step={1}
            value={text.size}
            aria-invalid={Boolean(problem('size'))}
            aria-describedby={describedBy('size', problem('size'))}
            onChange={(event) => {
              const size = Math.round(Number(event.target.value));
              if (event.target.value !== '' && Number.isFinite(size)) set({ size });
            }}
          />
        </label>
        <label className="stream-props__field">
          <span>Colour</span>
          <span className="stream-props__colour">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(text.color) ? text.color : '#ffffff'} aria-label="Pick a colour" onChange={(event) => set({ color: event.target.value })} />
            <input
              className="form-control"
              value={text.color}
              maxLength={7}
              aria-label="Colour code"
              aria-invalid={Boolean(problem('color'))}
              aria-describedby={describedBy('color', problem('color'))}
              onChange={(event) => set({ color: event.target.value.trim() })}
            />
          </span>
        </label>
        <FieldError id={id('size')} text={problem('size')} />
        <FieldError id={id('color')} text={problem('color')} />
      </div>

      <div className="stream-props__toggles" role="group" aria-label="Text style">
        <button type="button" aria-pressed={text.weight === 700} className={text.weight === 700 ? 'is-current' : ''} onClick={() => set({ weight: text.weight === 700 ? 400 : 700 })}>
          <b>Bold</b>
        </button>
        <button type="button" aria-pressed={text.italic} className={text.italic ? 'is-current' : ''} onClick={() => set({ italic: !text.italic })}>
          <i>Italic</i>
        </button>
        <button type="button" aria-pressed={text.shadow} className={text.shadow ? 'is-current' : ''} onClick={() => set({ shadow: !text.shadow })}>
          Shadow
        </button>
      </div>
      <div className="stream-props__toggles" role="group" aria-label="Alignment">
        {ALIGNS.map((align) => (
          <button key={align.value} type="button" aria-pressed={text.align === align.value} className={text.align === align.value ? 'is-current' : ''} onClick={() => set({ align: align.value })}>
            {align.label}
          </button>
        ))}
      </div>
      <label className="stream-props__check">
        <input type="checkbox" checked={text.fit === 'shrink'} onChange={(event) => set({ fit: event.target.checked ? 'shrink' : 'none' })} />
        <span>Make long text smaller so it fits the box</span>
      </label>

      <div className="stream-props__times">
        <div className="stream-props__time">
          <label className="stream-props__field">
            <span>Appears at (seconds)</span>
            <input
              className="form-control"
              type="number"
              min={0}
              max={30}
              step={0.1}
              value={seconds(text.appear_ms)}
              aria-invalid={Boolean(problem('appear_ms'))}
              aria-describedby={describedBy('appear_ms', problem('appear_ms'))}
              onChange={(event) => { const ms = toMs(event.target.value); if (ms !== null) set({ appear_ms: ms }); }}
            />
          </label>
          <button type="button" onClick={() => set({ appear_ms: Math.round(time) })}>Appear at {formatLength(time)}</button>
          <FieldError id={id('appear_ms')} text={problem('appear_ms')} />
        </div>
        <div className="stream-props__time">
          <label className="stream-props__field">
            <span>Disappears at (seconds)</span>
            <input
              className="form-control"
              type="number"
              min={0}
              max={30}
              step={0.1}
              disabled={text.disappear_ms === null}
              value={text.disappear_ms === null ? '' : seconds(text.disappear_ms)}
              placeholder="At the end"
              aria-invalid={Boolean(problem('disappear_ms'))}
              aria-describedby={describedBy('disappear_ms', problem('disappear_ms'))}
              onChange={(event) => { const ms = toMs(event.target.value); if (ms !== null) set({ disappear_ms: ms }); }}
            />
          </label>
          <button type="button" onClick={() => set({ disappear_ms: Math.round(time) })}>Disappear at {formatLength(time)}</button>
          <label className="stream-props__check">
            <input
              type="checkbox"
              checked={text.disappear_ms === null}
              onChange={(event) => set({ disappear_ms: event.target.checked ? null : Math.max(text.appear_ms + 500, Math.min(length, 30000)) })}
            />
            <span>Stays until the alert ends</span>
          </label>
          <FieldError id={id('disappear_ms')} text={problem('disappear_ms')} />
        </div>
      </div>

      <label className="stream-props__field">
        <span>How it appears</span>
        <select className="form-control" value={text.entrance} onChange={(event) => set({ entrance: event.target.value as StreamAlertDesignText['entrance'] })}>
          {ENTRANCES.map((entrance) => <option key={entrance.value} value={entrance.value}>{entrance.label}</option>)}
        </select>
      </label>
    </div>
  );
};
