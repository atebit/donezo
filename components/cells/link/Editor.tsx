"use client";

/**
 * LinkEditor — popover with URL + optional label inputs for the "link" cell type.
 *
 * Contract:
 *   - Emit onChange({ url, label }) on commit (Save button or Enter in URL field).
 *   - Emit onClose() to signal the orchestrator to close.
 *   - Esc closes WITHOUT committing.
 *   - NO server-action calls. NO Supabase imports.
 */

import { Popover } from "@base-ui/react";
import { useState } from "react";

import type { LinkValue } from "./Cell";

interface LinkEditorProps {
  value: LinkValue | null;
  config: Record<string, never>;
  onChange: (next: LinkValue | null) => void;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Editor({ value, config: _config, onChange, onClose }: LinkEditorProps) {
  const [url, setUrl] = useState(value?.url ?? "");
  const [label, setLabel] = useState(value?.label ?? "");

  const commit = () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      onChange(null);
    } else {
      const trimmedLabel = label.trim();
      onChange(trimmedLabel ? { url: trimmedUrl, label: trimmedLabel } : { url: trimmedUrl });
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <Popover.Root
      defaultOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Popover.Trigger render={<span />} style={{ display: "none" }} aria-hidden="true" />
      <Popover.Portal>
        <Popover.Positioner sideOffset={0} align="start">
          <Popover.Popup
            className="z-[var(--z-popover)] bg-[color:var(--color-surface)] border border-[color:var(--color-border-strong)] rounded-[var(--radius-sm)] shadow-[var(--shadow-modal)] p-3 flex flex-col gap-2"
            style={{ minWidth: "var(--size-cell-w)", width: 280 }}
          >
            <div className="flex flex-col gap-1">
              <label
                htmlFor="link-editor-url"
                className="text-xs font-medium text-[color:var(--color-fg-muted)]"
              >
                URL
              </label>
              <input
                id="link-editor-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                // biome-ignore lint/a11y/noAutofocus: cell editor intentionally claims focus when opened by the orchestrator
                autoFocus
                placeholder="https://example.com"
                className="w-full h-8 px-2 text-sm text-[color:var(--color-fg)] border border-[color:var(--color-border-strong)] rounded-[var(--radius-xs)] outline-none focus:outline focus:outline-1 focus:outline-[color:var(--color-primary)] bg-[color:var(--color-surface)]"
                aria-label="URL"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="link-editor-label"
                className="text-xs font-medium text-[color:var(--color-fg-muted)]"
              >
                Label (optional)
              </label>
              <input
                id="link-editor-label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Display text"
                className="w-full h-8 px-2 text-sm text-[color:var(--color-fg)] border border-[color:var(--color-border-strong)] rounded-[var(--radius-xs)] outline-none focus:outline focus:outline-1 focus:outline-[color:var(--color-primary)] bg-[color:var(--color-surface)]"
                aria-label="Label (optional)"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 text-xs rounded-[var(--radius-xs)] border border-[color:var(--color-border-strong)] text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commit}
                className="px-3 py-1 text-xs rounded-[var(--radius-xs)] bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] hover:bg-[color:var(--color-primary-hover)]"
              >
                Save
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
