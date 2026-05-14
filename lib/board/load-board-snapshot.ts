/**
 * loadBoardSnapshot — server-only helper that fetches the full board data set
 * used by every per-kind page (table, kanban, calendar, timeline, dashboard, form).
 *
 * Single source of truth for the Promise.all that was previously inlined in
 * `[boardId]/page.tsx`. Each per-kind page.tsx calls this helper and passes
 * the result as `initial` to its kind-specific container component.
 *
 * WorkspaceMember notes (risk note #14):
 *   The Kanban view needs workspace members to build person lanes.
 *   `loadBoardSnapshot` fetches them here once so every kind has them available.
 *   The join returns `{ user_id, display_name, email, avatar_url }`.
 */

import { createView } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/views/actions";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Cell = Database["public"]["Tables"]["cell"]["Row"];
type AttachmentRow = Database["public"]["Tables"]["attachment"]["Row"];
type ViewRow = Database["public"]["Tables"]["view"]["Row"];
type Group = Database["public"]["Tables"]["group"]["Row"];
type Task = Database["public"]["Tables"]["task"]["Row"];
type Column = Database["public"]["Tables"]["column"]["Row"];

export type WorkspaceMemberWithProfile = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

export type BoardSnapshot = {
  groups: Group[];
  tasks: Task[];
  cells: Cell[];
  columns: Column[];
  attachments: AttachmentRow[];
  views: ViewRow[];
  activeViewId: string | null;
  currentUserId: string;
  /** Workspace members — consumed by Kanban (person-grouping) and cell editors. */
  workspaceMembers: WorkspaceMemberWithProfile[];
};

// ---------------------------------------------------------------------------
// Active-view resolution priority (Epic 11 §F.1, Q9):
//   1. searchParams.view  — if that view id appears in the fetched views.
//   2. lastViewId         — profile.last_view_per_board[boardId], if readable.
//   3. Main table view    — first view with is_shared=true, name="Main table".
//   4. First by position  — absolute fallback.
// ---------------------------------------------------------------------------
function resolveActiveViewId(
  views: ViewRow[],
  searchParamViewId: string | undefined,
  lastViewId: string | undefined,
): string | null {
  const viewSet = new Set(views.map((v) => v.id));

  if (searchParamViewId && viewSet.has(searchParamViewId)) {
    return searchParamViewId;
  }
  if (lastViewId && viewSet.has(lastViewId)) {
    return lastViewId;
  }
  const mainTable = views.find((v) => v.is_shared && v.name === "Main table");
  if (mainTable) return mainTable.id;
  return views[0]?.id ?? null;
}

export async function loadBoardSnapshot(args: {
  boardId: string;
  searchParamViewId: string | undefined;
}): Promise<BoardSnapshot> {
  const { boardId, searchParamViewId } = args;
  const supabase = await createClient();
  const currentUser = await requireUser();

  // ---------------------------------------------------------------------------
  // Round 1 — load groups, tasks, columns, views, profile, and the board's
  // workspace_id (needed to fetch workspace members) in parallel.
  // ---------------------------------------------------------------------------
  const [groupsResult, tasksResult, columnsResult, viewsResult, profileResult, boardResult] =
    await Promise.all([
      supabase
        .from("group")
        .select("*")
        .eq("board_id", boardId)
        .is("deleted_at", null)
        .order("position", { ascending: true }),

      supabase
        .from("task")
        .select("*")
        .eq("board_id", boardId)
        .is("deleted_at", null)
        .order("position", { ascending: true }),

      supabase
        .from("column")
        .select("*")
        .eq("board_id", boardId)
        .order("position", { ascending: true }),

      supabase
        .from("view")
        .select("*")
        .eq("board_id", boardId)
        .order("position", { ascending: true }),

      // Fetch the profile for last_view_per_board.
      supabase
        .from("profile")
        .select("last_view_per_board")
        .eq("id", currentUser.id)
        .maybeSingle() as unknown as Promise<{
        data: { last_view_per_board: Record<string, string> | null } | null;
        error: { message: string } | null;
      }>,

      // Fetch workspace_id from the board row.
      supabase.from("board").select("workspace_id").eq("id", boardId).single(),
    ]);

  if (groupsResult.error) throw groupsResult.error;
  if (tasksResult.error) throw tasksResult.error;
  if (columnsResult.error) throw columnsResult.error;
  if (viewsResult.error) throw viewsResult.error;
  if (boardResult.error) throw boardResult.error;

  const groups = groupsResult.data;
  const tasks = tasksResult.data;
  const columns = columnsResult.data;
  let views: ViewRow[] = viewsResult.data ?? [];
  const workspaceId = boardResult.data.workspace_id;

  const lastViewPerBoard = profileResult.data?.last_view_per_board ?? null;
  const lastViewId: string | undefined =
    lastViewPerBoard && typeof lastViewPerBoard === "object"
      ? (lastViewPerBoard[boardId] ?? undefined)
      : undefined;

  // ---------------------------------------------------------------------------
  // Shared "Main table" fallback for legacy boards
  //
  // Boards created before Slice A's `create_board` patch have no shared table
  // view. Detect and auto-create one so the board is always functional.
  // ---------------------------------------------------------------------------
  const hasSharedTableView = views.some((v) => v.is_shared && v.kind === "table");
  if (!hasSharedTableView) {
    const createMainResult = await createView({
      boardId,
      kind: "table",
      name: "Main table",
      isShared: true,
      config: {},
    });
    if (createMainResult.ok) {
      views = [...views, createMainResult.data].sort((a, b) => a.position - b.position);
    }
  }

  // ---------------------------------------------------------------------------
  // Resolve the initial active view id.
  // ---------------------------------------------------------------------------
  const activeViewId = resolveActiveViewId(views, searchParamViewId, lastViewId);

  // ---------------------------------------------------------------------------
  // Round 2 — load cells, attachments, and workspace members in parallel.
  // ---------------------------------------------------------------------------
  const taskIds = tasks.map((t) => t.id);
  let cells: Cell[] = [];
  let attachments: AttachmentRow[] = [];
  let workspaceMembers: WorkspaceMemberWithProfile[] = [];

  // Build round-2 queries as real Promises via async wrappers.
  const fetchMembers = async () => {
    const res = await supabase
      .from("workspace_member")
      .select("user_id, profile:user_id(display_name, email, avatar_url)")
      .eq("workspace_id", workspaceId);
    if (!res.error && res.data) {
      workspaceMembers = (
        res.data as unknown as Array<{
          user_id: string;
          profile: {
            display_name: string | null;
            email: string | null;
            avatar_url: string | null;
          } | null;
        }>
      ).map((m) => ({
        user_id: m.user_id,
        display_name: m.profile?.display_name ?? null,
        email: m.profile?.email ?? null,
        avatar_url: m.profile?.avatar_url ?? null,
      }));
    }
  };

  const fetchCells = async () => {
    if (taskIds.length === 0) return;
    const res = await supabase.from("cell").select("*").in("task_id", taskIds);
    if (res.error) throw res.error;
    cells = res.data ?? [];
  };

  const fetchAttachments = async () => {
    if (taskIds.length === 0) return;
    const res = await supabase
      .from("attachment")
      .select("*")
      .eq("board_id", boardId)
      .eq("is_uploaded", true);
    if (res.error) throw res.error;
    attachments = res.data ?? [];
  };

  await Promise.all([fetchMembers(), fetchCells(), fetchAttachments()]);

  return {
    groups,
    tasks,
    cells,
    columns,
    attachments,
    views,
    activeViewId,
    currentUserId: currentUser.id,
    workspaceMembers,
  };
}
