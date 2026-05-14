"use client";

/**
 * CommentReactions — grouped emoji reaction chips + add-reaction trigger.
 *
 * Visual spec (dispatch D.3):
 *   - Self-reacted chip: bg var(--color-primary-selected), outline 1px solid var(--color-primary).
 *   - Other chip: bg var(--color-surface-hover).
 *   - Chip padding: 2px 6px, radius 12px.
 *   - "+" trigger opens <ReactionPicker />.
 *
 * Optimistic mutations:
 *   - Click self-reacted chip → applyReactionDelete + unreactComment server action.
 *   - Click other chip → applyReactionInsert + reactComment server action.
 *   - Picker onSelect → applyReactionInsert + reactComment server action.
 */

import { Plus } from "lucide-react";
import { useCallback, useMemo, useTransition } from "react";
import { toast } from "sonner";
// Server actions — from Slice A
import {
  reactComment,
  unreactComment,
} from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions";
import { cn } from "@/lib/utils";
import { selectReactionsForComment, useBoardStore } from "@/stores/board-store";
import type { CommentReactionRow } from "@/stores/types/comments";
import { ReactionPicker } from "./ReactionPicker";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CommentReactionsProps {
  commentId: string;
  boardId: string;
  currentUserId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommentReactions({ commentId, boardId, currentUserId }: CommentReactionsProps) {
  const [, startTransition] = useTransition();

  // Read raw reactions — stable reference from the store Map (no new array per render).
  const reactions = useBoardStore((s) => selectReactionsForComment(s, commentId));

  // Derive grouped data in useMemo so we only recompute when reactions change.
  const grouped = useMemo(() => {
    const map = new Map<string, { count: number; selfReacted: boolean }>();
    for (const r of reactions) {
      const entry = map.get(r.emoji) ?? { count: 0, selfReacted: false };
      entry.count += 1;
      if (r.user_id === currentUserId) entry.selfReacted = true;
      map.set(r.emoji, entry);
    }
    return Array.from(map.entries()).map(([emoji, { count, selfReacted }]) => ({
      emoji,
      count,
      selfReacted,
    }));
  }, [reactions, currentUserId]);

  // Store mutation actions (Slice C).
  const applyReactionInsert = useBoardStore((s) => s.applyReactionInsert);
  const applyReactionDelete = useBoardStore((s) => s.applyReactionDelete);

  // ---------------------------------------------------------------------------
  // Optimistic helpers
  // ---------------------------------------------------------------------------

  const handleReact = useCallback(
    (emoji: string) => {
      const optimisticRow: CommentReactionRow = {
        comment_id: commentId,
        user_id: currentUserId,
        emoji,
        board_id: boardId,
        created_at: new Date().toISOString(),
      };
      // Optimistic insert
      applyReactionInsert(optimisticRow);
      // Server action (best-effort; Realtime echo reconciles)
      startTransition(async () => {
        const result = await reactComment({ commentId, emoji });
        if (!result.ok) {
          // Roll back optimistic insert
          applyReactionDelete(commentId, currentUserId, emoji);
          toast.error("Failed to add reaction");
        }
      });
    },
    [commentId, currentUserId, boardId, applyReactionInsert, applyReactionDelete],
  );

  const handleUnreact = useCallback(
    (emoji: string) => {
      // Optimistic delete
      applyReactionDelete(commentId, currentUserId, emoji);
      // Server action (best-effort)
      startTransition(async () => {
        const result = await unreactComment({ commentId, emoji });
        if (!result.ok) {
          // Roll back optimistic delete
          applyReactionInsert({
            comment_id: commentId,
            user_id: currentUserId,
            emoji,
            board_id: boardId,
            created_at: new Date().toISOString(),
          });
          toast.error("Failed to remove reaction");
        }
      });
    },
    [commentId, currentUserId, boardId, applyReactionInsert, applyReactionDelete],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const addButton = (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-[12px] px-[6px] py-[2px]",
        "bg-[color:var(--color-surface-hover)] hover:bg-[color:var(--color-primary-selected)]",
        "text-fg-muted hover:text-fg transition-colors cursor-pointer",
      )}
      aria-label="Add reaction"
      data-testid="add-reaction-button"
    >
      <Plus size={14} aria-hidden="true" />
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="comment-reactions">
      {grouped.map(({ emoji, count, selfReacted }) => (
        <button
          key={emoji}
          type="button"
          onClick={() => (selfReacted ? handleUnreact(emoji) : handleReact(emoji))}
          className={cn(
            "inline-flex items-center gap-1 rounded-[12px] px-[6px] py-[2px] text-sm",
            "transition-colors cursor-pointer select-none",
            selfReacted
              ? "bg-[color:var(--color-primary-selected)] outline outline-1 outline-[color:var(--color-primary)]"
              : "bg-[color:var(--color-surface-hover)] hover:bg-[color:var(--color-primary-selected)]",
          )}
          aria-label={`${emoji} reaction${count > 1 ? `, ${count} people` : ""}${selfReacted ? ", remove reaction" : ", add reaction"}`}
          aria-pressed={selfReacted}
          data-testid={`reaction-chip-${emoji}`}
        >
          <span aria-hidden="true">{emoji}</span>
          <span className="text-xs font-medium text-fg">{count}</span>
        </button>
      ))}

      <ReactionPicker onSelect={handleReact} trigger={addButton} />
    </div>
  );
}
