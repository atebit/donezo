"use server";

/**
 * Form view server actions.
 *
 * submitForm — called when a visitor submits the published form view.
 *
 * Auth model (Q24 resolution — orchestrator decision, autonomous run 2026-05-12):
 *   A `member` role is required to submit a form. The role check is
 *   `requireBoardRole(boardId, 'member')`.
 *
 *   The dispatch plan's Q24 default was "viewer can submit", but Epic 04's
 *   existing `task_insert` RLS policy requires `role_rank >= member` for INSERT
 *   on `public.task`. A viewer would pass the application check and then get
 *   42501 from Postgres. Three options were considered: (A) new RLS policy
 *   permitting form-mediated viewer inserts (requires migration + a way to tag
 *   inserts as form-submits), (B) match the app check to RLS at `member`,
 *   (C) use adminClient() to bypass RLS after the app-level auth check.
 *   Option B chosen for MVP — it aligns with current RLS architecture and
 *   doesn't cut corners. Option A is the right long-term answer if the product
 *   wants viewer-form-submit; that's deferred to a later epic.
 *
 * Steps inside submitForm:
 *   1. Validate raw input via SubmitFormSchema.
 *   2. Role check: member required (per Q24 resolution).
 *   3. Resolve the view row → parse form config.
 *   4. Resolve target groupId: config.targetGroupId OR first non-deleted group.
 *   5. Compute insertion position (append after last task in the group).
 *   6. Insert the task (trigger sets board_id from group_id).
 *   7. Upsert cells in one round-trip (skip null/undefined values).
 *   8. Log activity 'task.created via form'.
 *   9. Return { taskId }.
 */

import { withUser } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { requireBoardRole } from "@/lib/authorization";
import { getCellDef } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";
import { SubmitFormSchema } from "@/lib/validations/form";
import { FormConfigSchema } from "@/lib/views/config-schema";

// ---------------------------------------------------------------------------
// submitForm
// ---------------------------------------------------------------------------

export const submitForm = withUser(async ({ supabase, userId }, raw) => {
  const input = SubmitFormSchema.parse(raw);

  // 1. Role check: member required (per Q24 resolution — matches Epic 04 RLS).
  await requireBoardRole(input.boardId, "member");

  // 2. Resolve the view row and parse its form config.
  const { data: viewRow, error: viewError } = await supabase
    .from("view")
    .select("id, config, board_id")
    .eq("id", input.viewId)
    .eq("board_id", input.boardId)
    .maybeSingle();

  if (viewError) throw { code: "DB", message: viewError.message };
  if (!viewRow) throw { code: "NOT_FOUND", message: "View not found." };

  // Parse form config — FormConfigSchema.removeDefault() used in ViewConfigSchema,
  // but here we parse the sub-object directly so defaults apply.
  const rawConfig = viewRow.config as Record<string, unknown> | null;
  const formConfigRaw = rawConfig?.form ?? {};
  const formConfig = FormConfigSchema.parse(formConfigRaw);

  // 3. Resolve target groupId: config.targetGroupId OR first non-deleted group.
  let groupId: string | null = formConfig.targetGroupId;

  if (!groupId) {
    const { data: groups, error: groupsError } = await supabase
      .from("group")
      .select("id")
      .eq("board_id", input.boardId)
      .is("deleted_at", null)
      .order("position", { ascending: true })
      .limit(1);

    if (groupsError) throw { code: "DB", message: groupsError.message };

    const firstGroupId = (groups ?? [])[0]?.id ?? null;
    if (!firstGroupId) {
      throw {
        code: "VALIDATION",
        message: "This board has no groups. Add a group before accepting form submissions.",
      };
    }
    groupId = firstGroupId;
  }

  // TypeScript narrowing: groupId is guaranteed non-null here (either from
  // form config or from the first group query above).
  const resolvedGroupId: string = groupId as string;

  // 4. Compute insertion position (append after last task in the group).
  const { data: lastTaskRows, error: lastTaskError } = await supabase
    .from("task")
    .select("position")
    .eq("group_id", resolvedGroupId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1);

  if (lastTaskError) throw { code: "DB", message: lastTaskError.message };
  const lastPosition = lastTaskRows?.[0]?.position ?? 0;
  const newPosition = lastPosition + 1;

  // 5. Insert the task.
  //    group_id only — the task_board_id_consistency BEFORE INSERT trigger
  //    derives board_id from group_id automatically.
  const insertPayload = {
    group_id: resolvedGroupId,
    title: "Untitled",
    position: newPosition,
    created_by: userId,
    updated_by: userId,
  };

  const { data: newTask, error: taskInsertError } = await supabase
    .from("task")
    // @ts-expect-error: task_board_id_consistency trigger sets board_id from group_id
    .insert(insertPayload)
    .select("id, board_id")
    .single();

  if (taskInsertError) throw { code: "DB", message: taskInsertError.message };
  if (!newTask) throw { code: "NOT_FOUND", message: "Task not found after insert." };

  // 6. Upsert cells — skip values that are null/undefined (don't create empty cells).
  const nonNullValues = input.values.filter((v) => v.value !== null && v.value !== undefined);

  if (nonNullValues.length > 0) {
    // Load all relevant columns in one query to get their types.
    const columnIds = nonNullValues.map((v) => v.columnId);
    const { data: columns, error: colError } = await supabase
      .from("column")
      .select("id, type, board_id")
      .in("id", columnIds)
      .eq("board_id", input.boardId);

    if (colError) throw { code: "DB", message: colError.message };

    const columnMap = new Map((columns ?? []).map((c) => [c.id, c]));

    const upsertRows = nonNullValues.flatMap((v) => {
      const col = columnMap.get(v.columnId);
      if (!col) return []; // column not found or from different board — skip

      const def = getCellDef(col.type as CellTypeId);
      const patch = def.toRow(v.value);

      return [
        {
          task_id: newTask.id,
          column_id: v.columnId,
          board_id: col.board_id,
          ...patch,
          updated_by: userId,
        },
      ];
    });

    if (upsertRows.length > 0) {
      const { error: upsertError } = await supabase.from("cell").upsert(
        // biome-ignore lint/suspicious/noExplicitAny: upsert rows contain spread patch from toRow which types as Partial<CellRow>
        upsertRows as any[],
        { onConflict: "task_id,column_id" },
      );

      if (upsertError) throw { code: "DB", message: upsertError.message };
    }
  }

  // 7. Log activity — best-effort, never throws.
  await logActivity({
    boardId: input.boardId,
    taskId: newTask.id,
    actorId: userId,
    type: "task.created",
    payload: {
      groupId: resolvedGroupId,
      viewId: input.viewId,
      source: "form",
      fieldCount: nonNullValues.length,
    },
  });

  return { taskId: newTask.id };
});
