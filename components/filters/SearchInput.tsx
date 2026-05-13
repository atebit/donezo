"use client";

/**
 * SearchInput — in-board search field for the view toolbar.
 *
 * Visual contract (component-system §1.4 + design-system §14):
 *   - Collapsed width: 58px. On focus → animates to 140px over --motion-medium.
 *   - Cursor: pointer (collapsed) → text (focused).
 *   - Border: 0.5px solid var(--color-primary) on focus; transparent at rest.
 *   - Background: white (var(--color-surface)).
 *   - Height: 32px (toolbar button spec).
 *   - Font: 14px.
 *
 * Behavior:
 *   - 200ms debounce → emits via useBoardView().applyDraft({ search: q }).
 *   - Clears store's inBoardSearch when input is cleared.
 *   - Keyboard: `/` global keybinding focuses the input when the board is the
 *     focused surface (skipped when a non-search input/textarea/contenteditable
 *     owns focus).
 *
 * The store's `inBoardSearch` is the mirror; URL ?q is the source of truth.
 * Both are kept in sync via the hook (applyDraft → URL → hook effect → store).
 */

import { Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBoardView } from "@/hooks/use-board-view";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 200;

export function SearchInput() {
  const { effective, applyDraft } = useBoardView();
  const [localValue, setLocalValue] = useState(effective.search ?? "");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local value when the external effective.search changes (e.g. resetDraft).
  useEffect(() => {
    setLocalValue(effective.search ?? "");
  }, [effective.search]);

  // ---------------------------------------------------------------------------
  // Debounced emit
  // ---------------------------------------------------------------------------

  const emit = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        applyDraft({ search: q || undefined });
      }, DEBOUNCE_MS);
    },
    [applyDraft],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      setLocalValue(q);
      emit(q);
    },
    [emit],
  );

  const handleClear = useCallback(() => {
    setLocalValue("");
    applyDraft({ search: undefined });
    inputRef.current?.focus();
  }, [applyDraft]);

  // ---------------------------------------------------------------------------
  // `/` global keybinding — focus in-board search
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      // Skip if a text-input surface already owns focus.
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      const isContentEditable = (document.activeElement as HTMLElement)?.isContentEditable;
      if (tag === "input" || tag === "textarea" || isContentEditable) return;

      e.preventDefault();
      inputRef.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const hasValue = localValue.length > 0;

  return (
    <div
      className={cn(
        "relative flex items-center",
        "h-8 rounded",
        "transition-all duration-[var(--motion-medium,250ms)]",
        // Width: collapsed when empty+unfocused, expanded when focused or has value.
        isFocused || hasValue ? "w-[140px]" : "w-[58px]",
        "bg-[color:var(--color-surface,white)]",
        "border",
        isFocused
          ? "border-[0.5px] border-[color:var(--color-primary)]"
          : "border-[color:var(--color-border)]",
      )}
    >
      {/* Search icon */}
      <Search
        size={13}
        className={cn(
          "absolute left-2 flex-shrink-0",
          "text-[color:var(--color-fg-muted)]",
          "transition-colors duration-[var(--motion-base,150ms)]",
          isFocused && "text-[color:var(--color-primary)]",
        )}
        aria-hidden="true"
      />

      {/* Hidden label for accessibility */}
      <label htmlFor="in-board-search" className="sr-only">
        Search tasks
      </label>

      <input
        id="in-board-search"
        ref={inputRef}
        type="search"
        aria-label="Search tasks"
        value={localValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={isFocused ? "Search…" : ""}
        className={cn(
          "w-full h-full bg-transparent outline-none",
          "pl-6 pr-6 text-sm text-[color:var(--color-fg)]",
          "placeholder:text-[color:var(--color-fg-muted)]",
          // Cursor: pointer when collapsed (not focused), text when focused.
          isFocused ? "cursor-text" : "cursor-pointer",
          // Hide native search clear button (browser default).
          "[&::-webkit-search-cancel-button]:hidden",
        )}
        // Keyboard shortcut hint visible in placeholder only when focused.
        title={isFocused ? undefined : "Press / to search"}
      />

      {/* Clear button — shown when there's a value */}
      {hasValue && (
        <button
          type="button"
          onClick={handleClear}
          className={cn(
            "absolute right-1.5 flex items-center justify-center w-4 h-4",
            "rounded text-[color:var(--color-fg-muted)]",
            "hover:text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)]",
            "transition-colors duration-[var(--motion-base,150ms)] cursor-pointer",
          )}
          aria-label="Clear search"
          tabIndex={-1}
        >
          <X size={10} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
