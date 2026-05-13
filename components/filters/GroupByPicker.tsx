"use client";

/**
 * GroupByPicker — popover content for the "Group by" button.
 *
 * Allows choosing which column to group tasks by. Supports:
 *   - "native" — the structural groups (default; no column grouping)
 *   - per-column — groups tasks by cell value (client-side bucket computation)
 *
 * Groupable types per plan §C.5:
 *   status, priority, person, date, checkbox, country, rating
 *
 * Uses native radio buttons (not Base UI Checkbox) per the plan.
 * Prop-driven: does NOT call useBoardView().
 */

import type { CellTypeId } from "@/lib/cells/types";
import type { Database } from "@/lib/supabase/types";
import type { GroupBy } from "@/lib/views/config-schema";

type Column = Database["public"]["Tables"]["column"]["Row"];

// ---------------------------------------------------------------------------
// Groupable type allowlist (plan §C.5)
// ---------------------------------------------------------------------------

const GROUPABLE_TYPES = new Set<CellTypeId>([
  "status",
  "priority",
  "person",
  "date",
  "checkbox",
  "country",
  "rating",
]);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GroupByPickerProps {
  /** Current group-by state from view config. Default is native. */
  groupBy: GroupBy | undefined;
  /** All columns available on this board. */
  columns: Column[];
  /** Called when the group-by choice changes. */
  onChange: (next: GroupBy) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GroupByPicker({ groupBy, columns, onChange }: GroupByPickerProps) {
  const groupableColumns = columns.filter((col) => GROUPABLE_TYPES.has(col.type as CellTypeId));

  const activeValue = groupBy?.kind === "column" ? groupBy.columnId : "native";

  const handleChange = (value: string) => {
    if (value === "native") {
      onChange({ kind: "native" });
    } else {
      onChange({ kind: "column", columnId: value });
    }
  };

  return (
    <div
      className="flex flex-col"
      style={{ minWidth: 220, maxWidth: 300 }}
      role="radiogroup"
      aria-label="Group by"
    >
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-[color:var(--color-border-strong)]">
        <span className="text-sm font-semibold text-[color:var(--color-fg)]">Group by</span>
      </div>

      {/* Options */}
      <div className="py-1 max-h-72 overflow-y-auto">
        {/* Native (default) option */}
        <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-[color:var(--color-surface-hover)] rounded-[var(--radius-xs)] cursor-pointer">
          <input
            type="radio"
            name="group-by"
            value="native"
            checked={activeValue === "native"}
            onChange={() => handleChange("native")}
            className="w-4 h-4 accent-[color:var(--color-primary)] cursor-pointer"
            aria-label="Native groups (structural)"
          />
          <span className="text-sm text-[color:var(--color-fg)]">None (native groups)</span>
        </label>

        {/* Groupable column options */}
        {groupableColumns.length > 0 && (
          <>
            <div
              className="mx-3 my-1 border-t border-[color:var(--color-border-strong)]"
              aria-hidden="true"
            />
            {groupableColumns.map((col) => (
              <label
                key={col.id}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-[color:var(--color-surface-hover)] rounded-[var(--radius-xs)] cursor-pointer"
              >
                <input
                  type="radio"
                  name="group-by"
                  value={col.id}
                  checked={activeValue === col.id}
                  onChange={() => handleChange(col.id)}
                  className="w-4 h-4 accent-[color:var(--color-primary)] cursor-pointer"
                  aria-label={`Group by ${col.name}`}
                />
                <span className="text-sm text-[color:var(--color-fg)] truncate">{col.name}</span>
              </label>
            ))}
          </>
        )}

        {groupableColumns.length === 0 && (
          <p className="px-3 py-2 text-xs text-[color:var(--color-fg-muted)]">
            No groupable columns on this board.
          </p>
        )}
      </div>
    </div>
  );
}
