"use client";

/**
 * CommentList — flat list of comments for a task.
 *
 * Behavior (dispatch D.1):
 *   - Reads selectCommentsForTask(state, taskId) from the board store (Slice C).
 *   - Renders one <CommentItem /> per comment — flat list, no threading (Q1).
 *   - Reads ?comment=<id> from useSearchParams to scroll + highlight the target.
 *   - 2-second highlight wash using bg-[color:var(--color-primary-selected)].
 *   - V1 ships first 50 comments (initial server hydrate). Pagination deferred.
 *
 * URL-linkable comments: the parent (Slice F's TaskDrawer) hydrates the store via
 * hydrateCommentsForTask on mount; this component then reads from the store.
 */

import { useSearchParams } from "next/navigation";
import type React from "react";
import { useEffect, useRef } from "react";
import type { Role } from "@/lib/authorization";
import type { Database } from "@/lib/supabase/types";
import { selectCommentsForTask, useBoardStore } from "@/stores/board-store";
import { type CommentComposerHandle, CommentItem, type MemberOption } from "./CommentItem";

type _ProfileRow = Database["public"]["Tables"]["profile"]["Row"];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CommentListProps {
  taskId: string;
  boardId: string;
  currentUserId: string;
  boardRole: Role;
  mentionableMembers: MemberOption[];
  /** Profiles keyed by user id for resolving display names. */
  profiles?:
    | Map<string, { display_name: string | null; avatar_url: string | null; email: string | null }>
    | undefined;
  /** Ref to the composer (Slice F) so Reply can call quoteReply. */
  composerRef?: React.RefObject<CommentComposerHandle | null> | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommentList({
  taskId,
  boardId,
  currentUserId,
  boardRole,
  mentionableMembers,
  profiles,
  composerRef,
}: CommentListProps) {
  const searchParams = useSearchParams();
  const targetCommentId = searchParams.get("comment");
  const scrolledRef = useRef<string | null>(null);

  // Read comments from store — selectCommentsForTask returns oldest-first.
  const comments = useBoardStore((s) => selectCommentsForTask(s, taskId));

  // Scroll-to + highlight on ?comment=<id>
  useEffect(() => {
    if (!targetCommentId) return;
    if (scrolledRef.current === targetCommentId) return; // already handled
    scrolledRef.current = targetCommentId;

    const el = document.getElementById(`comment-${targetCommentId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [targetCommentId]);

  if (comments.length === 0) {
    return (
      <div className="text-center text-fg-muted text-sm py-8" data-testid="comment-list-empty">
        No comments yet. Be the first to write an update!
      </div>
    );
  }

  return (
    <section className="flex flex-col" data-testid="comment-list" aria-label="Comments">
      {comments.map((comment) => {
        const isAuthor = comment.author_id === currentUserId;
        const canDelete = isAuthor || boardRole === "admin" || boardRole === "owner";

        return (
          <CommentItem
            key={comment.id}
            comment={comment}
            boardId={boardId}
            currentUserId={currentUserId}
            isAuthor={isAuthor}
            canDelete={canDelete}
            mentionableMembers={mentionableMembers}
            profiles={profiles}
            composerRef={composerRef}
            isHighlighted={comment.id === targetCommentId}
          />
        );
      })}
    </section>
  );
}
