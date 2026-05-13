"use server";
// No revalidatePath calls — board page is client-driven; re-reads from store.
// This is intentional per Epic 11 design (Q24: debounce 750ms, last-write-wins).

import { withUser } from "@/lib/actions/with-user";
import { SetLastViewSchema } from "@/lib/validations/view";

// ---------------------------------------------------------------------------
// setLastViewForBoard
// ---------------------------------------------------------------------------

/**
 * Merges `{ [boardId]: viewId }` into `profile.last_view_per_board`.
 *
 * Strategy: load → merge → write back. Concurrent writes are last-write-wins;
 * this is acceptable for a UX preference (Q24 decision — debounce 750ms
 * client-side, flush on pagehide, cap one write per 2s).
 *
 * NOTE: `last_view_per_board` is added to profile in Epic 11 migration
 * `20260515000000_profile_last_view_per_board.sql`. Until pnpm db:types is
 * rerun after that migration lands, this column is absent from the generated
 * types — the `as any` casts below bridge that gap.
 *
 * TODO(post-A-merge): remove `as any` casts once pnpm db:types regen lands
 * after Slice A's migration is applied to the dev DB.
 */
export const setLastViewForBoard = withUser(async ({ supabase, userId }, raw) => {
  const input = SetLastViewSchema.parse(raw);

  // Read current map from profile.
  // biome-ignore lint/suspicious/noExplicitAny: last_view_per_board absent from generated types until post-A-merge db:types regen
  const { data: prof, error: loadErr } = await (supabase as any)
    .from("profile")
    .select("last_view_per_board")
    .eq("id", userId)
    .single();

  if (loadErr || !prof) {
    throw {
      code: "DB",
      message: (loadErr as { message?: string } | null)?.message ?? "profile missing",
    };
  }

  // Merge: spread existing entries and overwrite this board's entry.
  const existing =
    (prof as { last_view_per_board: Record<string, string> | null }).last_view_per_board ?? {};

  const next: Record<string, string> = {
    ...existing,
    [input.boardId]: input.viewId,
  };

  // biome-ignore lint/suspicious/noExplicitAny: last_view_per_board absent from generated types until post-A-merge db:types regen
  const { error } = await (supabase as any)
    .from("profile")
    .update({ last_view_per_board: next })
    .eq("id", userId);

  if (error) throw { code: "DB", message: (error as { message: string }).message };

  return { ok: true };
});
