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
    <div className="card mb-3 p-0 overflow-hidden">
      <div 
        className="card-header p-3 d-flex justify-content-between align-items-center" 
        style={{ cursor: 'pointer', background: 'var(--bg-tertiary)' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <h4 className="mb-0 text-primary">{title}</h4>
        <span style={{ 
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
          fontSize: '1.2rem'
        }}>
          ▼
        </span>
      </div>
      {isOpen && (
        <div className="card-body p-4 border-top border-light">
          {children}
        </div>
      )}
    </div>
  );
};
