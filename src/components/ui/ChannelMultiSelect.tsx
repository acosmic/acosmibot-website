import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGuildChannels } from '@/hooks/useGuildChannels';

interface ChannelMultiSelectProps {
  guildId: string;
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
}

export const ChannelMultiSelect: React.FC<ChannelMultiSelectProps> = ({
  guildId,
  value,
  onChange,
  label,
  placeholder = 'Select channels...'
}) => {
  const { data: channels, isLoading } = useGuildChannels(guildId);
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);

  return (
    <div className="form-group mb-3" ref={containerRef} style={{ position: 'relative' }}>
      {label && <label className="form-label mb-2 d-block">{label}</label>}
      <div
        className="form-control"
        style={{ height: 'auto', minHeight: '42px', display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        {value.length === 0 && (
          <span className="text-muted">{isLoading ? 'Loading channels...' : placeholder}</span>
        )}
        {value.map(id => {
          const ch = channels?.find(c => c.id === id);
          return (
            <span
              key={id}
              className="badge bg-secondary p-2 d-flex align-items-center gap-2"
              style={{ borderRadius: '8px' }}
            >
              #{ch?.name || id}
              <span
                style={{ cursor: 'pointer', fontWeight: 'bold' }}
                onClick={(e) => { e.stopPropagation(); toggle(id); }}
              >×</span>
            </span>
          );
        })}
      </div>
      {open && channels && channels.length > 0 && createPortal(
        <div ref={dropdownRef} className="p-2" style={dropdownStyle}>
          {channels.map(ch => (
            <div
              key={ch.id}
              className="p-2 d-flex align-items-center gap-2"
              style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }}
              onClick={() => toggle(ch.id)}
            >
              <input type="checkbox" checked={value.includes(ch.id)} readOnly />
              <span>#{ch.name}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};
