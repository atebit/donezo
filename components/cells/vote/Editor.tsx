"use client";

/**
 * VoteEditor — inline editor for the "vote" cell type.
 *
 * Contract:
 *   - Receives the optional `currentUserId` prop from the orchestrator (S15).
 *   - When invoked (rendered), immediately toggles the current user's id in the
 *     userIds array, emits onChange({ userIds: newArray }), then calls onClose().
 *   - If currentUserId is null/undefined: no-op + onClose() (documents the
 *     fallback so S15 can later wire the user id without breaking the contract).
 *   - NO Supabase imports. NO server-action calls.
 *
 * Interaction model (per spec decision):
 *   Cell is read-only. Clicking it causes the orchestrator to mount this Editor.
 *   The Editor renders a ThumbsUp button; upon mount it triggers the toggle
 *   immediately via a button click (the button is auto-focused). This keeps the
 *   contract clean: Cell displays, Editor mutates-and-closes.
 *
 * Note: the auto-toggle-on-mount approach uses a useEffect to fire the toggle
 * immediately when the editor opens, matching the "click → toggle → close"
 * pattern described in the spec.
 */

import { ThumbsUp } from "lucide-react";
import { useEffect, useRef } from "react";

import type { VoteCellValue } from "./def";

interface VoteEditorProps {
  value: VoteCellValue | null;
  config: Record<string, never>;
  onChange: (next: VoteCellValue | null) => void;
  onClose: () => void;
  /**
   * The current user's id, provided by the orchestrator (S15).
   * When absent or null, the editor is a no-op — closes without mutation.
   * Documented fallback: S15 should pass this; S12 degrades gracefully.
   */
  currentUserId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Editor({
  value,
  config: _config,
  onChange,
  onClose,
  currentUserId,
}: VoteEditorProps) {
  const hasToggled = useRef(false);

  useEffect(() => {
    if (hasToggled.current) return;
    hasToggled.current = true;

    if (!currentUserId) {
      // No user id available — close without mutation (documented fallback).
      onClose();
      return;
    }

    const current = value?.userIds ?? [];
    const hasVoted = current.includes(currentUserId);
    const next = hasVoted
      ? current.filter((id) => id !== currentUserId)
      : [...current, currentUserId];

    onChange(next.length > 0 ? { userIds: next } : null);
    onClose();
  }, [currentUserId, value, onChange, onClose]);

  // Render a minimal visible affordance while the effect fires.
  // In practice this renders for one frame before onClose() is called.
  const count = value?.userIds.length ?? 0;
  const hasVoted = currentUserId ? (value?.userIds.includes(currentUserId) ?? false) : false;

  return (
    <div
      role="img"
      aria-label={hasVoted ? "Remove vote" : "Add vote"}
      className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center px-2 gap-1.5 border border-[color:var(--color-primary)] bg-[color:var(--color-surface)] overflow-hidden"
    >
      <ThumbsUp
        size={14}
        aria-hidden="true"
        className="shrink-0"
        style={{ color: hasVoted ? "var(--color-primary)" : "var(--color-fg-muted)" }}
      />
      <span
        className="text-sm tabular-nums"
        style={{ color: count > 0 ? "var(--color-fg)" : "var(--color-fg-muted)" }}
      >
        {count}
      </span>
    </div>
  );
}
