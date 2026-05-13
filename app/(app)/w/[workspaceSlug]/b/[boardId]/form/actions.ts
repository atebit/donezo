"use server";

/**
 * Form view server actions — submitForm.
 *
 * Authorization model (Q24 decision — viewer+ may submit):
 *   submitForm delegates to the `submit_form` SECURITY DEFINER SQL function
 *   (migration 20260516000000_submit_form_function.sql). The function's internal
 *   CHECK ensures role_for_board IS NOT NULL (any board member). This is option (b)
 *   from the dispatch plan — the RLS-as-truth approach that keeps auth inside
 *   the database rather than in the application layer.
 *
 * The action:
 *   1. Validates input via SubmitFormSchema.
 *   2. Fetches the view row to get the form config (groupId override).
 *   3. Resolves the target group (form config's groupId || first non-deleted group).
 *   4. Calls the submit_form SQL function with the processed cell values.
 *   5. Returns { ok: true, taskId } | { ok: false, code: ... }.
 *
 * Cell value payload:
 *   Each form field value is processed through getCellDef(column.type).toRow(value)
 *   to get the properly-structured row patch, then merged into the jsonb array
 *   that submit_form expects.
 *
 * NO direct writes to task or cell tables from this action — all mutations go
 * through the SECURITY DEFINER function. This is the key invariant for Q24.
 */

import { withUser } from "@/lib/actions";
import { getCellDef } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";
import { createClient } from "@/lib/supabase/server";
import { parseViewConfig } from "@/lib/views/config-schema";
import { SubmitFormSchema } from "@/lib/validations/form";

// ---------------------------------------------------------------------------
// submitForm
// ---------------------------------------------------------------------------

export const submitForm = withUser(async ({ supabase }, raw) => {
  const input = SubmitFormSchema.parse(raw);

  // 1. Load the view row to get form config (groupId, fields).
  const { data: viewRow, error: viewError } = await supabase
    .from("view")
    .select("id, board_id, config, kind")
    .eq("id", input.viewId)
    .maybeSingle();

  if (viewError) throw { code: "DB", message: viewError.message };
  if (!viewRow) throw { code: "NOT_FOUND", message: "View not found." };
  if (viewRow.board_id !== input.boardId) {
    throw { code: "VALIDATION", message: "View does not belong to the specified board." };
  }
  if (viewRow.kind !== "form") {
    throw { code: "VALIDATION", message: "View is not a form view." };
  }

  const viewConfig = parseViewConfig(viewRow.config);
  const formConfig = viewConfig.form;

  // 2. Resolve the target group.
  //    Priority: form config's targetGroupId → first non-deleted group on the board.
  let targetGroupId: string | null = formConfig?.targetGroupId ?? null;

  if (!targetGroupId) {
    const { data: firstGroup, error: groupError } = await supabase
      .from("group")
      .select("id")
      .eq("board_id", input.boardId)
      .is("deleted_at", null)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (groupError) throw { code: "DB", message: groupError.message };
    targetGroupId = firstGroup?.id ?? null;
  }

  if (!targetGroupId) {
    // No groups on this board — Q7 spec: return NO_GROUPS validation code.
    return { ok: false as const, code: "NO_GROUPS" as const };
  }

  // 3. Load column types for all columns referenced in the submitted values
  //    so we can call getCellDef(type).toRow(value) to build the SQL payload.
  const columnIds = input.values.map((v) => v.columnId).filter(Boolean);

  if (columnIds.length === 0) {
    return { ok: false as const, code: "NO_FIELDS" as const };
  }

  const { data: columns, error: colError } = await supabase
    .from("column")
    .select("id, type, board_id")
    .in("id", columnIds);

  if (colError) throw { code: "DB", message: colError.message };

  const colMap = new Map((columns ?? []).map((c) => [c.id, c]));

  // 4. Build the p_values jsonb array for the SQL function.
  //    Each element is the full cell row patch (all value columns set; unused ones null).
  //    The SQL function reads these fields directly.
  const cellPayloads: Array<Record<string, unknown>> = [];

  for (const field of input.values) {
    const col = colMap.get(field.columnId);
    if (!col) continue; // Skip unknown columns.
    if (col.board_id !== input.boardId) continue; // Security: skip columns from other boards.

    // getCellDef uses col.type which the DB emits as string; cast to CellTypeId.
    const def = getCellDef(col.type as CellTypeId);

    // toRow returns a Partial<CellRow> with the relevant value columns set.
    // biome-ignore lint/suspicious/noExplicitAny: def.toRow signature is (value: TValue | null) -> Partial<CellRow>; TValue is typed per CellTypeDef generic
    const patch = def.toRow(field.value as any);

    cellPayloads.push({
      column_id: field.columnId,
      text_value: patch.text_value ?? null,
      number_value: patch.number_value ?? null,
      boolean_value: patch.boolean_value ?? null,
      date_value: patch.date_value ?? null,
      date_end_value: patch.date_end_value ?? null,
      label_id: patch.label_id ?? null,
      json_value: patch.json_value ?? null,
    });
  }

  // 5. Call the SECURITY DEFINER SQL function.
  //    The function bypasses RLS for the INSERT (viewer can submit),
  //    but first checks role_for_board IS NOT NULL (must be a board member).
  const adminClient = await createClient();

  // biome-ignore lint/suspicious/noExplicitAny: submit_form absent from generated types until post-slice db:types regen
  const { data: taskId, error: fnError } = await (adminClient as any).rpc("submit_form", {
    p_board_id: input.boardId,
    p_view_id: input.viewId,
    p_group_id: targetGroupId,
    p_values: cellPayloads,
  });

  if (fnError) {
    // The SQL function raises 42501 (insufficient_privilege) for auth failures.
    if (fnError.code === "42501") {
      throw { code: "FORBIDDEN", message: "Not a board member" };
    }
    throw { code: "DB", message: fnError.message };
  }

  return { ok: true as const, taskId: taskId as string };
});
