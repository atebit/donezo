"use client";

/**
 * TimelineColumnPicker — empty-state picker for selecting a timeline column.
 *
 * Rendered when view.config.timeline.timelineColumnId is null.
 * Lists all columns of type "timeline" on the board and persists the selection
 * to view.config.timeline via applyDraft.
 */

import { BarChart2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useBoardView } from "@/hooks/use-board-view";
import { useBoardStore } from "@/stores/board-store";

export function TimelineColumnPicker() {
  const { effective, applyDraft } = useBoardView();
  const columns = useBoardStore(useShallow((s) => s.columns));

  // Only show columns of type "timeline"
  const timelineCols = columns.filter((c) => c.type === "timeline");

  function handlePick(columnId: string) {
    applyDraft({
      timeline: {
        ...effective.timeline,
        timelineColumnId: columnId,
        scale: effective.timeline?.scale ?? "week",
        colorBy: effective.timeline?.colorBy ?? { kind: "none" },
      },
    });
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
      <BarChart2 size={48} className="text-[color:var(--color-fg-muted)]" aria-hidden />
      <div>
        <p className="text-base font-semibold text-[color:var(--color-fg)] mb-1">
          Pick a timeline column to render bars
        </p>
        <p className="text-sm text-[color:var(--color-fg-muted)]">
          Add a Timeline column to your board, then select it below.
        </p>
      </div>

      {timelineCols.length === 0 ? (
        <p className="text-sm text-[color:var(--color-fg-muted)] italic">
          No timeline columns found. Add one from the column menu.
        </p>
      ) : (
        <div className="flex flex-col gap-2 w-full max-w-xs">
          {timelineCols.map((col) => (
            <button
              key={col.id}
              type="button"
              onClick={() => handlePick(col.id)}
              className="flex items-center gap-2 px-4 py-2 rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-primary)] hover:bg-[color:var(--color-surface-hover)] transition-colors text-left text-sm font-medium text-[color:var(--color-fg)]"
            >
              <BarChart2 size={14} aria-hidden />
              {col.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
