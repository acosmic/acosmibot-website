import React, { useId, useRef } from 'react';
import { VariablePicker, type TemplateContext } from './VariablePicker';

export interface TemplateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  /** Which `$(…)` variables the picker offers. */
  context: TemplateContext;
  /** Extra names this message provides (§7.6), e.g. `['winner', 'entries']`. */
  contextVars?: string[];
  /** Settings field path for `meta.context_variables`, e.g. `giveaways.winner_template`. */
  field?: string;
  /** Validation messages for this field (from `settings.issuesFor(path)` or a validate endpoint). */
  issues?: Array<string | { message: string }>;
  help?: React.ReactNode;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

/**
 * Textarea for a bot response template with a live character count and an
 * "Insert variable" picker that inserts `$(name)` at the cursor.
 */
export const TemplateField: React.FC<TemplateFieldProps> = ({
  label,
  value,
  onChange,
  maxLength,
  context,
  contextVars,
  field,
  issues = [],
  help,
  placeholder,
  rows = 3,
  disabled,
  required,
  id,
}) => {
  const generated = useId().replace(/:/g, '');
  const inputId = id ?? `tw-template-${generated}`;
  const countId = `${inputId}-count`;
  const helpId = help ? `${inputId}-help` : undefined;
  const issuesId = issues.length ? `${inputId}-issues` : undefined;
  const textarea = useRef<HTMLTextAreaElement>(null);
  const length = value.length;
  const nearLimit = length >= maxLength * 0.9;

  const insert = (text: string) => {
    const element = textarea.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    if (next.length > maxLength) {
      element?.focus();
      return;
    }
    onChange(next);
    window.requestAnimationFrame(() => {
      if (!textarea.current) return;
      textarea.current.focus();
      textarea.current.selectionStart = textarea.current.selectionEnd = start + text.length;
    });
  };

  return (
    <div className={`tw-field tw-template${issues.length ? ' is-invalid' : ''}`}>
      <div className="tw-template__header">
        <label htmlFor={inputId} className="form-label">
          {label}
          {required && <span className="visually-hidden"> (required)</span>}
        </label>
        <VariablePicker context={context} contextVars={contextVars} field={field} onInsert={insert} disabled={disabled} />
      </div>
      <textarea
        ref={textarea}
        id={inputId}
        className="form-control tw-template__input"
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        spellCheck
        aria-invalid={issues.length ? true : undefined}
        aria-describedby={[helpId, issuesId, countId].filter(Boolean).join(' ')}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="tw-template__meta">
        {help ? <p id={helpId} className="tw-field__help">{help}</p> : <span />}
        <span id={countId} className={`tw-template__count${nearLimit ? ' is-near' : ''}`}>
          {length.toLocaleString()} / {maxLength.toLocaleString()}
          <span className="visually-hidden"> characters</span>
        </span>
      </div>
      {issues.length > 0 && (
        <ul id={issuesId} className="tw-field__error tw-template__issues" role="alert">
          {issues.map((issue, index) => (
            <li key={index}>{typeof issue === 'string' ? issue : issue.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
