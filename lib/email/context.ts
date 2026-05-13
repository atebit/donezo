/**
 * lib/email/context.ts
 *
 * Service-role loader that fetches all data needed to render a notification email.
 * Templates are pure; all data lives here, not inside a template.
 *
 * Returns a structured context object that render-notification.ts passes into
 * the appropriate template.
 */

// biome-ignore lint/style/noRestrictedImports: service-role read for notification context.
import { adminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type NotificationRow = Database["public"]["Tables"]["notification"]["Row"];

export interface EmailContext {
  recipient: {
    id: string;
    email: string;
    displayName: string;
  };
  actor: {
    id: string;
    email: string | null;
    displayName: string;
  };
  board: {
    id: string;
    title: string;
    workspaceId: string;
    workspaceSlug: string;
  } | null;
  workspace: {
    id: string;
    name: string;
    slug: string;
  } | null;
  task: {
    id: string;
    title: string;
    boardId: string;
  } | null;
  comment: {
    id: string;
    /** Plain-text preview; max 200 chars. */
    preview: string;
  } | null;
}

/**
 * Loads all context required to render a notification email.
 * Uses the service-role client (bypasses RLS) — server-only.
 *
 * Data is fetched in parallel where possible.
 */
export async function loadEmailContext(
  notification: NotificationRow,
): Promise<EmailContext | null> {
  const admin = adminClient();
  const payload = notification.payload as Record<string, unknown>;

  // 1. Recipient profile (required).
  const { data: recipient } = await admin
    .from("profile")
    .select("id, email, display_name")
    .eq("id", notification.user_id)
    .maybeSingle();

  if (!recipient?.email) {
    // Can't send without a recipient email address.
    return null;
  }

  const actorId = (payload.actor_id as string | undefined) ?? null;
  const boardId = (payload.board_id as string | undefined) ?? null;
  const taskId = (payload.task_id as string | undefined) ?? null;
  const commentId = (payload.comment_id as string | undefined) ?? null;

  // 2. Parallel fetches: actor, board, task, comment.
  const [actorResult, boardResult, taskResult, commentResult] = await Promise.all([
    actorId
      ? admin.from("profile").select("id, email, display_name").eq("id", actorId).maybeSingle()
      : Promise.resolve({ data: null }),
    boardId
      ? admin.from("board").select("id, name, workspace_id").eq("id", boardId).maybeSingle()
      : Promise.resolve({ data: null }),
    taskId
      ? admin.from("task").select("id, title, board_id").eq("id", taskId).maybeSingle()
      : Promise.resolve({ data: null }),
    commentId
      ? admin.from("comment").select("id, body_text").eq("id", commentId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // 3. Workspace — load from board.workspace_id if available.
  const workspaceId =
    (boardResult.data?.workspace_id as string | undefined) ??
    (payload.workspace_id as string | undefined) ??
    null;

  const { data: workspace } = workspaceId
    ? await admin.from("workspace").select("id, name, slug").eq("id", workspaceId).maybeSingle()
    : { data: null };

  // 4. Build context.
  const actorProfile = actorResult.data;
  const boardData = boardResult.data;
  const taskData = taskResult.data;
  const commentData = commentResult.data;

  // Extract a plain-text comment preview (max 200 chars) using the pre-computed body_text.
  let commentPreview: string | null = null;
  if (commentData?.body_text) {
    const raw = commentData.body_text.trim();
    commentPreview = raw.length > 200 ? `${raw.slice(0, 197)}...` : raw;
  }

  return {
    recipient: {
      id: recipient.id,
      email: recipient.email,
      displayName: recipient.display_name ?? recipient.email,
    },
    actor: actorProfile
      ? {
          id: actorProfile.id,
          email: actorProfile.email ?? null,
          displayName: actorProfile.display_name ?? actorProfile.email ?? "Someone",
        }
      : { id: actorId ?? "unknown", email: null, displayName: "Someone" },
    board: boardData
      ? {
          id: boardData.id,
          title: boardData.name,
          workspaceId: boardData.workspace_id,
          workspaceSlug: workspace?.slug ?? boardData.workspace_id,
        }
      : null,
    workspace: workspace ? { id: workspace.id, name: workspace.name, slug: workspace.slug } : null,
    task: taskData ? { id: taskData.id, title: taskData.title, boardId: taskData.board_id } : null,
    comment:
      commentData && "id" in commentData
        ? { id: (commentData as { id: string }).id, preview: commentPreview ?? "" }
        : null,
  };
}
