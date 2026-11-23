/**
 * Shows a freshly created (or replaced) overlay link exactly once. The link
 * contains the overlay token: it lives only in this component's props, is
 * never stored, logged or put in a query key, and disappears when the panel
 * is closed.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { WIDGET_INFO, type WidgetKind } from './model';

interface OverlayUrlPanelProps {
  url: string;
  name: string;
  widget: WidgetKind;
  replaced: boolean;
  onDone: () => void;
}

export const OverlayUrlPanel: React.FC<OverlayUrlPanelProps> = ({ url, name, widget, replaced, onDone }) => {
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');
  const info = WIDGET_INFO[widget];

  useEffect(() => {
    heading.current?.focus();
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied.');
    } catch {
      input.current?.focus();
      input.current?.select();
      setStatus('Copying is blocked in this browser. The link is selected: press Ctrl+C or Cmd+C to copy it.');
    }
  };

  return (
    <section className="tw-ov-reveal" aria-labelledby="tw-ov-reveal-title">
      <h2 id="tw-ov-reveal-title" ref={heading} tabIndex={-1} className="tw-ov-reveal__title">
        <KeyRound size={18} aria-hidden="true" /> {replaced ? `New link for ${name}` : `Link for ${name}`}
      </h2>
      <p className="tw-ov-reveal__warning">
        This link is shown only once. Copy it now: it will not be shown again. It works like a password, so anyone
        who has it can show this overlay. If it leaks, replace the link{replaced ? '' : ' from the overlay list'}.
        {replaced && ' The previous link has stopped working.'}
      </p>
      <div className="tw-ov-reveal__copy">
        <label htmlFor="tw-ov-reveal-url" className="visually-hidden">Overlay link</label>
        <input id="tw-ov-reveal-url" ref={input} className="form-control tw-ov-reveal__url" type="text" readOnly value={url}
          spellCheck={false} autoComplete="off" onFocus={(event) => event.currentTarget.select()} />
        <button type="button" className="btn primary" onClick={() => void copy()}>
          {status === 'Link copied.' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} Copy link
        </button>
      </div>
      <p className="tw-ov-reveal__status" role="status" aria-live="polite">{status}</p>
      <div className="tw-ov-reveal__steps">
        <h3>Add it in OBS</h3>
        <ol>
          <li>In your scene, add a source and choose <strong>Browser</strong>.</li>
          <li>Paste the link into the <strong>URL</strong> field.</li>
          <li>Set the width and height (for this widget {info.width} × {info.height} works well), then position it on your scene.</li>
        </ol>
      </div>
      <div className="tw-ov-reveal__actions">
        <button type="button" className="btn" onClick={onDone}>I have copied the link</button>
      </div>
    </section>
  );
};
