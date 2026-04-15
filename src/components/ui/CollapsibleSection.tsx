import React, { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultOpen = false
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="card mb-4 p-0 overflow-hidden">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
          cursor: 'pointer',
          background: 'var(--bg-tertiary)',
          borderRadius: isOpen ? '15px 15px 0 0' : '15px',
          userSelect: 'none',
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.5px',
          color: 'var(--primary-color)',
          textTransform: 'uppercase',
        }}>
          {title}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{
            transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
          }}
        >
          <path d="M3 5L6 8L9 5" stroke="var(--primary-color)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {isOpen && (
        <div style={{
          padding: '24px',
          borderTop: '1px solid var(--border-light)',
          background: 'var(--bg-card)',
          borderRadius: '0 0 15px 15px',
        }}>
          {children}
        </div>
      )}
    </div>
  );
};
