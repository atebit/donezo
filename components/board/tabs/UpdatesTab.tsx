"use client";

/**
 * UpdatesTab — the "Updates" (comments) tab in the task drawer.
 *
 * Renders <CommentComposer> at the top and <CommentList> below.
 * The shared composerRef enables Reply → quoteReply: clicking Reply on any
 * CommentItem calls composerRef.current.quoteReply(comment), which inserts
 * a blockquote in the composer and scrolls it into view.
 */

import { useRef } from "react";
import type { CommentComposerHandle } from "@/components/comments/CommentComposer";
import { CommentComposer } from "@/components/comments/CommentComposer";
import type { MemberOption } from "@/components/comments/CommentEditor";
import { CommentList } from "@/components/comments/CommentList";
import type { Role } from "@/lib/authorization";

interface UpdatesTabProps {
  taskId: string;
  boardId: string;
  currentUserId: string;
  boardRole: Role;
  mentionableMembers: MemberOption[];
  /** Profiles keyed by user id for display names + avatars. */
  profiles?: Map<
    string,
    { display_name: string | null; avatar_url: string | null; email: string | null }
  >;
}

export function UpdatesTab({
  taskId,
  boardId,
  currentUserId,
  boardRole,
  mentionableMembers,
  profiles,
}: UpdatesTabProps) {
  // Shared ref so CommentList's Reply button can call quoteReply on the composer
  const composerRef = useRef<CommentComposerHandle>(null);

  return (
    <div className="flex flex-col gap-4">
      <CommentComposer
        taskId={taskId}
        boardId={boardId}
        userId={currentUserId}
        mentionableMembers={mentionableMembers}
        composerRef={composerRef}
      />
      <CommentList
        taskId={taskId}
        boardId={boardId}
        currentUserId={currentUserId}
        boardRole={boardRole}
        mentionableMembers={mentionableMembers}
        profiles={profiles}
        composerRef={composerRef}
      />
    </div>
  );
}
