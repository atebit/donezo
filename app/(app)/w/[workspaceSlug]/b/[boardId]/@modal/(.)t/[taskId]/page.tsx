/**
 * Intercepting route — @modal/(.)t/[taskId]/page.tsx
 *
 * Intercepts in-board navigation to /t/[taskId] and renders the task drawer
 * in a slide-in modal shell over the board page, without doing a full navigation.
 *
 * The (.)-prefix tells Next.js to intercept one level up (the board route level).
 * Browser refresh on /t/[taskId] bypasses this intercepting route and hits the
 * full-page route at t/[taskId]/page.tsx instead.
 *
 * Same server-side data fetch as the full-page route (spec F.4).
 */

import { notFound } from "next/navigation";
import { TaskDrawerModalShell } from "@/components/board/TaskDrawerModalShell";
import type { MemberOption } from "@/components/comments/CommentEditor";
import { requireUser } from "@/lib/auth/current-user";
import { requireBoardRole } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";

export default async function InterceptedTaskPage({
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

  // Parallel fetches: comments + activity + workspace members + attachments
  const [commentsRes, activityRes, membersRes, attachmentsRes] = await Promise.all([
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
    supabase
      .from("attachment")
      .select("*")
      .eq("task_id", taskId)
      .eq("is_uploaded", true)
      .order("created_at", { ascending: true }),
  ]);

  const comments = commentsRes.data ?? [];
  const activity = activityRes.data ?? [];
  const attachments = attachmentsRes.data ?? [];

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
    <TaskDrawerModalShell
      taskId={taskId}
      task={task}
      comments={comments}
      reactions={reactions}
      activity={activity}
      attachments={attachments}
      mentionableMembers={mentionableMembers}
      currentUserId={currentUser.id}
      boardRole={boardRole}
    />
  );
}
