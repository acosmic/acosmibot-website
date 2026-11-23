import React, { useEffect, useRef } from 'react';

export type RowKey = string | number;

export interface Column<T> {
  key: string;
  /** Column heading; also the field label when rows become cards (≤ 768px). */
  header: string;
  render: (row: T) => React.ReactNode;
  /**
   * The cell that names the row (one per table). It is emphasised, becomes the
   * card title on small screens, and holds the open button when `onRowClick` is set.
   */
  primary?: boolean;
  align?: 'start' | 'center' | 'end';
  /** CSS width for the desktop column, e.g. `'140px'`. */
  width?: string;
  hideOnMobile?: boolean;
  /** Keep the heading for screen readers only (e.g. a narrow status column). */
  hideHeader?: boolean;
}

export interface RecordTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => RowKey;
  /** Accessible table name, e.g. "Custom commands". Rendered as a hidden caption. */
  caption: string;
  /** Shown instead of the table when `rows` is empty (use `EmptyState`). */
  empty: React.ReactNode;
  /** Opens a row (usually an `EditorDrawer`). Adds a real button in the primary cell. */
  onRowClick?: (row: T) => void;
  /** Accessible name for the open button, e.g. `(row) => \`Edit ${row.name}\``. */
  rowLabel?: (row: T) => string;
  /** Buttons rendered in a trailing actions cell. Keep each at least 44px tall. */
  rowActions?: (row: T) => React.ReactNode;
  /** Highlights one row, e.g. the one open in the drawer. */
  activeKey?: RowKey | null;
  /** Filters, search and bulk actions above the table. */
  toolbar?: React.ReactNode;
  /** Pagination ("Load more") below the table. */
  footer?: React.ReactNode;
  /** Optional checkbox selection with a select-all header. */
  selection?: {
    selected: ReadonlySet<RowKey>;
    onChange: (next: Set<RowKey>) => void;
    /** Accessible name per row checkbox. */
    label: (row: T) => string;
  };
}

const INTERACTIVE = 'button, a, input, select, textarea, label, [role="switch"]';

/**
 * Semantic table for record lists that turns into labelled cards at ≤ 768px
 * (DESIGN.md: "tables become labeled card rows"), with no horizontal scroll.
 */
export function RecordTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  empty,
  onRowClick,
  rowLabel,
  rowActions,
  activeKey,
  toolbar,
  footer,
  selection,
}: RecordTableProps<T>) {
  const selectAll = useRef<HTMLInputElement>(null);
  const keys = rows.map(rowKey);
  const selectedCount = selection ? keys.filter((key) => selection.selected.has(key)).length : 0;
  const allSelected = rows.length > 0 && selectedCount === rows.length;

  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = selectedCount > 0 && !allSelected;
  }, [selectedCount, allSelected]);

  const toggle = (key: RowKey, checked: boolean) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (checked) next.add(key); else next.delete(key);
    selection.onChange(next);
  };

  const toggleAll = (checked: boolean) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    keys.forEach((key) => (checked ? next.add(key) : next.delete(key)));
    selection.onChange(next);
  };

  return (
    <div className="tw-table">
      {toolbar && <div className="tw-table__toolbar">{toolbar}</div>}
      {rows.length === 0 ? (
        <div className="tw-table__empty">{empty}</div>
      ) : (
        <div className="tw-table__frame">
          <table>
            <caption className="visually-hidden">{caption}</caption>
            <thead>
              <tr>
                {selection && (
                  <th scope="col" className="tw-table__select">
                    <input
                      ref={selectAll}
                      type="checkbox"
                      className="form-check-input"
                      aria-label={`Select all ${caption.toLowerCase()}`}
                      checked={allSelected}
                      onChange={(event) => toggleAll(event.target.checked)}
                    />
                  </th>
                )}
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    className={`tw-align-${column.align ?? 'start'}${column.hideOnMobile ? ' tw-hide-mobile' : ''}`}
                  >
                    <span className={column.hideHeader ? 'visually-hidden' : undefined}>{column.header}</span>
                  </th>
                ))}
                {rowActions && <th scope="col" className="tw-align-end"><span className="visually-hidden">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const key = keys[index];
                const isActive = activeKey !== undefined && activeKey !== null && key === activeKey;
                return (
                  <tr
                    key={key}
                    className={`${isActive ? 'is-active' : ''}${onRowClick ? ' is-clickable' : ''}`}
                    onClick={onRowClick ? (event) => {
                      if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
                      onRowClick(row);
                    } : undefined}
                  >
                    {selection && (
                      <td className="tw-table__select">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          aria-label={selection.label(row)}
                          checked={selection.selected.has(key)}
                          onChange={(event) => toggle(key, event.target.checked)}
                        />
                      </td>
                    )}
                    {columns.map((column) => {
                      const content = column.render(row);
                      return (
                        <td
                          key={column.key}
                          data-label={column.primary ? undefined : column.header}
                          className={`tw-align-${column.align ?? 'start'}${column.primary ? ' tw-table__primary' : ''}${column.hideOnMobile ? ' tw-hide-mobile' : ''}`}
                        >
                          {column.primary && onRowClick ? (
                            <button
                              type="button"
                              className="tw-table__open"
                              aria-label={rowLabel?.(row)}
                              aria-current={isActive ? 'true' : undefined}
                              onClick={() => onRowClick(row)}
                            >
                              {content}
                            </button>
                          ) : content}
                        </td>
                      );
                    })}
                    {rowActions && <td className="tw-table__actions tw-align-end">{rowActions(row)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {footer && rows.length > 0 && <div className="tw-table__footer">{footer}</div>}
    </div>
  );
}
