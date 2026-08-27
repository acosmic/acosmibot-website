import React, { useId, useState } from 'react';

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
  const panelId = useId();

  return (
    <section className={`control-section${isOpen ? ' is-open' : ''}`}>
      <h2 className="control-section__heading">
        <button
          type="button"
          className="control-section__trigger"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls={panelId}
        >
          <span className="control-section__node" aria-hidden="true" />
          <span>{title}</span>
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            aria-hidden="true"
          >
            <path d="M3 5L6 8L9 5" stroke="var(--primary-color)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </h2>
      {isOpen && (
        <div id={panelId} className="control-section__body">
          {children}
        </div>
      )}
    </section>
  );
};
