"use client";

import { CELL_TYPE_ICONS } from "@/lib/cells/icons";
import type { CellTypeId } from "@/lib/cells/types";

import { useGridTemplate } from "./grid-template-context";
import { TITLE_COLUMN_LABEL, useVisibleColumns } from "./use-visible-columns";

export function GroupColumnHeader() {
  const { gridTemplateColumns } = useGridTemplate();
  const { titleColumn, otherColumns, getColumnWidth } = useVisibleColumns();

  return (
    <div
      className="h-9 bg-[color:var(--color-surface)] border-b border-[color:var(--color-border-strong)] grid"
      style={{ gridTemplateColumns }}
      aria-hidden="true"
    >
      {/* Checkbox track */}
      <div className="border-r border-[color:var(--color-border-strong)]" />

      {/* Title column — anchored left during horizontal scroll via the same
          scroll-offset counter-transform used by TaskRow / the add-task
          footer (CSS sticky is broken inside the transformed virtualizer
          rows). */}
      {titleColumn && (
        // biome-ignore lint/a11y/useFocusableInteractive: column header divs in a CSS grid are display-only; keyboard navigation is handled by inner interactive children
        // biome-ignore lint/a11y/useSemanticElements: <th> cannot be used inside a CSS grid layout; role="columnheader" is intentional for a11y + Playwright targeting
        <div
          role="columnheader"
          className="z-[var(--z-sticky)] bg-[color:var(--color-surface)] flex items-center gap-1 px-2 text-xs text-[color:var(--color-fg-muted)] font-medium overflow-hidden"
          style={{
            width: getColumnWidth(titleColumn),
            transform: "translateX(max(0px, calc(var(--table-scroll-x, 0px) - 12px)))",
          }}
        >
          {(() => {
            const TypeIcon = CELL_TYPE_ICONS[titleColumn.type as CellTypeId];
            return TypeIcon ? (
              <TypeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : null;
          })()}
          <span className="truncate">{TITLE_COLUMN_LABEL}</span>
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
            className="flex items-center gap-1 px-2 border-l border-[color:var(--color-border-strong)] text-xs text-[color:var(--color-fg-muted)] font-medium"
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
