"use server";

/**
 * Cell server actions — setCellValue + bulkSetCellValue.
 *
 * All actions:
 *   - Wrap `withUser` for authentication + error normalisation.
 *   - Parse raw input via Zod schemas from `lib/validations/cell.ts`.
 *   - Resolve `boardId` from the column record and call
 *     `requireBoardRole(boardId, "member")` (cells require >= member, guardrail #17).
 *   - Mutate via the per-user Supabase client (RLS applies).
 *   - Log activity best-effort (never fails the parent action).
 *
 * Single-board safety (guardrail #34 / guardrail #20):
 *   `bulkSetCellValue` derives a single boardId from all provided taskIds BEFORE
 *   the role check. Mixed-board input is rejected with a VALIDATION error. This
 *   mirrors the `bulkDeleteTasks` pattern in tasks/actions.ts.
 *
 * Per Q35 — toRow contract:
 *   `getCellDef(col.type).toRow(value)` MUST set ALL value columns explicitly
 *   (setting others to null). This clears stale data when a cell's effective type
 *   changes. The proxy stub in the registry (S1) throws if called at module load
 *   time, but we only call it inside the action handler, at invocation time.
 *   Stage 3 real defs will be wired before these actions are invoked in production.
 *
 * Guardrail #20 — no task.board_id write:
 *   We never write `task.board_id`. task.board_id is kept in sync by the
 *   task_board_id_consistency trigger (initial schema, lines 398–408).
 *
 * Epic 08 — S0: cell.board_id denormalization:
 *   Both upsert paths now include `board_id: col.board_id` in the payload so
 *   Realtime postgres_changes can filter on board_id=eq.<id>. The
 *   cell_board_id_consistency trigger overwrites this on the server, providing
 *   defense-in-depth against any action that omits the field.
 */

import { withUser } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { requireBoardRole } from "@/lib/authorization";
import { getCellDef } from "@/lib/cells/registry";
import { BulkSetCellValueSchema, SetCellValueSchema } from "@/lib/validations/cell";

// ---------------------------------------------------------------------------
// setCellValue
// ---------------------------------------------------------------------------

export const setCellValue = withUser(async ({ supabase, userId }, raw) => {
  const input = SetCellValueSchema.parse(raw);

  // 1. Load column to get board_id and type.
  const { data: col, error: colError } = await supabase
    .from("column")
    .select("id, board_id, type")
    .eq("id", input.columnId)
    .maybeSingle();

  if (colError) throw { code: "DB", message: colError.message };
  if (!col) throw { code: "NOT_FOUND", message: "Column not found." };

  // 2. Require >= member on the board.
  await requireBoardRole(col.board_id, "member");

  // 3. Load the existing cell for the activity log's "from" payload.
  const { data: prevCell } = await supabase
    .from("cell")
    .select("*")
    .eq("task_id", input.taskId)
    .eq("column_id", input.columnId)
    .maybeSingle();

  // Capture the previous typed value before overwriting.
  // getCellDef is deferred to call time — the registry's real defs land in Stage 3.
  // col.type is typed as `string` in generated types (Supabase emits string for
  // check-constrained columns); CellTypeId is a manual union that mirrors the constraint.
  // @ts-expect-error: generated types emit `string` for column.type; CellTypeId is the manual union mirror
  const cellDef = getCellDef(col.type);
  const prevValue = cellDef.fromRow(prevCell ?? undefined);

  // 4. Compute the patch via the registry's toRow. Per Q35, toRow MUST explicitly
  //    null all value columns it does not own so the upsert clears stale data.
  const patch = cellDef.toRow(input.value);

  // 5. Upsert the cell row.
  //    board_id is included explicitly for Realtime postgres_changes filtering
  //    (Epic 08 — S0). The cell_board_id_consistency trigger will overwrite it
  //    on the server, but writing it from the action is faster and self-documenting.
  const { data, error } = await supabase
    .from("cell")
    .upsert(
      {
        task_id: input.taskId,
        column_id: input.columnId,
        board_id: col.board_id,
        ...patch,
        updated_by: userId,
      },
      { onConflict: "task_id,column_id" },
    )
    .select()
    .single();

  if (error) throw { code: "DB", message: error.message };
  if (!data) throw { code: "NOT_FOUND", message: "Cell not found after upsert." };

  // 6. Log activity (best-effort — never throws).
  //    Resolve the task's board_id from the column (we already have it).
  await logActivity({
    boardId: col.board_id,
    taskId: input.taskId,
    actorId: userId,
    type: "cell.changed",
    payload: {
      columnType: col.type,
      from: prevValue,
      to: input.value,
    },
  });

  return data;
});

