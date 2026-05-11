"use client";

/**
 * TagsEditor — popover-content editor for the "tags" cell type.
 *
 * Renders inside a Base UI <Popover> managed by the orchestrator (S15).
 * This component is the popover CONTENT only — no <Popover.Root> here.
 *
 * Layout:
 *   - List of existing tags as chips with a × button to remove each.
 *   - Free-text input at the bottom with placeholder "Add tag…".
 *     Enter or comma commits the input as a new tag (if non-empty, trimmed).
 *   - Every list mutation emits onChange({ values: newList }).
 *   - No Save button — Esc closes (handled by the orchestrator's Popover).
 *
 * Contract:
 *   - NO Supabase imports. NO server-action calls.
 *   - Emit onChange(next) on every mutation.
 *   - onClose() is used only on explicit dismiss (not needed per-mutation).
 */

import { X } from "lucide-react";
import { useRef, useState } from "react";

import type { TagsCellValue } from "./def";

interface TagsEditorProps {
  value: TagsCellValue | null;
  config: Record<string, never>;
  onChange: (next: TagsCellValue | null) => void;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Editor({ value, config: _config, onChange, onClose: _onClose }: TagsEditorProps) {
  const [tags, setTags] = useState<string[]>(value?.values ?? []);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const emit = (next: string[]) => {
    setTags(next);
    onChange(next.length > 0 ? { values: next } : null);
  };

  const commitInput = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      emit([...tags, trimmed]);
    }
    setInput("");
  };

  const removeTag = (tag: string) => {
    emit(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitInput();
    }
    if (e.key === "Backspace" && input === "" && tags.length > 0) {
      emit(tags.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-col py-2" style={{ width: 240 }}>
      {/* Chip list */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 pb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-medium text-[color:var(--color-fg)]"
              style={{ backgroundColor: "var(--color-surface-hover)" }}
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => removeTag(tag)}
                className="flex items-center justify-center rounded-full hover:text-[color:var(--color-fg-strong)] text-[color:var(--color-fg-muted)] transition-colors duration-[var(--motion-fast)] cursor-pointer"
              >
                <X size={10} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add tag input */}
      <div className="px-2">
        <input
          ref={inputRef}
          // biome-ignore lint/a11y/noAutofocus: cell editor intentionally claims focus when opened by the orchestrator
          autoFocus
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add tag…"
          aria-label="Add new tag"
          className="w-full rounded-[var(--radius-xs)] border border-[color:var(--color-border-strong)] px-2 py-1 text-sm text-[color:var(--color-fg)] bg-[color:var(--color-surface)] placeholder:text-[color:var(--color-fg-muted)] outline-none focus:border-[color:var(--color-primary)] transition-colors duration-[var(--motion-fast)]"
        />
        <p className="mt-1 text-xs text-[color:var(--color-fg-muted)]">
          Press Enter or comma to add
        </p>
      </div>
    </div>
  );
}
