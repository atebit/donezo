import { notFound } from "next/navigation";
import { BoardDataProvider } from "@/components/board/BoardDataProvider";
import { BoardHeader } from "@/components/board/BoardHeader";
import { ViewTabs } from "@/components/board/ViewTabs";
import { ViewToolbar } from "@/components/board/ViewToolbar";
import { requireUser } from "@/lib/auth/current-user";
import { getBoardRole } from "@/lib/authorization";
import { BoardProvider } from "@/lib/board-context";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { createView } from "./views/actions";

type Cell = Database["public"]["Tables"]["cell"]["Row"];
type AttachmentRow = Database["public"]["Tables"]["attachment"]["Row"];
type ViewRow = Database["public"]["Tables"]["view"]["Row"];

// ---------------------------------------------------------------------------
// Active-view resolution priority (Epic 11 §F.1, Q9):
//   1. lastViewId — profile.last_view_per_board[boardId], if readable.
//   2. Main table view — first view with is_shared=true, name="Main table".
//   3. First by position — absolute fallback.
//
// NOTE: The ?view= URL searchParam is a page-only concern — layouts in
// Next.js 15 do not receive searchParams. The client-side `useBoardView`
// hook handles ?view= resolution and overrides the store's activeViewId
// after hydration on the client.
// ---------------------------------------------------------------------------
function resolveActiveViewId(views: ViewRow[], lastViewId: string | undefined): string | null {
  if (lastViewId && views.some((v) => v.id === lastViewId)) {
    return lastViewId;
  }
  const mainTable = views.find((v) => v.is_shared && v.name === "Main table");
  if (mainTable) return mainTable.id;
  return views[0]?.id ?? null;
}

export default async function BoardLayout({
  params,
  children,
  modal,
}: {
  params: Promise<{ workspaceSlug: string; boardId: string }>;
  children: React.ReactNode;
  /** @modal parallel route slot — renders <TaskDrawerModalShell> when a task is open */
  modal: React.ReactNode;
}) {
  const { boardId, workspaceSlug } = await params;
  const supabase = await createClient();
  // requireUser is used by BoardHeader too; calling here ensures userId is available
  // for BoardProvider (consumed by useCursorBroadcast via useBoard — Epic 08 S6).
  const currentUser = await requireUser();

  const { data: board } = await supabase
    .from("board")
    .select("id, name, description, is_private, workspace_id, created_by, deleted_at")
    .eq("id", boardId)
    .is("deleted_at", null)
    .single();

  if (!board) notFound();

  const role = await getBoardRole(board.id);
  if (!role) notFound();

  const { data: starred } = await supabase
    .from("user_starred_board")
    .select("board_id")
    .eq("board_id", board.id)
    .maybeSingle();

  const isStarred = Boolean(starred);

  // ---------------------------------------------------------------------------
  // Round 1 — load groups, tasks, columns, views, and profile in parallel.
  // Notes:
  //   - `column` has no `deleted_at` column in the schema; omit that filter.
  //   - Views are RLS-filtered: shared + own personal + system (owner_id=null).
  //   - Profile fetch uses a type assertion for `last_view_per_board` because
  //     the Supabase types haven't been regenerated after Slice A's migration.
  // ---------------------------------------------------------------------------
  const [groupsResult, tasksResult, columnsResult, viewsResult, profileResult] = await Promise.all([
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
    // last_view_per_board was added by Slice A's migration; the types file
    // predates that regen, so we cast via `as unknown`.
    supabase
      .from("profile")
      .select("last_view_per_board")
      .eq("id", currentUser.id)
      .maybeSingle() as unknown as Promise<{
      data: { last_view_per_board: Record<string, string> | null } | null;
      error: { message: string } | null;
    }>,
  ]);

  if (groupsResult.error) throw groupsResult.error;
  if (tasksResult.error) throw tasksResult.error;
  if (columnsResult.error) throw columnsResult.error;
  if (viewsResult.error) throw viewsResult.error;
  // Profile fetch failure is non-fatal — we just won't restore the last view.

  const groups = groupsResult.data;
  const tasks = tasksResult.data;
  const columns = columnsResult.data;
  let views: ViewRow[] = viewsResult.data ?? [];

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
  // This is idempotent — once the view exists, subsequent loads skip.
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
  // Personal "My view" auto-create
  //
  // On first board open per user: if no personal view exists for this user,
  // create one. This is idempotent — subsequent loads skip because the row
  // will be present in the fetched views.
  //
  // Race safety: v1 accepts potential duplicate "My view" rows under tab-race
  // (Epic 11 risk note #7). No unique index — acceptable for v1.
  // ---------------------------------------------------------------------------
  const hasPersonalView = views.some((v) => v.owner_id === currentUser.id && !v.is_shared);
  if (!hasPersonalView) {
    const createPersonalResult = await createView({
      boardId,
      kind: "table",
      name: "My view",
      isShared: false,
      config: {},
    });
    if (createPersonalResult.ok) {
      views = [...views, createPersonalResult.data].sort((a, b) => a.position - b.position);
    }
  }

  // ---------------------------------------------------------------------------
  // Resolve the initial active view id.
  // Note: ?view= URL param resolution is handled client-side by useBoardView.
  // ---------------------------------------------------------------------------
  const initialActiveViewId = resolveActiveViewId(views, lastViewId);

  // ---------------------------------------------------------------------------
  // Round 2 — load cells and uploaded attachments in parallel.
  // ---------------------------------------------------------------------------
  const taskIds = tasks.map((t) => t.id);
  let cells: Cell[] = [];
  let attachments: AttachmentRow[] = [];

  if (taskIds.length > 0) {
    const [cellsResult, attachmentsResult] = await Promise.all([
      supabase.from("cell").select("*").in("task_id", taskIds),
      supabase.from("attachment").select("*").eq("board_id", boardId).eq("is_uploaded", true),
    ]);

    if (cellsResult.error) throw cellsResult.error;
    if (attachmentsResult.error) throw attachmentsResult.error;
    cells = cellsResult.data;
    attachments = attachmentsResult.data;
  }

  // The initial data blob passed to <BoardDataProvider>.
  const initial = {
    groups,
    tasks,
    cells,
    columns,
    attachments,
    views,
    activeViewId: initialActiveViewId,
    currentUserId: currentUser.id,
  };

  return (
    <BoardProvider
      board={board}
      role={role}
      isStarred={isStarred}
      userId={currentUser.id}
      workspaceSlug={workspaceSlug}
    >
      {/*
       * BoardDataProvider is a "use client" component mounted here in the RSC layout.
       * It hydrates the board store and mounts Realtime ONCE per boardId.
       *
       * Next.js App Router preserves the layout component tree across intra-board
       * kind navigation (table → kanban → etc). Because BoardDataProvider is mounted
       * in the layout — not in individual page components — it is NOT remounted when
       * the user switches between view kinds. This satisfies the "must NOT re-hydrate
       * on intra-board kind navigation" contract from the epic spec.
       */}
      <BoardDataProvider boardId={boardId} userId={currentUser.id} initial={initial}>
        <div className="flex flex-col h-full min-h-0">
          <BoardHeader boardId={board.id} />
          <ViewTabs />
          <ViewToolbar />
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">{children}</div>
        </div>
        {/* @modal slot — null when no task is open; <TaskDrawerModalShell> when intercepting */}
        {modal}
      </BoardDataProvider>
    </BoardProvider>
  );
}