// ---------------------------------------------------------------------------
// bulkSetCellValue
// ---------------------------------------------------------------------------

export const bulkSetCellValue = withUser(async ({ supabase, userId }, raw) => {
  const input = BulkSetCellValueSchema.parse(raw);

  // Step 1: Load the column to get board_id and type.
  const { data: col, error: colError } = await supabase
    .from("column")
    .select("id, board_id, type")
    .eq("id", input.columnId)
    .maybeSingle();

  if (colError) throw { code: "DB", message: colError.message };
  if (!col) throw { code: "NOT_FOUND", message: "Column not found." };

  // Step 2: Load all tasks by taskIds (single query) and verify they share
  //         the same board. Single-board safety check — BEFORE the role check,
  //         mirroring the bulkDeleteTasks pattern (guardrail #34).
  const { data: tasks, error: taskFetchError } = await supabase
    .from("task")
    .select("id, board_id")
    .in("id", input.taskIds)
    .is("deleted_at", null);

  if (taskFetchError) throw { code: "DB", message: taskFetchError.message };

  const loadedTasks = tasks ?? [];

  const taskBoardIds = [...new Set(loadedTasks.map((t) => t.board_id))];
  if (taskBoardIds.length > 1) {
    throw {
      code: "VALIDATION",
      message: "Tasks span multiple boards",
    };
  }

  const tasksBoardId = taskBoardIds[0];
  if (!tasksBoardId) {
    throw { code: "NOT_FOUND", message: "No live tasks found for the given IDs." };
  }

  // Step 3: Verify the column belongs to the same board as the tasks.
  if (col.board_id !== tasksBoardId) {
    throw {
      code: "VALIDATION",
      message: "Column belongs to a different board",
    };
  }

  // Step 4: Require >= member (single role check after all safety checks pass).
  await requireBoardRole(tasksBoardId, "member");

  // Step 5: Compute the patch once via the registry's toRow.
  //         Per Q35, toRow MUST explicitly null all value columns it does not own.
  // @ts-expect-error: generated types emit `string` for column.type; CellTypeId is the manual union mirror
  const cellDef = getCellDef(col.type);
  const patch = cellDef.toRow(input.value);

  // Step 6: Build the upsert payload for all taskIds.
  //    board_id is included explicitly for Realtime postgres_changes filtering
  //    (Epic 08 — S0). The cell_board_id_consistency trigger will overwrite it
  //    on the server, but writing it from the action is faster and self-documenting.
  const upsertPayload = input.taskIds.map((tid) => ({
    task_id: tid,
    column_id: input.columnId,
    board_id: col.board_id,
    ...patch,
    updated_by: userId,
  }));

  // Step 7: Single upsert call (one round-trip for up to N tasks, per Q20).
  const { data, error } = await supabase
    .from("cell")
    .upsert(upsertPayload, { onConflict: "task_id,column_id" })
    .select();

  if (error) throw { code: "DB", message: error.message };

  const cells = data ?? [];

  // Step 8: Log activity (best-effort — never throws).
  await logActivity({
    boardId: tasksBoardId,
    actorId: userId,
    type: "cell.bulk_changed",
    payload: {
      columnType: col.type,
      columnId: input.columnId,
      taskCount: input.taskIds.length,
      value: input.value,
    },
  });

  // Step 9: Return count and updated cell rows.
  return { count: input.taskIds.length, cells };
});
