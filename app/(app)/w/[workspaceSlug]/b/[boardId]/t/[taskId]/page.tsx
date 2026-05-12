/**
 * Full-page task route — t/[taskId]/page.tsx
 *
 * Rendered on:
 *   - Direct URL navigation to /w/[slug]/b/[id]/t/[taskId]
 *   - Browser refresh while on that URL (intercepting route yields to this)
 *
 * Fetches: task + comments + reactions + activity + workspace members (for mentions).
 * Passes data into <TaskDrawer variant="full">.
 */

import { notFound } from "next/navigation";
import { TaskDrawer } from "@/components/board/TaskDrawer";
import type { MemberOption } from "@/components/comments/CommentEditor";
import { requireUser } from "@/lib/auth/current-user";
import { requireBoardRole } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; boardId: string; taskId: string }>;
}) {
  const { taskId } = await params;
  const supabase = await createClient();
  const currentUser = await requireUser();

  // Load task — board_id is denormalized on the task row
  const { data: task, error: taskError } = await supabase
    .from("task")
    .select("*, group:group_id(id, board_id)")
    .eq("id", taskId)
    .is("deleted_at", null)
    .single();

  if (taskError || !task) notFound();

  const boardId = task.board_id;

  // Verify caller has at least viewer access
  const boardRole = await requireBoardRole(boardId, "viewer");

  // Load board for workspace_id (needed for member mention list)
  const { data: board } = await supabase
    .from("board")
    .select("workspace_id")
    .eq("id", boardId)
    .is("deleted_at", null)
    .single();

  if (!board) notFound();

  // Parallel fetches: comments + activity + workspace members
  const [commentsRes, activityRes, membersRes] = await Promise.all([
    supabase
      .from("comment")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("activity")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("workspace_member")
      .select("user_id, profile:user_id(display_name, email, avatar_url)")
      .eq("workspace_id", board.workspace_id),
  ]);

  const comments = commentsRes.data ?? [];
  const activity = activityRes.data ?? [];

  // Second round-trip for reactions — needs comment ids (spec F.4 risk note 6)
  const commentIds = comments.map((c) => c.id);
  const reactionsRes = commentIds.length
    ? await supabase.from("comment_reaction").select("*").in("comment_id", commentIds)
    : { data: [] };

  const reactions = reactionsRes.data ?? [];

  // Map workspace members to MemberOption (MentionItem shape)
  const mentionableMembers: MemberOption[] = (membersRes.data ?? []).map((m) => {
    const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile;
    return {
      id: m.user_id,
      displayName: profile?.display_name ?? null,
      email: profile?.email ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    };
  });

  return (
    <div className="fixed top-0 right-0 h-screen" style={{ minWidth: 570 }}>
      <TaskDrawer
        taskId={taskId}
        task={task}
        comments={comments}
        reactions={reactions}
        activity={activity}
        mentionableMembers={mentionableMembers}
        currentUserId={currentUser.id}
        boardRole={boardRole}
        variant="full"
      />
    </div>
  );
}
