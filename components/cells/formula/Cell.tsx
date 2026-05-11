"use client";

/**
 * FormulaCell — read-mode renderer for the "formula" cell type.
 *
 * Formula columns are a stub in v1 — values are never computed or stored.
 * The cell always renders "—" (em-dash) in muted text inside a Base UI Tooltip
 * that explains "Formula columns coming soon".
 *
 * The tooltip follows the same pattern as FileEditor.tsx (epic 07, S12).
 */

import { Tooltip } from "@base-ui/react";
import React from "react";

import type { TaskRow } from "@/lib/cells/types";

import type { FormulaConfig } from "./def";

interface FormulaCellProps {
  value: null;
  config: FormulaConfig;
  row: TaskRow;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function FormulaCellInner({ value: _value, config: _config, row: _row }: FormulaCellProps) {
  return (
    <Tooltip.Provider delay={400}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={<div />}
          className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] border border-[color:var(--color-border-strong)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden cursor-default"
          aria-label="Formula — coming soon"
        >
          <span className="text-sm text-[color:var(--color-fg-muted)]" aria-hidden="true">
            —
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={4}>
            <Tooltip.Popup className="rounded-md bg-[color:var(--color-fg-strong)] px-2 py-1 text-xs text-white shadow-sm z-[var(--z-popover)]">
              Formula columns coming soon
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

export const Cell = React.memo(FormulaCellInner);
Cell.displayName = "FormulaCell";
