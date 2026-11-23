import React, { useRef } from 'react';

export interface TabItem {
  id: string;
  label: string;
  /** Optional count shown after the label (e.g. queued items). */
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  /** Accessible name of the tab list, e.g. "Command lists". */
  label: string;
  /** Prefix for tab/panel ids; pair with `<TabPanel idPrefix=…>`. */
  idPrefix: string;
}

/**
 * ARIA tab list with arrow-key, Home and End navigation and 44px targets.
 * Render the matching content in `<TabPanel>` with the same `idPrefix`.
 */
export const Tabs: React.FC<TabsProps> = ({ tabs, active, onChange, label, idPrefix }) => {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); move(index + 1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); move(index - 1); }
    else if (event.key === 'Home') { event.preventDefault(); move(0); }
    else if (event.key === 'End') { event.preventDefault(); move(tabs.length - 1); }
  };

  return (
    <div className="tw-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(node) => { refs.current[index] = node; }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className={`tw-tabs__tab${selected ? ' is-active' : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && <span className="tw-tabs__count">{tab.count.toLocaleString()}</span>}
          </button>
        );
      })}
    </div>
  );
};

export const TabPanel: React.FC<{ idPrefix: string; id: string; active: string; children: React.ReactNode }> = ({ idPrefix, id, active, children }) => (
  <div
    role="tabpanel"
    id={`${idPrefix}-panel-${id}`}
    aria-labelledby={`${idPrefix}-tab-${id}`}
    hidden={id !== active}
    tabIndex={0}
    className="tw-tabpanel"
  >
    {id === active ? children : null}
  </div>
);
