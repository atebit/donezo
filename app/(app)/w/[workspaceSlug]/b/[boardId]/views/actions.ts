"use server";

// No revalidatePath calls — the board page is mostly client-side.
// The useBoardView hook re-reads from the store after each mutation.
// This is intentional per Epic 11 design (Q19 / Q20 decisions).

import { withUser } from "@/lib/actions/with-user";
import { requireBoardRole } from "@/lib/authorization/board";
import type { Json } from "@/lib/supabase/types";
import {
  CreateViewSchema,
  DeleteViewSchema,
  DuplicateViewSchema,
  GlobalSearchSchema,
  RenameViewSchema,
  SaveViewSchema,
} from "@/lib/validations/view";

// ---------------------------------------------------------------------------
// createView
// ---------------------------------------------------------------------------

/**
 * Creates a new view on the given board.
 *
 * Authorization:
 *   - isShared = true  → admin+ required
 *   - isShared = false → member+ required
 *
 * State invariant (see cross-slice contract notes in epic-11.md):
 *   - personal:  owner_id = userId, is_shared = false
 *   - shared:    owner_id = null,   is_shared = true
 */
export const createView = withUser(async ({ supabase, userId }, raw) => {
  const input = CreateViewSchema.parse(raw);

  // Admin+ to create shared; member+ to create personal.
  await requireBoardRole(input.boardId, input.isShared ? "admin" : "member");

  // Next position = max(position) + 1 scoped to this board.
  const { data: maxRow } = await supabase
    .from("view")
    .select("position")
    .eq("board_id", input.boardId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPos = (maxRow?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("view")
    .insert({
      board_id: input.boardId,
      owner_id: input.isShared ? null : userId,
      name: input.name,
      kind: input.kind,
      is_shared: input.isShared,
      // ViewConfig is structurally compatible with Json but TypeScript can't
      // prove it due to the recursive FilterTree. Cast is safe at runtime.
      config: input.config as unknown as Json,
      position: nextPos,
    })
    .select()
    .single();

  if (error) throw { code: "DB", message: error.message };

  return data;
});

// ---------------------------------------------------------------------------
// saveView
// ---------------------------------------------------------------------------

/**
 * Persists the config of an existing view.
 *
 * Authorization:
 *   - shared / system row (is_shared = true or owner_id = null) → admin+ required
 *   - caller's own personal row                                 → allowed
 *   - another user's personal row                              → FORBIDDEN
 */
export const saveView = withUser(async ({ supabase, userId }, raw) => {
  const input = SaveViewSchema.parse(raw);

  // Load to confirm existence and check ownership.
  const { data: row, error: loadErr } = await supabase
    .from("view")
    .select("*")
    .eq("id", input.viewId)
    .single();

  if (loadErr || !row) throw { code: "NOT_FOUND", message: "View not found" };

  if (row.is_shared || row.owner_id == null) {
    await requireBoardRole(row.board_id, "admin");
  } else if (row.owner_id !== userId) {
    throw { code: "FORBIDDEN", message: "Cannot edit another user's personal view" };
  }

  const { data, error } = await supabase
    .from("view")
    .update({ config: input.config as unknown as Json })
    .eq("id", input.viewId)
    .select()
    .single();

  if (error) throw { code: "DB", message: error.message };

  return data;
});

// ---------------------------------------------------------------------------
// renameView
// ---------------------------------------------------------------------------

/**
 * Renames an existing view.
 *
 * Authorization mirrors saveView exactly:
 *   - shared / system row → admin+ required
 *   - caller's own personal row → allowed
 *   - another user's personal row → FORBIDDEN
 */
export const renameView = withUser(async ({ supabase, userId }, raw) => {
  const input = RenameViewSchema.parse(raw);

  // Load to confirm existence and check ownership.
  const { data: row, error: loadErr } = await supabase
    .from("view")
    .select("*")
    .eq("id", input.viewId)
    .single();

  if (loadErr || !row) throw { code: "NOT_FOUND", message: "View not found" };

  if (row.is_shared || row.owner_id == null) {
    await requireBoardRole(row.board_id, "admin");
  } else if (row.owner_id !== userId) {
    throw { code: "FORBIDDEN", message: "Cannot edit another user's personal view" };
  }

  const { data, error } = await supabase
    .from("view")
    .update({ name: input.name })
    .eq("id", input.viewId)
    .select()
    .single();

  if (error) throw { code: "DB", message: error.message };

  return data;
});

// ---------------------------------------------------------------------------
// duplicateView
// ---------------------------------------------------------------------------

/**
 * Duplicates an existing view as a personal copy for the caller.
 *
 * Authorization: viewer+ read access on the source board.
 * The duplicate is ALWAYS personal (owner_id = userId, is_shared = false)
 * regardless of whether the source is shared.
 * The name gets a " (copy)" suffix.
 */
export const duplicateView = withUser(async ({ supabase, userId }, raw) => {
  const input = DuplicateViewSchema.parse(raw);

  const { data: source, error: loadErr } = await supabase
    .from("view")
    .select("*")
    .eq("id", input.viewId)
    .single();

  if (loadErr || !source) throw { code: "NOT_FOUND", message: "View not found" };

  // Read access sufficient for duplicating.
  await requireBoardRole(source.board_id, "viewer");

  const newName = `${source.name} (copy)`;

  // Next position = max(position) + 1 scoped to this board.
  const { data: maxRow } = await supabase
    .from("view")
    .select("position")
    .eq("board_id", source.board_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPos = (maxRow?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("view")
    .insert({
      board_id: source.board_id,
      owner_id: userId,
      name: newName,
      kind: source.kind,
      is_shared: false,
      // source.config is Json (from the DB row) — no cast needed here.
      config: source.config,
      position: nextPos,
    })
    .select()
    .single();

  if (error) throw { code: "DB", message: error.message };

  return data;
});

// ---------------------------------------------------------------------------
// deleteView
// ---------------------------------------------------------------------------

/**
 * Hard-deletes a view (view rows have no deleted_at column).
 *
 * Authorization mirrors saveView:
 *   - shared / system row → admin+ required
 *   - caller's own personal row → allowed
 *   - another user's personal row → FORBIDDEN
 *
 * Guard: cannot delete the last shared table view on a board.
 */
export const deleteView = withUser(async ({ supabase, userId }, raw) => {
  const input = DeleteViewSchema.parse(raw);

  const { data: row, error: loadErr } = await supabase
    .from("view")
    .select("*")
    .eq("id", input.viewId)
    .single();

  if (loadErr || !row) throw { code: "NOT_FOUND", message: "View not found" };

  if (row.is_shared || row.owner_id == null) {
    await requireBoardRole(row.board_id, "admin");
  } else if (row.owner_id !== userId) {
    throw { code: "FORBIDDEN", message: "Cannot delete another user's personal view" };
  }

  // Guard: do not allow deleting the last shared table view (the workspace default).
  if (row.is_shared && row.kind === "table") {
    const { count } = await supabase
      .from("view")
      .select("id", { count: "exact", head: true })
      .eq("board_id", row.board_id)
      .eq("is_shared", true)
      .eq("kind", "table");

    if ((count ?? 0) <= 1) {
      throw { code: "LAST_DEFAULT", message: "Cannot delete the last shared table view" };
    }
  }

  const { error } = await supabase.from("view").delete().eq("id", input.viewId);

  if (error) throw { code: "DB", message: error.message };

  return { ok: true };
});

// ---------------------------------------------------------------------------
// globalSearch
// ---------------------------------------------------------------------------

/**
 * Runs a workspace-scoped full-text search via the `global_search` SQL function.
 *
 * The function is SECURITY INVOKER so RLS remains the effective auth gate.
 * No additional ACL checks are needed here.
 *
 * TODO(post-A-merge): drop the `as any` cast once pnpm db:types regen lands
 * after Slice A's migration is applied to the dev DB.
 */
export const globalSearch = withUser(async ({ supabase }, raw) => {
  const input = GlobalSearchSchema.parse(raw);

  // biome-ignore lint/suspicious/noExplicitAny: global_search absent from generated types until post-A-merge db:types regen
  const { data, error } = await (supabase as any).rpc("global_search", {
    p_workspace_id: input.workspaceId,
    q: input.q,
  });

  if (error) throw { code: "DB", message: error.message };

  return data as Array<{
    kind: string;
    id: string;
    title: string;
    board_id: string;
    board_title: string;
  }>;
});
