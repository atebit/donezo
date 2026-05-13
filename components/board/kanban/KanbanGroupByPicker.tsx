"use client";

/**
 * KanbanGroupByPicker — column picker filtered to groupable cell types.
 *
 * Groupable types (v1): status, priority, person, checkbox.
 * Other types render as disabled "Coming soon" options in the select.
 *
 * On selection, calls `applyDraft({ kanban: { groupByColumnId: <id> } })` to
 * persist the pick into the view config draft (auto-saved by useBoardView).
 */

import { useShallow } from "zustand/react/shallow";
import { useBoardView } from "@/hooks/use-board-view";
import { useBoardStore } from "@/stores/board-store";

const GROUPABLE_TYPES = new Set(["status", "priority", "person", "checkbox"]);

export function KanbanGroupByPicker() {
  const { effective, applyDraft } = useBoardView();
  const columns = useBoardStore(useShallow((s) => s.columns));

  const groupableColumns = columns.filter((c) => GROUPABLE_TYPES.has(c.type));
  const currentGroupByColumnId = effective.kanban?.groupByColumnId ?? null;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (!val) return;
    applyDraft({ kanban: { groupByColumnId: val } });
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <p className="text-sm text-[color:var(--color-fg-muted)] max-w-xs text-center">
        Select a column to group tasks into kanban lanes.
      </p>

      {groupableColumns.length === 0 ? (
        <p className="text-sm text-[color:var(--color-fg-muted)]">
          Add a Status, Priority, Person, or Checkbox column to enable kanban grouping.
        </p>
      ) : (
        <select
          aria-label="Group kanban by column"
          value={currentGroupByColumnId ?? ""}
          onChange={handleChange}
          className="border border-[color:var(--color-border)] rounded px-3 py-2 text-sm bg-[color:var(--color-surface)] text-[color:var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)] min-w-[200px]"
        >
          <option value="" disabled>
            Pick a column…
          </option>
          {groupableColumns.map((col) => (
            <option key={col.id} value={col.id}>
              {col.name} ({col.type})
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
