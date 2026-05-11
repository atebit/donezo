"use client";

/**
 * LongTextEditor — popover-content textarea for the "long_text" cell type.
 *
 * Per Q11: Tiptap is NOT installed for this epic. Ships as a multi-line
 * `<textarea>`. The `config.richText` flag is registered as `false` for v1;
 * when Tiptap lands (epic 09), flipping it to `true` will swap the editor.
 *
 * This component is the popover CONTENT only — no <Popover.Root> here.
 * The orchestrator (<CellEditor />, S15) wraps it with <Popover.Root>.
 *
 * Contract:
 *   - Emit onChange(value) on commit (Cmd/Ctrl+Enter or "Save" button).
 *   - Emit onClose() to signal the orchestrator to close.
 *   - Esc closes WITHOUT committing (handled by the orchestrator's Popover).
 *   - NO server-action calls. NO Supabase imports.
 */

import { useState } from "react";

interface LongTextEditorProps {
  value: string | null;
  config: { richText: boolean };
  onChange: (next: string | null) => void;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Editor({ value, config: _config, onChange, onClose }: LongTextEditorProps) {
  const [draft, setDraft] = useState(value ?? "");

  const commit = () => {
    const next = draft.trim();
    onChange(next === "" ? null : next);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="flex flex-col gap-2 p-2" style={{ minWidth: "var(--size-cell-w)", width: 280 }}>
      <textarea
        rows={4}
        // biome-ignore lint/a11y/noAutofocus: cell editor intentionally claims focus when opened by the orchestrator
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full resize-none text-sm text-[color:var(--color-fg)] border border-[color:var(--color-border-strong)] rounded-[var(--radius-xs)] p-2 outline-none focus:outline focus:outline-1 focus:outline-[color:var(--color-primary)] bg-[color:var(--color-surface)]"
        placeholder="Enter text…"
        aria-label="Edit long text"
      />
      <div className="flex justify-end gap-2">
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
    </div>
  );
}
