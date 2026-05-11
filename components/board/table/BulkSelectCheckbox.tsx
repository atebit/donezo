"use client";

/**
 * BulkSelectCheckbox — single-task checkbox for bulk selection.
 *
 * Uses Base UI's Checkbox primitive:
 *   import { Checkbox } from "@base-ui/react/checkbox";
 *   <Checkbox.Root> + <Checkbox.Indicator>
 *
 * The module exports a single `Checkbox` namespace containing `Root` and
 * `Indicator`. Do NOT use `import * as Checkbox` — the module's default
 * shape is `{ Checkbox: { Root, Indicator } }`.
 *
 * Reads and writes via useBoardStore — no prop-drilling of selection state.
 * Sized to the --size-cell-w-checkbox (32px) token so it fits the existing
 * 32px-wide cell slot in TaskRow.
 */

import { Checkbox } from "@base-ui/react/checkbox";
import { useBoardStore } from "@/stores/board-store";

interface BulkSelectCheckboxProps {
  taskId: string;
}

export function BulkSelectCheckbox({ taskId }: BulkSelectCheckboxProps) {
  const checked = useBoardStore((s) => s.selection.has(taskId));

  return (
    <Checkbox.Root
      checked={checked}
      onCheckedChange={() => useBoardStore.getState().toggleSelection(taskId)}
      aria-label="Select task"
      className="w-[var(--size-cell-w-checkbox)] flex-shrink-0 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
    >
      {/* Visible box */}
      <span
        className="w-4 h-4 rounded-[var(--radius-xs)] border border-[color:var(--color-border-strong)] flex items-center justify-center transition-colors duration-[var(--motion-fast)]"
        style={{
          backgroundColor: checked ? "var(--color-primary)" : "transparent",
          borderColor: checked ? "var(--color-primary)" : undefined,
        }}
      >
        <Checkbox.Indicator keepMounted>
          {/* Checkmark SVG — shown only when checked (Base UI toggles visibility) */}
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
            <path
              d="M1 4L3.5 6.5L9 1"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Checkbox.Indicator>
      </span>
    </Checkbox.Root>
  );
}
