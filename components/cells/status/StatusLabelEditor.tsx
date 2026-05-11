"use client";

/**
 * StatusLabelEditor — shared popover-content editor for "status" and "priority" cells.
 *
 * Renders inside a Base UI <Popover> managed by the orchestrator (S15).
 * This component is the popover CONTENT only — no <Popover.Root> here.
 *
 * Layout:
 *   - 152px wide container
 *   - "Clear" chip at the top → onChange(null) then onClose()
 *   - Vertical list of label chips (8px gap)
 *   - Each chip: full-bleed bg = label color, white centered text
 *   - "Edit Labels" button at bottom with 1px top border --color-border-strong
 *     (calls onEditLabels if provided; button is hidden when prop is absent)
 *
 * Label access:
 *   Reads labels from useBoardStore(s => s.labelsByColumn.get(columnId)).
 *   Falls back to empty list when columnId is undefined or labels not loaded.
 *   No Supabase calls — all data flows through the hydrated store.
 *
 * RLS note (Q26): "Edit Labels" is gated on board admin role in S17 (LabelEditorModal).
 * Here we render the button always if onEditLabels is provided; S17 / the caller is
 * responsible for gating the callback.
 */

import { useBoardStore } from "@/stores/board-store";
import type { StatusCellValue } from "./Cell";

interface StatusLabelEditorProps {
  value: StatusCellValue | null;
  onChange: (next: StatusCellValue | null) => void;
  onClose: () => void;
  /** The column whose labels are shown. Optional for type-compat; renders
   *  empty list when undefined. The orchestrator passes this at call time. */
  columnId?: string;
  /** Called when the user clicks "Edit Labels". S17 wires this to LabelEditorModal.
   *  When omitted, the "Edit Labels" button is not rendered. */
  onEditLabels?: () => void;
}

export function StatusLabelEditor({
  onChange,
  onClose,
  columnId,
  onEditLabels,
}: StatusLabelEditorProps) {
  const labelsByColumn = useBoardStore((s) => s.labelsByColumn);
  const labels = columnId ? (labelsByColumn.get(columnId) ?? []) : [];

  const handleSelect = (labelId: string) => {
    onChange({ labelId });
    onClose();
  };

  const handleClear = () => {
    onChange(null);
    onClose();
  };

  return (
    <div
      className="flex flex-col py-2"
      style={{ width: 152 }}
      role="listbox"
      aria-label="Select label"
    >
      {/* Clear option — always first */}
      <button
        type="button"
        className="mx-2 mb-1 h-8 rounded-[var(--radius-xs)] flex items-center justify-center text-xs font-medium text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] transition-colors duration-[var(--motion-fast)] cursor-pointer"
        onClick={handleClear}
        role="option"
        aria-selected={false}
      >
        Clear
      </button>

      {/* Label chips */}
      <div className="flex flex-col gap-[8px] px-2">
        {labels.map((label) => (
          <button
            key={label.id}
            type="button"
            className="h-8 rounded-[var(--radius-xs)] flex items-center justify-center text-xs font-medium text-white cursor-pointer hover:opacity-90 transition-opacity duration-[var(--motion-fast)] truncate px-2"
            style={{ backgroundColor: label.color }}
            onClick={() => handleSelect(label.id)}
            role="option"
            aria-selected={false}
          >
            {label.name}
          </button>
        ))}
      </div>

      {/* Edit Labels footer — only rendered when the prop is provided */}
      {onEditLabels && (
        <button
          type="button"
          className="mt-2 mx-0 px-3 h-8 flex items-center text-xs text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] transition-colors duration-[var(--motion-fast)] cursor-pointer border-t border-[color:var(--color-border-strong)]"
          onClick={onEditLabels}
        >
          Edit Labels
        </button>
      )}
    </div>
  );
}
