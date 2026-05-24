import React, { useState, useRef, useEffect } from 'react';
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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        maxHeight: '200px',
        overflowY: 'auto',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-light)',
        borderRadius: '4px',
      });
    }
    setOpen(o => !o);
  };

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);

  return (
    <div className="form-group mb-3" ref={containerRef} style={{ position: 'relative' }}>
      {label && <label className="form-label mb-2 d-block">{label}</label>}
      <div
        className="form-control"
        style={{ height: 'auto', minHeight: '42px', display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', cursor: 'pointer' }}
        onClick={handleOpen}
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
        <div className="p-2" style={dropdownStyle}>
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
