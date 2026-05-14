"use client";

import { useEffect, useRef, useState } from "react";
import { CommentComposer, type CommentComposerHandle } from "@/components/comments/CommentComposer";
import { CommentList } from "@/components/comments/CommentList";
import type { MemberOption } from "@/components/comments/CommentEditor";
import { useBoard } from "@/hooks/use-board";
import { createClient } from "@/lib/supabase/client";
import { useBoardStore } from "@/stores/board-store";

interface UpdatesTabProps {
  taskId: string;
}

export function UpdatesTab({ taskId }: UpdatesTabProps) {
  const { board, userId, role } = useBoard();
  const boardId = board.id;

  const hydrateCommentsForTask = useBoardStore((s) => s.hydrateCommentsForTask);
  const hydrateReactionsForComments = useBoardStore((s) => s.hydrateReactionsForComments);
  const composerRef = useRef<CommentComposerHandle>(null);

  const [mentionableMembers, setMentionableMembers] = useState<MemberOption[]>([]);
  const [profiles, setProfiles] = useState<
    Map<string, { display_name: string | null; avatar_url: string | null; email: string | null }>
  >(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      setLoading(true);

      const [commentsRes, membersRes] = await Promise.all([
        supabase
          .from("comment")
          .select("*")
          .eq("task_id", taskId)
          .order("created_at", { ascending: true }),

        supabase
          .from("workspace_member")
          .select("user_id, profile:user_id(display_name, email, avatar_url)")
          .eq("workspace_id", board.workspace_id),
      ]);

      if (cancelled) return;

      // Hydrate comments into store
      if (commentsRes.data && commentsRes.data.length > 0) {
        // Fetch reactions for these comments
        const commentIds = commentsRes.data.map((c) => c.id);
        const reactionsRes = await supabase
          .from("comment_reaction")
          .select("*")
          .in("comment_id", commentIds);

        if (!cancelled) {
          hydrateCommentsForTask(taskId, commentsRes.data);
          if (reactionsRes.data) {
            hydrateReactionsForComments(reactionsRes.data);
          }
        }
      } else if (commentsRes.data) {
        hydrateCommentsForTask(taskId, []);
      }

      // Build mentionable members
      if (membersRes.data) {
        const members = (
          membersRes.data as unknown as Array<{
            user_id: string;
            profile: {
              display_name: string | null;
              email: string | null;
              avatar_url: string | null;
            } | null;
          }>
        ).map((m) => ({
          id: m.user_id,
          displayName: m.profile?.display_name ?? null,
          email: m.profile?.email ?? null,
          avatarUrl: m.profile?.avatar_url ?? null,
        }));

        setMentionableMembers(members);
        setProfiles(
          new Map(
            members.map((m) => [
              m.id,
              {
                display_name: m.displayName,
                avatar_url: m.avatarUrl,
                email: m.email,
              },
            ]),
          ),
        );
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [taskId, board.workspace_id, hydrateCommentsForTask, hydrateReactionsForComments]);

  return (
    <div className="flex flex-col gap-4">
      <CommentComposer
        taskId={taskId}
        boardId={boardId}
        userId={userId}
        mentionableMembers={mentionableMembers}
        composerRef={composerRef}
      />
      {!loading && (
        <CommentList
          taskId={taskId}
          boardId={boardId}
          currentUserId={userId}
          boardRole={role}
          mentionableMembers={mentionableMembers}
          profiles={profiles}
          composerRef={composerRef}
        />
      )}
    </div>
  );
}
