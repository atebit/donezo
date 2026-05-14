"use client";

import { CELL_TYPE_ICONS } from "@/lib/cells/icons";
import type { CellTypeId } from "@/lib/cells/types";

import { useGridTemplate } from "./grid-template-context";
import { useVisibleColumns } from "./use-visible-columns";

export function GroupColumnHeader() {
  const { gridTemplateColumns } = useGridTemplate();
  const { titleColumn, otherColumns, getColumnWidth } = useVisibleColumns();

  return (
    <div
      className="h-9 bg-[color:var(--color-surface)] border-b border-[color:var(--color-border-strong)] border-t-[2px] grid"
      style={{
        gridTemplateColumns,
        borderTopColor: "var(--group-accent)",
      }}
      aria-hidden="true"
    >
      {/* Checkbox track */}
      <div className="border-r border-[color:var(--color-border-strong)]" />

      {/* Title column — sticky left */}
      {titleColumn && (
        // biome-ignore lint/a11y/useFocusableInteractive: column header divs in a CSS grid are display-only; keyboard navigation is handled by inner interactive children
        // biome-ignore lint/a11y/useSemanticElements: <th> cannot be used inside a CSS grid layout; role="columnheader" is intentional for a11y + Playwright targeting
        <div
          role="columnheader"
          className="sticky left-0 z-[var(--z-sticky)] bg-[color:var(--color-surface)] flex items-center gap-1 px-2 border-r border-[color:var(--color-border-strong)] text-xs text-[color:var(--color-fg-muted)] font-medium"
          style={{ width: getColumnWidth(titleColumn) }}
        >
          {(() => {
            const TypeIcon = CELL_TYPE_ICONS[titleColumn.type as CellTypeId];
            return TypeIcon ? (
              <TypeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : null;
          })()}
          <span className="truncate">{titleColumn.name}</span>
        </div>
      )}

      {/* Other columns */}
      {otherColumns.map((col) => {
        const TypeIcon = CELL_TYPE_ICONS[col.type as CellTypeId];
        return (
          // biome-ignore lint/a11y/useFocusableInteractive: column header divs in a CSS grid are display-only; keyboard navigation is handled by inner interactive children
          // biome-ignore lint/a11y/useSemanticElements: <th> cannot be used inside a CSS grid layout; role="columnheader" is intentional for a11y + Playwright targeting
          <div
            key={col.id}
            role="columnheader"
            className="flex items-center gap-1 px-2 border-r border-[color:var(--color-border-strong)] text-xs text-[color:var(--color-fg-muted)] font-medium"
            style={{ width: getColumnWidth(col) }}
          >
            {TypeIcon ? <TypeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
            <span className="truncate">{col.name}</span>
          </div>
        );
      })}

      {/* Add-column slot */}
      <div />
    </div>
  );
}
