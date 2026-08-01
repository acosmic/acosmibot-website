import React, { useState, useRef, useEffect, useId, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGuildChannels } from '@/hooks/useGuildChannels';

interface ChannelMultiSelectProps {
  guildId: string;
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  maxSelections?: number;
  error?: string;
}

export const ChannelMultiSelect: React.FC<ChannelMultiSelectProps> = ({
  guildId,
  value,
  onChange,
  label,
  placeholder = 'Select channels...',
  maxSelections,
  error,
}) => {
  const { data: channels, isLoading } = useGuildChannels(guildId);
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputId = useId();
  const errorId = `${inputId}-error`;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inContainer && !inDropdown) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
      setDropdownStyle({
        position: 'fixed',
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        maxHeight: Math.max(100, Math.min(280, openUp ? spaceAbove : spaceBelow)),
        overflowY: 'auto',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-light)',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      dropdownRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus();
    }
  }, [open, channels]);

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id));
      return;
    }
    if (maxSelections != null && value.length >= maxSelections) return;
    onChange([...value, id]);
  };

  return (
    <div className="form-group mb-3" ref={containerRef} style={{ position: 'relative' }}>
      {label && <label className="form-label mb-2 d-block" htmlFor={inputId}>{label}</label>}
      <button
        ref={triggerRef}
        id={inputId}
        type="button"
        className={`form-control text-start${error ? ' is-invalid' : ''}`}
        style={{ minHeight: '42px', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      >
        {value.length === 0 && (
          <span className="text-muted">{isLoading ? 'Loading channels...' : placeholder}</span>
        )}
        {value.length > 0 && (
          <span>{value.length} channel{value.length === 1 ? '' : 's'} selected</span>
        )}
      </button>
      {value.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mt-2" aria-label="Selected channels">
        {value.map(id => {
          const ch = channels?.find(c => c.id === id);
          return (
            <span
              key={id}
              className="badge bg-secondary p-2 d-flex align-items-center gap-2"
              style={{ borderRadius: '8px' }}
            >
              #{ch?.name || id}
              <button
                type="button"
                className="btn p-0 border-0 text-reset"
                style={{ lineHeight: 1, minWidth: 20, minHeight: 20 }}
                onClick={() => toggle(id)}
                aria-label={`Remove #${ch?.name || id}`}
              >×</button>
            </span>
          );
        })}
        </div>
      )}
      {error && (
        <div id={errorId} className="invalid-feedback d-block" role="alert">
          {error}
        </div>
      )}
      {open && channels && channels.length > 0 && createPortal(
        <div
          ref={dropdownRef}
          className="p-2"
          style={dropdownStyle}
          role="listbox"
          aria-label={label || 'Channels'}
          aria-multiselectable="true"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              triggerRef.current?.focus();
              return;
            }
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
              const options = Array.from(
                dropdownRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') ?? [],
              );
              if (options.length === 0) return;
              event.preventDefault();
              const current = options.indexOf(document.activeElement as HTMLButtonElement);
              const next = event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? options.length - 1
                  : event.key === 'ArrowDown'
                    ? (current + 1) % options.length
                    : (current - 1 + options.length) % options.length;
              options[next]?.focus();
            }
          }}
        >
          {channels.map(ch => {
            const selected = value.includes(ch.id);
            const atLimit = (
              !selected
              && maxSelections != null
              && value.length >= maxSelections
            );
            return (
            <button
              type="button"
              key={ch.id}
              role="option"
              aria-selected={selected}
              disabled={atLimit}
              className="btn w-100 p-2 d-flex align-items-center gap-2 text-start"
              style={{ borderBottom: '1px solid var(--border-light)', borderRadius: 0 }}
              onClick={() => toggle(ch.id)}
            >
              <input type="checkbox" checked={selected} readOnly tabIndex={-1} aria-hidden="true" />
              <span>#{ch.name}</span>
            </button>
          );})}
        </div>,
        document.body
      )}
    </div>
  );
};
