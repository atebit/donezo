"use client";

/**
 * GlobalSearchPalette — Cmd-K / Ctrl-K search palette.
 *
 * Visual spec (Epic 11 §G.1):
 * - Base UI Dialog, centered, ~640px wide.
 * - Border-radius: var(--radius-md).
 * - Shadow: var(--shadow-modal).
 * - Top: autofocus search input.
 * - Below: result list with "Boards" and "Tasks" sections.
 *   Each result row: 32px tall, 14px font, hover bg var(--color-surface-hover).
 * - Empty state when no query: "Type to search boards and tasks".
 * - No-results state: shown when query produced 0 results.
 *
 * Wired to `globalSearch({ workspaceId, q })` server action (Slice E), debounced 200ms.
 * Workspace id is derived from the WorkspaceContext via `useWorkspaceMaybe()`.
 * When outside a workspace route, the palette skips the search (no workspace id available).
 *
 * Keyboard nav:
 * - Arrow up/down to move through results.
 * - Enter to follow the highlighted result's link.
 * - Escape closes the palette (Base UI Dialog handles this natively).
 */

import { Dialog } from "@base-ui/react/dialog";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { globalSearch } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions";
import { useWorkspaceMaybe } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  kind: string; // "board" | "task"
  id: string;
  title: string;
  board_id: string;
  board_title: string;
}

interface GlobalSearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Small sub-components
// ---------------------------------------------------------------------------

