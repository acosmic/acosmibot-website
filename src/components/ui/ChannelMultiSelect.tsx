import React, { useState, useRef, useEffect, useId, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Hash, X } from 'lucide-react';
import { useGuildChannels } from '@/hooks/useGuildChannels';

interface ChannelMultiSelectProps {
  guildId: string;
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  maxSelections?: number;
  error?: string;
  excludeIds?: string[];
}

type DropdownStyle = React.CSSProperties & Record<`--${string}`, string>;

const THEME_VARIABLES = [
  '--bg-card',
  '--bg-card-hover',
  '--bg-tertiary',
  '--bg-overlay',
  '--bg-overlay-hover',
  '--primary-color',
  '--primary-dim',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--border-light',
  '--border-medium',
  '--border-cyan',
] as const;

export const ChannelMultiSelect: React.FC<ChannelMultiSelectProps> = ({
  guildId,
  value,
  onChange,
  label,
  placeholder = 'Select channels...',
  maxSelections,
  error,
  excludeIds = [],
}) => {
  const { data: channels, isLoading } = useGuildChannels(guildId);
  const visibleChannels = channels?.filter((channel) => !excludeIds.includes(channel.id));
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<DropdownStyle>({});
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
      if (!containerRef.current || !triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const sourceStyle = window.getComputedStyle(containerRef.current);
      const inheritedTheme = Object.fromEntries(
        THEME_VARIABLES.map((name) => [
          name,
          sourceStyle.getPropertyValue(name).trim(),
        ]),
      ) as DropdownStyle;
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
      setDropdownStyle({
        ...inheritedTheme,
        position: 'fixed',
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 8 }
          : { top: rect.bottom + 8 }),
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        maxHeight: Math.max(100, Math.min(280, openUp ? spaceAbove : spaceBelow)),
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
        className={`form-control channel-multi-select__trigger${open ? ' is-open' : ''}${error ? ' is-invalid' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${inputId}-listbox` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      >
        <span className={value.length === 0 ? 'channel-multi-select__placeholder' : undefined}>
          {value.length === 0
            ? (isLoading ? 'Loading channels...' : placeholder)
            : `${value.length} channel${value.length === 1 ? '' : 's'} selected`}
        </span>
        <ChevronDown
          className="channel-multi-select__chevron"
          size={18}
          aria-hidden="true"
        />
      </button>
      {value.length > 0 && (
        <div className="channel-multi-select__chips" aria-label="Selected channels">
        {value.map(id => {
          const ch = channels?.find(c => c.id === id);
          return (
            <span
              key={id}
              className="channel-multi-select__chip"
            >
              <Hash size={13} aria-hidden="true" />
              <span>{ch?.name || id}</span>
              <button
                type="button"
                className="channel-multi-select__remove"
                onClick={() => toggle(id)}
                aria-label={`Remove #${ch?.name || id}`}
              >
                <X size={13} aria-hidden="true" />
              </button>
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
      {open && visibleChannels && visibleChannels.length > 0 && createPortal(
        <div
          id={`${inputId}-listbox`}
          ref={dropdownRef}
          className="channel-multi-select__menu"
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
          {visibleChannels.map(ch => {
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
              className={`channel-multi-select__option${selected ? ' is-selected' : ''}`}
              onClick={() => toggle(ch.id)}
            >
              <span className="channel-multi-select__check" aria-hidden="true">
                {selected && <Check size={13} strokeWidth={3} />}
              </span>
              <Hash className="channel-multi-select__hash" size={16} aria-hidden="true" />
              <span className="channel-multi-select__name">{ch.name}</span>
              {selected && <span className="channel-multi-select__state">Selected</span>}
            </button>
          );})}
        </div>,
        document.body
      )}
    </div>
  );
};
