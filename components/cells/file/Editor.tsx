"use client";

/**
 * FileEditor — disabled stub editor for the "file" cell type.
 *
 * File attachment management is deferred to epic 10.
 * This editor renders a Base UI <Tooltip> wrapping a disabled affordance,
 * explaining the deferral. It is NOT a toast stub (guardrail #25 compliant).
 *
 * The editorMode is "inline" so the orchestrator (S15) renders this inline.
 * onChange is never called — the value is never mutated here.
 *
 * Contract:
 *   - NO Supabase imports. NO server-action calls. NO mutations.
 *   - onClose() is called immediately when the user dismisses the tooltip
 *     (or the orchestrator closes inline mode on blur/Esc).
 *
 * Tooltip follows the pattern from AddColumnButton.tsx (epic 06).
 */

import { Tooltip } from "@base-ui/react";
import { Paperclip } from "lucide-react";

import type { FileCellValue } from "./def";

interface FileEditorProps {
  value: FileCellValue | null;
  config: Record<string, never>;
  onChange: (next: FileCellValue | null) => void;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Editor({ value, config: _config, onChange: _onChange, onClose }: FileEditorProps) {
  const count = value?.attachmentIds.length ?? 0;

  return (
    <Tooltip.Provider delay={200}>
      <Tooltip.Root>
        <Tooltip.Trigger render={<span />} className="inline-flex" aria-disabled="true">
          {/* Disabled inline cell affordance */}
          <button
            type="button"
            disabled
            aria-disabled="true"
            aria-label="File attachments — coming in epic 10"
            onClick={onClose}
            className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center px-2 gap-1.5 border border-[color:var(--color-primary)] bg-[color:var(--color-surface)] overflow-hidden opacity-60 cursor-not-allowed"
          >
            <Paperclip
              size={14}
              aria-hidden="true"
              className="shrink-0 text-[color:var(--color-fg-muted)]"
            />
            <span className="text-sm tabular-nums text-[color:var(--color-fg-muted)]">
              {count > 0 ? count : "—"}
            </span>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={4}>
            <Tooltip.Popup className="rounded-md bg-[color:var(--color-fg-strong)] px-2 py-1 text-xs text-white shadow-sm z-[var(--z-popover)]">
              Coming in epic 10
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
