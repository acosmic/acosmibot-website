/** The per-widget config form, rendered from `WIDGET_FIELDS` (model.ts). */
import React from 'react';
import { NumberInput } from '@/components/ui';
import { Field, Switch } from '../shared/ui';
import { WIDGET_FIELDS, type ConfigProblem, type WidgetConfig, type WidgetKind } from './model';

interface ConfigFieldsProps {
  widget: WidgetKind;
  config: WidgetConfig;
  onChange: (config: WidgetConfig) => void;
  problems: ConfigProblem[];
  disabled?: boolean;
  idPrefix: string;
}

export const ConfigFields: React.FC<ConfigFieldsProps> = ({ widget, config, onChange, problems, disabled, idPrefix }) => {
  const set = (key: string, value: WidgetConfig[string]) => onChange({ ...config, [key]: value });
  const errorFor = (key: string) => problems.find((problem) => problem.field === key)?.message;

  return (
    <div className="tw-ov-fields">
      {WIDGET_FIELDS[widget].map((field) => {
        const error = errorFor(field.key);
        const id = `${idPrefix}-${field.key}`;
        switch (field.kind) {
          case 'int':
          case 'float':
            return (
              <Field key={field.key} id={id} label={field.unit ? `${field.label} (${field.unit})` : field.label}
                help={field.help ?? `From ${field.min.toLocaleString('en-US')} to ${field.max.toLocaleString('en-US')}.`} error={error}>
                {(control) => (
                  <NumberInput {...control} className="form-control" min={field.min} max={field.max} step={field.step ?? 1}
                    disabled={disabled} value={typeof config[field.key] === 'number' ? config[field.key] as number : null}
                    onValueChange={(value) => set(field.key, value)} />
                )}
              </Field>
            );
          case 'bool':
            return (
              <div key={field.key} className="tw-ov-switch">
                <Switch id={id} label={field.label} description={field.help} disabled={disabled}
                  checked={config[field.key] === true} onChange={(checked) => set(field.key, checked)} />
              </div>
            );
          case 'select':
            return (
              <Field key={field.key} id={id} label={field.label} help={field.help} error={error}>
                {(control) => (
                  <select {...control} className="form-select" disabled={disabled} value={String(config[field.key] ?? field.default)}
                    onChange={(event) => set(field.key, event.target.value)}>
                    {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                )}
              </Field>
            );
          case 'multiselect': {
            const selected = Array.isArray(config[field.key]) ? config[field.key] as string[] : [];
            const toggle = (value: string, on: boolean) => {
              const next = on ? [...selected, value] : selected.filter((item) => item !== value);
              set(field.key, field.options.map((option) => option.value).filter((option) => next.includes(option)));
            };
            return (
              <fieldset key={field.key} className={`tw-ov-checks${error ? ' is-invalid' : ''}`} aria-describedby={error ? `${id}-error` : undefined}>
                <legend className="form-label">{field.label}</legend>
                <div className="tw-ov-checks__grid">
                  {field.options.map((option) => {
                    const optionId = `${id}-${option.value}`;
                    return (
                      <label key={option.value} htmlFor={optionId} className="tw-ov-check">
                        <input id={optionId} type="checkbox" className="form-check-input" disabled={disabled}
                          checked={selected.includes(option.value)} onChange={(event) => toggle(option.value, event.target.checked)} />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
                {error && <p id={`${id}-error`} className="tw-field__error" role="alert">{error}</p>}
              </fieldset>
            );
          }
          case 'text':
            return (
              <Field key={field.key} id={id} label={field.label} optional help={field.help ?? `At most ${field.maxLength} characters.`} error={error}>
                {(control) => (
                  <input {...control} className="form-control" type="text" maxLength={field.maxLength} disabled={disabled}
                    value={String(config[field.key] ?? '')} onChange={(event) => set(field.key, event.target.value)} />
                )}
              </Field>
            );
          default:
            return null;
        }
      })}
    </div>
  );
};
