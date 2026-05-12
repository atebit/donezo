"use server";

import { withUser } from "@/lib/actions";
import { requireBoardRole } from "@/lib/authorization/board";
import { ListBoardActivitySchema } from "@/lib/validations/activity";

export const listBoardActivity = withUser(async ({ supabase }, raw) => {
  const input = ListBoardActivitySchema.parse(raw);
  await requireBoardRole(input.boardId, "viewer");

  let q = supabase
    .from("activity")
    .select("*")
    .eq("board_id", input.boardId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);

  if (input.cursor) {
    const [ts, id] = input.cursor.split("|");
    // biome-ignore lint/style/noNonNullAssertion: cursor format guaranteed by prior listBoardActivity return
    q = q.or(`created_at.lt.${ts!},and(created_at.eq.${ts!},id.lt.${id!})`);
  }

  if (input.filters?.actorIds?.length) {
    q = q.in("actor_id", input.filters.actorIds);
  }
  if (input.filters?.actionGroups?.length) {
    const orParts = input.filters.actionGroups.map((g) => `type.like.${g}.%`).join(",");
    q = q.or(orParts);
  }
  if (input.filters?.dateFrom) {
    q = q.gte("created_at", input.filters.dateFrom);
  }
  if (input.filters?.dateTo) {
    q = q.lte("created_at", input.filters.dateTo);
  }

  const { data, error } = await q;
  if (error) throw { code: "DB", message: error.message };

  const events = data ?? [];
  const lastEvent = events.at(-1);
  const nextCursor =
    events.length === 50 && lastEvent ? `${lastEvent.created_at}|${lastEvent.id}` : null;

  return { events, nextCursor };
});