function ResultRow({
  result,
  isHighlighted,
  workspaceSlug,
  onClose,
}: {
  result: SearchResult;
  isHighlighted: boolean;
  workspaceSlug: string;
  onClose: () => void;
}) {
  const href =
    result.kind === "board"
      ? `/w/${workspaceSlug}/b/${result.id}`
      : `/w/${workspaceSlug}/b/${result.board_id}/t/${result.id}`;

  return (
    <div role="option" aria-selected={isHighlighted} tabIndex={-1}>
      <Link
        href={href}
        onClick={onClose}
        tabIndex={-1} // keyboard nav handled by arrow keys; do not include in tab order
        data-cmdk-result-id={result.id}
        className={cn(
          "flex items-center gap-2 h-8 px-3 rounded cursor-pointer select-none",
          "text-sm text-[color:var(--color-fg)]",
          "hover:bg-[color:var(--color-surface-hover)]",
          isHighlighted && "bg-[color:var(--color-surface-hover)]",
        )}
      >
        <span className="truncate flex-1">{result.title}</span>
        {result.kind === "task" && (
          <span className="text-xs text-[color:var(--color-fg-muted)] truncate max-w-[40%]">
            {result.board_title}
          </span>
        )}
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GlobalSearchPalette({ isOpen, onClose }: GlobalSearchPaletteProps) {
  const workspaceCtx = useWorkspaceMaybe();
  const workspaceId = workspaceCtx?.workspace.id ?? null;
  const workspaceSlug = workspaceCtx?.workspace.slug ?? "";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [isPending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Clear state when palette closes.
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setHighlightIndex(-1);
    }
  }, [isOpen]);

  // Debounced search — 200ms per spec.
  const runSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!q.trim() || !workspaceId) {
        setResults([]);
        setHighlightIndex(-1);
        return;
      }
      debounceRef.current = setTimeout(() => {
        startTransition(async () => {
          try {
            const result = await globalSearch({ workspaceId, q: q.trim() });
            if (result.ok) {
              setResults(result.data ?? []);
              setHighlightIndex(-1);
            } else {
              setResults([]);
            }
          } catch {
            setResults([]);
          }
        });
      }, 200);
    },
    [workspaceId],
  );

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    runSearch(v);
  };

  // Keyboard navigation within the result list.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const total = results.length;
    if (total === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i - 1 + total) % total);
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      // Navigate via the highlighted item's anchor tag.
      // listRef is attached to the first non-empty section's container div.
      // We need to find the correct result by flat index.
      const allResults = results;
      const target = allResults[highlightIndex];
      if (target) {
        const anchor = document.querySelector(
          `[data-cmdk-result-id="${target.id}"]`,
        ) as HTMLAnchorElement | null;
        anchor?.click();
      }
    }
  };

  // Sections
  const boardResults = results.filter((r) => r.kind === "board");
  const taskResults = results.filter((r) => r.kind === "task");

  // Flat index helpers for keyboard highlight.
  const flatIndex = (kind: "board" | "task", localIdx: number): number => {
    if (kind === "board") return localIdx;
    return boardResults.length + localIdx;
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Backdrop
          className="fixed inset-0 bg-black/40 z-[var(--z-modal-backdrop,400)]"
          style={{ zIndex: 400 }}
        />

        {/* Palette container */}
        <Dialog.Popup
          data-cmdk-palette
          className={cn(
            "fixed top-[20vh] left-1/2 -translate-x-1/2",
            "w-full max-w-[640px]",
            "bg-[var(--color-surface)] rounded-[var(--radius-md)]",
            "shadow-[var(--shadow-modal)]",
            "border border-[color:var(--color-border-strong)]",
            "overflow-hidden",
            "outline-none",
          )}
          style={{ zIndex: 401 }}
          aria-label="Global search"
          onKeyDown={handleKeyDown}
        >
          {/* Search input row */}
          <div className="flex items-center gap-2 px-3 h-12 border-b border-[color:var(--color-border)]">
            <Search
              size={16}
              className="text-[color:var(--color-fg-muted)] flex-shrink-0"
              aria-hidden
            />
            <input
              ref={inputRef}
              // biome-ignore lint/a11y/noAutofocus: palette is intentionally autofocused on open
              autoFocus
              type="text"
              value={query}
              onChange={handleQueryChange}
              placeholder="Search boards and tasks…"
              className={cn(
                "flex-1 bg-transparent outline-none text-sm text-[color:var(--color-fg)]",
                "placeholder:text-[color:var(--color-fg-muted)]",
              )}
              aria-label="Search boards and tasks"
              aria-controls="cmdk-results"
              aria-autocomplete="list"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-activedescendant={
                highlightIndex >= 0 ? `cmdk-result-${highlightIndex}` : undefined
              }
            />
            {isPending && (
              <span className="text-xs text-[color:var(--color-fg-muted)] animate-pulse">
                Searching…
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "flex items-center justify-center w-6 h-6 rounded",
                "text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)]",
                "hover:bg-[color:var(--color-surface-hover)]",
              )}
              aria-label="Close search"
            >
              <X size={14} aria-hidden />
            </button>
          </div>

          {/* Results area */}
          <div
            id="cmdk-results"
            role="listbox"
            aria-label="Search results"
            className="max-h-[50vh] overflow-y-auto py-2"
          >
            {/* Empty / hint state */}
            {!query.trim() && (
              <p className="px-3 py-4 text-sm text-[color:var(--color-fg-muted)] text-center">
                Type to search boards and tasks
              </p>
            )}

            {/* No results */}
            {query.trim() && !isPending && results.length === 0 && (
              <p className="px-3 py-4 text-sm text-[color:var(--color-fg-muted)] text-center">
                No results for &ldquo;{query}&rdquo;
              </p>
            )}

            {/* Board results section */}
            {boardResults.length > 0 && (
              <section aria-label="Boards" className="mb-1">
                <p className="px-3 py-1 text-xs font-semibold text-[color:var(--color-fg-muted)] uppercase tracking-wide">
                  Boards
                </p>
                {/* biome-ignore lint/a11y/useSemanticElements: group role on div — no semantic equivalent for a generic grouping container inside a listbox */}
                <div ref={boardResults.length > 0 ? listRef : undefined} role="group">
                  {boardResults.map((r, i) => (
                    <ResultRow
                      key={r.id}
                      result={r}
                      isHighlighted={highlightIndex === flatIndex("board", i)}
                      workspaceSlug={workspaceSlug}
                      onClose={onClose}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Task results section */}
            {taskResults.length > 0 && (
              <section aria-label="Tasks">
                <p className="px-3 py-1 text-xs font-semibold text-[color:var(--color-fg-muted)] uppercase tracking-wide">
                  Tasks
                </p>
                {/* biome-ignore lint/a11y/useSemanticElements: group role on div — no semantic equivalent for a generic grouping container inside a listbox */}
                <div ref={taskResults.length > 0 ? listRef : undefined} role="group">
                  {taskResults.map((r, i) => (
                    <ResultRow
                      key={r.id}
                      result={r}
                      isHighlighted={highlightIndex === flatIndex("task", i)}
                      workspaceSlug={workspaceSlug}
                      onClose={onClose}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
