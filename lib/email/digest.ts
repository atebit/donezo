/**
 * lib/email/digest.ts
 *
 * Builds the DigestData payload for a single user's digest email.
 *
 * Design decisions:
 *  - Service-role (adminClient) — this runs inside the cron route with no user session.
 *  - Fetches all pending digest rows (digested_at IS NULL, read_at IS NULL) for the
 *    user, filtering by kinds whose effective preference is 'digest'.
 *  - Groups rows by board. Caps each board section at MAX_ITEMS_PER_BOARD items
 *    and records the overflow in moreCount.
 *  - Returns null when the user has no pending rows (caller should skip send).
 *
 * Ownership: slice 2D. The DigestData type lives in lib/email/digest-types.ts (2C).
 */

import type { DigestData } from "@/lib/email/digest-types";
import { logger } from "@/lib/logger";
import { NOTIFICATION_KIND_LIST, type NotificationKind } from "@/lib/notifications/kinds";
import { getPreferenceFor } from "@/lib/notifications/preferences";
// biome-ignore lint/style/noRestrictedImports: service-role path for digest aggregation.
import { adminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type NotificationRow = Database["public"]["Tables"]["notification"]["Row"];

const MAX_ITEMS_PER_BOARD = 10;
const SITE_URL = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.donezo.app";

/**
 * Resolves which NotificationKinds should be rolled into the digest for a user.
 * A kind is "digest-eligible" when getPreferenceFor(userId, kind).email === 'digest'.
 *
 * This fetches one preference row and applies it across all kinds — the per-kind
 * loop is cheap (13 kinds) compared with a separate DB call per kind.
 */
async function resolveDigestKinds(userId: string): Promise<NotificationKind[]> {
  const digestKinds: NotificationKind[] = [];
  for (const kind of NOTIFICATION_KIND_LIST) {
    const pref = await getPreferenceFor(userId, kind);
    if (pref.email === "digest") {
      digestKinds.push(kind);
    }
  }
  return digestKinds;
}

/**
 * Builds the DigestData for the given userId.
 *
 * Returns null if:
 *  - The user has no profile or no email address.
 *  - There are no pending digest-eligible notifications.
 */
export async function buildDigest(userId: string): Promise<DigestData | null> {
  const admin = adminClient();

  // 1. Load recipient profile.
  const { data: profile } = await admin
    .from("profile")
    .select("id, email, display_name")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.email) {
    logger.warn({ userId }, "[buildDigest] no profile or email — skipping");
    return null;
  }

  // 2. Determine which kinds are digest-eligible for this user.
  const digestKinds = await resolveDigestKinds(userId);
  if (digestKinds.length === 0) {
    logger.debug({ userId }, "[buildDigest] no digest-eligible kinds — skipping");
    return null;
  }

  // 3. Fetch all pending digest rows.
  //    Conditions:
  //      - user_id = userId
  //      - digested_at IS NULL  (not yet included in a digest)
  //      - read_at IS NULL      (spec: include only unread)
  //      - kind IN (digestKinds)
  const { data: rows, error } = await admin
    .from("notification")
    .select("*")
    .eq("user_id", userId)
    .is("digested_at", null)
    .is("read_at", null)
    .in("kind", digestKinds)
    .order("created_at", { ascending: true });

  if (error) {
    logger.error({ userId, error }, "[buildDigest] failed to fetch notifications");
    return null;
  }

  if (!rows || rows.length === 0) {
    logger.debug({ userId }, "[buildDigest] no pending notifications");
    return null;
  }

  // 4. Collect the unique board IDs referenced in the payloads.
  const boardIdSet = new Set<string>();
  for (const row of rows) {
    const payload = row.payload as Record<string, unknown>;
    const boardId = payload.board_id as string | undefined;
    if (boardId) boardIdSet.add(boardId);
  }

  // 5. Batch-load board + workspace info.
  const boardIds = Array.from(boardIdSet);
  const boardMap = new Map<string, { id: string; title: string; workspaceSlug: string }>();

  if (boardIds.length > 0) {
    const { data: boards } = await admin
      .from("board")
      .select("id, name, workspace_id")
      .in("id", boardIds);

    if (boards && boards.length > 0) {
      const wsIds = [...new Set(boards.map((b) => b.workspace_id))];
      const { data: workspaces } = await admin.from("workspace").select("id, slug").in("id", wsIds);

      const wsSlugMap = new Map(workspaces?.map((w) => [w.id, w.slug]) ?? []);

      for (const board of boards) {
        boardMap.set(board.id, {
          id: board.id,
          title: board.name,
          workspaceSlug: wsSlugMap.get(board.workspace_id) ?? board.workspace_id,
        });
      }
    }
  }

  // 6. Batch-load task info.
  const taskIdSet = new Set<string>();
  for (const row of rows) {
    const payload = row.payload as Record<string, unknown>;
    const taskId = payload.task_id as string | undefined;
    if (taskId) taskIdSet.add(taskId);
  }

  const taskMap = new Map<string, { id: string; title: string }>();
  const taskIds = Array.from(taskIdSet);

  if (taskIds.length > 0) {
    const { data: tasks } = await admin.from("task").select("id, title").in("id", taskIds);

    for (const task of tasks ?? []) {
      taskMap.set(task.id, { id: task.id, title: task.title });
    }
  }

  // 7. Batch-load actor profiles.
  const actorIdSet = new Set<string>();
  for (const row of rows) {
    const payload = row.payload as Record<string, unknown>;
    const actorId = payload.actor_id as string | undefined;
    if (actorId) actorIdSet.add(actorId);
  }

  const actorMap = new Map<string, string>();
  const actorIds = Array.from(actorIdSet);

  if (actorIds.length > 0) {
    const { data: actors } = await admin
      .from("profile")
      .select("id, display_name, email")
      .in("id", actorIds);

    for (const actor of actors ?? []) {
      actorMap.set(actor.id, actor.display_name ?? actor.email ?? "Someone");
    }
  }

  // 8. Group notifications by board.
  const boardGroups = new Map<string, NotificationRow[]>();

  for (const row of rows) {
    const payload = row.payload as Record<string, unknown>;
    const boardId = (payload.board_id as string | undefined) ?? "__no_board__";
    if (!boardGroups.has(boardId)) boardGroups.set(boardId, []);
    boardGroups.get(boardId)?.push(row);
  }

  // 9. Build count tallies.
  let mentions = 0;
  let statusChanges = 0;
  let assigned = 0;
  let commentsOnFollowed = 0;

  for (const row of rows) {
    const kind = row.kind as NotificationKind;
    if (kind === "mention") mentions++;
    else if (kind === "assigned") assigned++;
    else if (
      kind === "status_changed_assigned" ||
      kind === "status_changed_followed" ||
      kind === "status_changed"
    )
      statusChanges++;
    else if (kind === "comment_on_followed") commentsOnFollowed++;
  }

  // 10. Build sections.
  const siteUrl = SITE_URL();
  const sections: DigestData["sections"] = [];

  for (const [boardId, boardRows] of boardGroups) {
    if (boardId === "__no_board__") continue;

    const board = boardMap.get(boardId);
    if (!board) continue; // Board deleted or inaccessible — skip.

    const capped = boardRows.slice(0, MAX_ITEMS_PER_BOARD);
    const moreCount = boardRows.length - capped.length;

    const items: DigestData["sections"][number]["items"] = capped.map((row) => {
      const payload = row.payload as Record<string, unknown>;
      const actorId = payload.actor_id as string | undefined;
      const taskId = payload.task_id as string | undefined;
      const task = taskId ? taskMap.get(taskId) : undefined;
      const actorName = actorId ? (actorMap.get(actorId) ?? "Someone") : "Someone";

      const href = task
        ? `${siteUrl}/w/${board.workspaceSlug}/b/${boardId}/t/${task.id}`
        : `${siteUrl}/w/${board.workspaceSlug}/b/${boardId}`;

      return {
        id: row.id,
        kind: row.kind as NotificationKind,
        actor: { name: actorName },
        task: { id: task?.id ?? "", title: task?.title ?? "" },
        createdAt: row.created_at,
        href,
      };
    });

    sections.push({ board, items, moreCount });
  }

  const digestData: DigestData = {
    recipient: {
      displayName: profile.display_name ?? profile.email,
      email: profile.email,
    },
    counts: {
      mentions,
      statusChanges,
      assigned,
      commentsOnFollowed,
      total: rows.length,
    },
    sections,
    generatedAt: new Date().toISOString(),
  };

  return digestData;
}
