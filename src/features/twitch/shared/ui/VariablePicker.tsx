import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Braces, Search } from 'lucide-react';
import { useMeta } from '../useMeta';

export type TemplateContext = 'command' | 'timer' | 'alert' | 'other';

export interface VariablePickerProps {
  /** Which variables apply (`meta.variables[].contexts`). */
  context: TemplateContext;
  /** Extra names this particular message provides (e.g. `winner`). */
  contextVars?: string[];
  /** Settings field path; adds `meta.context_variables[field]` (e.g. `chat_alerts.follow.template`). */
  field?: string;
  /** Receives the text to insert, e.g. `$(user)`. */
  onInsert: (text: string) => void;
  disabled?: boolean;
}

interface Option { name: string; usage: string; description: string; aliases: string[]; contextual: boolean }

/**
 * "Insert variable" popover listing the `$(…)` variables documented by
 * `GET /meta` for this context, plus the message's own context names.
 * Only variables the API documents are offered, so the list never advertises
 * something the bot cannot render.
 */
export const VariablePicker: React.FC<VariablePickerProps> = ({ context, contextVars = [], field, onInsert, disabled }) => {
  const meta = useMeta();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const searchId = useId();

  const options = useMemo<Option[]>(() => {
    const extra = [...new Set([...(field ? meta.data?.context_variables?.[field] ?? [] : []), ...contextVars])];
    const contextual: Option[] = extra.map((name) => ({ name, usage: `$(${name})`, description: 'Provided by this message.', aliases: [], contextual: true }));
    const documented: Option[] = (meta.data?.variables ?? [])
      .filter((variable) => !variable.contexts?.length || variable.contexts.includes(context))
      .filter((variable) => !extra.includes(variable.name))
      .map((variable) => ({
        name: variable.name,
        usage: variable.usage || `$(${variable.name})`,
        description: variable.description,
        aliases: variable.aliases ?? [],
        contextual: false,
      }));
    return [...contextual, ...documented];
  }, [meta.data, context, contextVars, field]);

  const term = search.trim().toLowerCase();
  const visible = term
    ? options.filter((option) => option.name.includes(term)
      || option.aliases.some((alias) => alias.includes(term))
      || option.description.toLowerCase().includes(term))
    : options;

  useEffect(() => {
    if (!open) return undefined;
    const frame = window.requestAnimationFrame(() => searchInput.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!popover.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    // Capture phase so the drawer's Escape handler does not also close the drawer.
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onPointer);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  const choose = (option: Option) => {
    onInsert(`$(${option.name})`);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="tw-varpicker">
      <button
        ref={trigger}
        type="button"
        className="btn tw-varpicker__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
      >
        <Braces aria-hidden="true" size={16} />
        Insert variable
      </button>
      {open && (
        <div ref={popover} id={panelId} className="tw-varpicker__panel" role="dialog" aria-label="Insert a variable">
          <label htmlFor={searchId} className="visually-hidden">Search variables</label>
          <div className="tw-varpicker__search">
            <Search aria-hidden="true" size={16} />
            <input
              ref={searchInput}
              id={searchId}
              type="search"
              className="form-control"
              placeholder="Search variables"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {meta.isPending && options.length === 0 ? (
            <p className="tw-varpicker__state" role="status">Loading variables…</p>
          ) : meta.isError && options.length === 0 ? (
            <p className="tw-varpicker__state" role="alert">
              Variables could not load.{' '}
              <button type="button" className="tw-link-button" onClick={() => void meta.refetch()}>Try again</button>
            </p>
          ) : visible.length === 0 ? (
            <p className="tw-varpicker__state" role="status">No variable matches “{search}”.</p>
          ) : (
            <ul className="tw-varpicker__list">
              {visible.map((option) => (
                <li key={`${option.contextual ? 'ctx' : 'var'}-${option.name}`}>
                  <button type="button" className="tw-varpicker__option" onClick={() => choose(option)}>
                    <code>{option.usage}</code>
                    <span>{option.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
