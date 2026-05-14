"use client";

/**
 * CheckboxCell — read-mode renderer for the "checkbox" cell type.
 *
 * Display only — clicking the cell is handled by the orchestrator which opens
 * the Editor. The checkbox is `disabled` so it doesn't intercept click events.
 *
 * Uses Base UI <Checkbox.Root> for accessibility (checked state, aria-label).
 */

import { Checkbox } from "@base-ui/react/checkbox";
import React from "react";

import type { TaskRow } from "@/lib/cells/types";

interface CheckboxCellProps {
  value: boolean | null;
  config: Record<string, never>;
  row: TaskRow;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CheckboxCellInner({ value, config: _config, row: _row }: CheckboxCellProps) {
  const checked = value === true;

  return (
    <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center justify-center hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
      <Checkbox.Root
        checked={checked}
        disabled
        aria-label={checked ? "Checked" : "Unchecked"}
        className="flex items-center justify-center cursor-default"
      >
        <span
          className="w-4 h-4 rounded-[var(--radius-xs)] border flex items-center justify-center transition-colors duration-[var(--motion-fast)]"
          style={{
            backgroundColor: checked ? "var(--color-primary)" : "transparent",
            borderColor: checked ? "var(--color-primary)" : "var(--color-border-strong)",
          }}
        >
          <Checkbox.Indicator keepMounted>
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
    </div>
  );
}

export const Cell = React.memo(CheckboxCellInner);
Cell.displayName = "CheckboxCell";
