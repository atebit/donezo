"use server";

/**
 * Task server actions — CRUD + bulk operations.
 *
 * All actions:
 *   - Wrap `withUser` for authentication + error normalisation.
 *   - Parse raw input via Zod schemas from `lib/validations/task.ts`.
 *   - Resolve `boardId` from the task/group record and call
 *     `requireBoardRole(boardId, "member")` exactly once.
 *   - Mutate via the per-user Supabase client (RLS applies).
 *   - Log activity best-effort (never fails the parent action).
 *
 * Trigger note — `task_board_id_consistency`:
 *   The Postgres BEFORE INSERT / UPDATE OF group_id trigger automatically sets
 *   `task.board_id` from the parent group's `board_id`. Per guardrail #20, we
 *   NEVER write `board_id` explicitly in insert or move payloads; the trigger
 *   keeps the denormalized column consistent.
 *
 *   The generated TypeScript type `task.Insert` has `board_id: string` as a
 *   required field (it mirrors the DB NOT NULL constraint). Since the trigger
 *   fires BEFORE the constraint check, we can safely omit `board_id` at
 *   runtime. To bridge the gap without using `as any`, the three insert sites
 *   below use a `// @ts-expect-error` comment with a clear rationale
 *   (task_board_id_consistency trigger sets board_id).
 */

import { withUser } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { requireBoardRole } from "@/lib/authorization";
import { positionBetween } from "@/lib/positions";
import {
  BulkDeleteTasksSchema,
  BulkDuplicateTasksSchema,
  BulkMoveTasksToGroupSchema,
  CreateTaskSchema,
  DeleteTaskSchema,
  DuplicateTaskSchema,
  MoveTaskSchema,
  RenameTaskSchema,
} from "@/lib/validations/task";

// ---------------------------------------------------------------------------
// createTask
// ---------------------------------------------------------------------------

export const createTask = withUser(async ({ supabase, userId }, raw) => {
  const input = CreateTaskSchema.parse(raw);

  // Resolve boardId from the parent group.
  const { data: group, error: groupError } = await supabase
    .from("group")
    .select("board_id")
    .eq("id", input.groupId)
    .is("deleted_at", null)
    .maybeSingle();

  if (groupError) throw { code: "DB", message: groupError.message };
  if (!group) throw { code: "NOT_FOUND", message: "Group not found." };

  await requireBoardRole(group.board_id, "member");

  // INSERT with group_id only — the task_board_id_consistency BEFORE INSERT trigger
  // derives board_id from group_id automatically. `board_id` is intentionally absent.
  const createPayload = {
    group_id: input.groupId,
    title: input.title,
    position: input.position,
    created_by: userId,
    updated_by: userId,
  };
  const { data, error } = await supabase
    .from("task")
    // @ts-expect-error: task_board_id_consistency trigger sets board_id from group_id
    .insert(createPayload)
    .select("*")
    .single();

  if (error) throw { code: "DB", message: error.message };
  if (!data) throw { code: "NOT_FOUND", message: "Task not found after insert." };

  await logActivity({
    boardId: group.board_id,
    taskId: data.id,
    actorId: userId,
    type: "task.created",
    payload: { groupId: input.groupId, title: input.title },
  });

  return data;
});

// ---------------------------------------------------------------------------
// renameTask
// ---------------------------------------------------------------------------

export const renameTask = withUser(async ({ supabase, userId }, raw) => {
  const input = RenameTaskSchema.parse(raw);

  const { data: task, error: fetchError } = await supabase
    .from("task")
    .select("id, board_id, title")
    .eq("id", input.taskId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!task) throw { code: "NOT_FOUND", message: "Task not found." };

  const oldTitle = task.title;

  await requireBoardRole(task.board_id, "member");

  const { data, error } = await supabase
    .from("task")
    .update({ title: input.title, updated_by: userId })
    .eq("id", input.taskId)
    .select("*")
    .single();

  if (error) throw { code: "DB", message: error.message };
  if (!data) throw { code: "NOT_FOUND", message: "Task not found after update." };

  await logActivity({
    boardId: task.board_id,
    taskId: input.taskId,
    actorId: userId,
    type: "task.renamed",
    payload: { from: oldTitle, to: input.title },
  });

  return data;
});

// ---------------------------------------------------------------------------
// duplicateTask
// ---------------------------------------------------------------------------
//
// Non-atomic multi-statement duplicate (per S5 decision — acceptable for v1).
// Returns the new task row.

export const duplicateTask = withUser(async ({ supabase, userId }, raw) => {
  const input = DuplicateTaskSchema.parse(raw);

  // 1. Load source task.
  const { data: sourceTask, error: taskFetchError } = await supabase
    .from("task")
    .select("id, board_id, group_id, title, position")
    .eq("id", input.taskId)
    .is("deleted_at", null)
    .maybeSingle();

  if (taskFetchError) throw { code: "DB", message: taskFetchError.message };
  if (!sourceTask) throw { code: "NOT_FOUND", message: "Task not found." };

  await requireBoardRole(sourceTask.board_id, "member");

  // 2. Load the next sibling to compute insertion position.
  const { data: nextSiblingRows, error: siblingError } = await supabase
    .from("task")
    .select("position")
    .eq("group_id", sourceTask.group_id)
    .is("deleted_at", null)
    .gt("position", sourceTask.position)
    .order("position", { ascending: true })
    .limit(1);

  if (siblingError) throw { code: "DB", message: siblingError.message };

  const nextSiblingPosition = nextSiblingRows?.[0]?.position ?? null;
  const newPosition = positionBetween(sourceTask.position, nextSiblingPosition);

  // 3. Load live cells for the source task.
  const { data: sourceCells, error: cellsFetchError } = await supabase
    .from("cell")
    .select(
      "task_id, column_id, text_value, number_value, boolean_value, date_value, date_end_value, json_value, label_id",
    )
    .eq("task_id", input.taskId);

  if (cellsFetchError) throw { code: "DB", message: cellsFetchError.message };

  const cells = sourceCells ?? [];

  // 4. INSERT cloned task with group_id only — trigger sets board_id.
  const dupPayload = {
    group_id: sourceTask.group_id,
    title: sourceTask.title,
    position: newPosition,
    created_by: userId,
    updated_by: userId,
  };
  const { data: newTask, error: taskInsertError } = await supabase
    .from("task")
    // @ts-expect-error: task_board_id_consistency trigger sets board_id from group_id
    .insert(dupPayload)
    .select("*")
    .single();

  if (taskInsertError) throw { code: "DB", message: taskInsertError.message };
  if (!newTask) throw { code: "NOT_FOUND", message: "Cloned task not found after insert." };

  // 5. INSERT cloned cells (per-cell loop — non-atomic, acceptable for v1).
  for (const sourceCell of cells) {
    // @ts-expect-error: cell_board_id_consistency trigger sets board_id from task_id
    const { error: cellInsertError } = await supabase.from("cell").insert({
      task_id: newTask.id,
      column_id: sourceCell.column_id,
      text_value: sourceCell.text_value,
      number_value: sourceCell.number_value,
      boolean_value: sourceCell.boolean_value,
      date_value: sourceCell.date_value,
      date_end_value: sourceCell.date_end_value,
      json_value: sourceCell.json_value,
      label_id: sourceCell.label_id,
    });

    if (cellInsertError) throw { code: "DB", message: cellInsertError.message };
  }

  await logActivity({
    boardId: sourceTask.board_id,
    taskId: newTask.id,
    actorId: userId,
    type: "task.duplicated",
    payload: { sourceTaskId: input.taskId, newTaskId: newTask.id },
  });

  return newTask;
});

// ---------------------------------------------------------------------------
// deleteTask
// ---------------------------------------------------------------------------

export const deleteTask = withUser(async ({ supabase, userId }, raw) => {
  const input = DeleteTaskSchema.parse(raw);

  const { data: task, error: fetchError } = await supabase
    .from("task")
    .select("id, board_id")
    .eq("id", input.taskId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!task) throw { code: "NOT_FOUND", message: "Task not found." };

  await requireBoardRole(task.board_id, "member");

  const { error } = await supabase
    .from("task")
    .update({ deleted_at: new Date().toISOString(), updated_by: userId })
    .eq("id", input.taskId);

  if (error) throw { code: "DB", message: error.message };

  await logActivity({
    boardId: task.board_id,
    taskId: input.taskId,
    actorId: userId,
    type: "task.deleted",
    payload: { taskId: input.taskId },
  });

  return { taskId: input.taskId };
});

// ---------------------------------------------------------------------------
// moveTask
// ---------------------------------------------------------------------------
//
// UPDATE group_id and position only — the task_board_id_consistency trigger
// fires on UPDATE OF group_id and corrects board_id if the group is on the
// same board (cross-board moves are rejected in application logic below).
// We NEVER write board_id here.

export const moveTask = withUser(async ({ supabase, userId }, raw) => {
  const input = MoveTaskSchema.parse(raw);

  // 1. Load source task to get current board_id and group_id.
  const { data: task, error: taskFetchError } = await supabase
    .from("task")
    .select("id, board_id, group_id")
    .eq("id", input.taskId)
    .is("deleted_at", null)
    .maybeSingle();

  if (taskFetchError) throw { code: "DB", message: taskFetchError.message };
  if (!task) throw { code: "NOT_FOUND", message: "Task not found." };

  const fromGroupId = task.group_id;

  // 2. Load destination group to verify it belongs to the same board (security check).
  const { data: destGroup, error: destGroupError } = await supabase
    .from("group")
    .select("board_id")
    .eq("id", input.groupId)
    .is("deleted_at", null)
    .maybeSingle();

  if (destGroupError) throw { code: "DB", message: destGroupError.message };
  if (!destGroup) throw { code: "NOT_FOUND", message: "Destination group not found." };

  if (destGroup.board_id !== task.board_id) {
    throw {
      code: "VALIDATION",
      message: "Cross-board move not allowed",
      field: "groupId",
    };
  }

  await requireBoardRole(task.board_id, "member");

  // 3. UPDATE group_id and position — trigger handles board_id if group changes.
  const { data, error } = await supabase
    .from("task")
    .update({ group_id: input.groupId, position: input.position, updated_by: userId })
    .eq("id", input.taskId)
    .select("*")
    .single();

  if (error) throw { code: "DB", message: error.message };
  if (!data) throw { code: "NOT_FOUND", message: "Task not found after update." };

  await logActivity({
    boardId: task.board_id,
    taskId: input.taskId,
    actorId: userId,
    type: "task.moved",
    payload: {
      fromGroupId,
      toGroupId: input.groupId,
      position: input.position,
    },
  });

  return data;
});

// ---------------------------------------------------------------------------
// bulkDeleteTasks
// ---------------------------------------------------------------------------

export const bulkDeleteTasks = withUser(async ({ supabase, userId }, raw) => {
  const input = BulkDeleteTasksSchema.parse(raw);

  // Load all affected tasks to resolve their board IDs.
  const { data: tasks, error: fetchError } = await supabase
    .from("task")
    .select("id, board_id")
    .in("id", input.taskIds)
    .is("deleted_at", null);

  if (fetchError) throw { code: "DB", message: fetchError.message };

  const loadedTasks = tasks ?? [];

  // Single-board safety check: all tasks must belong to the same board.
  const boardIds = [...new Set(loadedTasks.map((t) => t.board_id))];
  if (boardIds.length > 1) {
    throw {
      code: "VALIDATION",
      message: "Tasks span multiple boards",
    };
  }

  const boardId = boardIds[0];
  if (!boardId) {
    throw { code: "NOT_FOUND", message: "No live tasks found for the given IDs." };
  }

  await requireBoardRole(boardId, "member");

  const { error } = await supabase
    .from("task")
    .update({ deleted_at: new Date().toISOString(), updated_by: userId })
    .in("id", input.taskIds)
    .is("deleted_at", null);

  if (error) throw { code: "DB", message: error.message };

  await logActivity({
    boardId,
    actorId: userId,
    type: "task.bulk_deleted",
    payload: { count: input.taskIds.length, taskIds: input.taskIds },
  });

  return { taskIds: input.taskIds };
});

// ---------------------------------------------------------------------------
// bulkDuplicateTasks
// ---------------------------------------------------------------------------
//
// Loops single-task duplicate logic per source task. Non-atomic (v1 acceptable).

export const bulkDuplicateTasks = withUser(async ({ supabase, userId }, raw) => {
  const input = BulkDuplicateTasksSchema.parse(raw);

  // Load all source tasks to perform the single-board safety check.
  const { data: tasks, error: fetchError } = await supabase
    .from("task")
    .select("id, board_id, group_id, title, position")
    .in("id", input.taskIds)
    .is("deleted_at", null);

  if (fetchError) throw { code: "DB", message: fetchError.message };

  const loadedTasks = tasks ?? [];

  // Single-board safety check.
  const boardIds = [...new Set(loadedTasks.map((t) => t.board_id))];
  if (boardIds.length > 1) {
    throw {
      code: "VALIDATION",
      message: "Tasks span multiple boards",
    };
  }

  const boardId = boardIds[0];
  if (!boardId) {
    throw { code: "NOT_FOUND", message: "No live tasks found for the given IDs." };
  }

  await requireBoardRole(boardId, "member");

  const newTaskIds: string[] = [];

  for (const sourceTask of loadedTasks) {
    // Load next sibling for position math.
    const { data: nextSiblingRows, error: siblingError } = await supabase
      .from("task")
      .select("position")
      .eq("group_id", sourceTask.group_id)
      .is("deleted_at", null)
      .gt("position", sourceTask.position)
      .order("position", { ascending: true })
      .limit(1);

    if (siblingError) throw { code: "DB", message: siblingError.message };

    const nextSiblingPosition = nextSiblingRows?.[0]?.position ?? null;
    const newPosition = positionBetween(sourceTask.position, nextSiblingPosition);

    // Load cells for this task.
    const { data: sourceCells, error: cellsFetchError } = await supabase
      .from("cell")
      .select(
        "task_id, column_id, text_value, number_value, boolean_value, date_value, date_end_value, json_value, label_id",
      )
      .eq("task_id", sourceTask.id);

    if (cellsFetchError) throw { code: "DB", message: cellsFetchError.message };

    const cells = sourceCells ?? [];

    // INSERT cloned task — trigger sets board_id from group_id.
    const bulkDupPayload = {
      group_id: sourceTask.group_id,
      title: sourceTask.title,
      position: newPosition,
      created_by: userId,
      updated_by: userId,
    };
    const { data: newTask, error: taskInsertError } = await supabase
      .from("task")
      // @ts-expect-error: task_board_id_consistency trigger sets board_id from group_id
      .insert(bulkDupPayload)
      .select("id")
      .single();

    if (taskInsertError) throw { code: "DB", message: taskInsertError.message };
    if (!newTask) throw { code: "NOT_FOUND", message: "Cloned task not found after insert." };

    newTaskIds.push(newTask.id);

    // INSERT cloned cells.
    for (const sourceCell of cells) {
      // @ts-expect-error: cell_board_id_consistency trigger sets board_id from task_id
      const { error: cellInsertError } = await supabase.from("cell").insert({
        task_id: newTask.id,
        column_id: sourceCell.column_id,
        text_value: sourceCell.text_value,
        number_value: sourceCell.number_value,
        boolean_value: sourceCell.boolean_value,
        date_value: sourceCell.date_value,
        date_end_value: sourceCell.date_end_value,
        json_value: sourceCell.json_value,
        label_id: sourceCell.label_id,
      });

      if (cellInsertError) throw { code: "DB", message: cellInsertError.message };
    }
  }

  await logActivity({
    boardId,
    actorId: userId,
    type: "task.bulk_duplicated",
    payload: { sourceTaskIds: input.taskIds, newTaskIds },
  });

  return { newTaskIds };
});

// ---------------------------------------------------------------------------
// bulkMoveTasksToGroup
// ---------------------------------------------------------------------------
//
// Moves all listed tasks into the destination group, appending them at the end
// with sequential positions: max_dest_position + i + 1.
// UPDATE sets group_id and position only — trigger handles board_id.

export const bulkMoveTasksToGroup = withUser(async ({ supabase, userId }, raw) => {
  const input = BulkMoveTasksToGroupSchema.parse(raw);

  // Load source tasks.
  const { data: tasks, error: fetchError } = await supabase
    .from("task")
    .select("id, board_id, group_id")
    .in("id", input.taskIds)
    .is("deleted_at", null);

  if (fetchError) throw { code: "DB", message: fetchError.message };

  const loadedTasks = tasks ?? [];

  // Single-board safety check on source tasks.
  const boardIds = [...new Set(loadedTasks.map((t) => t.board_id))];
  if (boardIds.length > 1) {
    throw {
      code: "VALIDATION",
      message: "Tasks span multiple boards",
    };
  }

  const boardId = boardIds[0];
  if (!boardId) {
    throw { code: "NOT_FOUND", message: "No live tasks found for the given IDs." };
  }

  // Load destination group to confirm same-board membership.
  const { data: destGroup, error: destGroupError } = await supabase
    .from("group")
    .select("board_id")
    .eq("id", input.groupId)
    .is("deleted_at", null)
    .maybeSingle();

  if (destGroupError) throw { code: "DB", message: destGroupError.message };
  if (!destGroup) throw { code: "NOT_FOUND", message: "Destination group not found." };

  if (destGroup.board_id !== boardId) {
    throw {
      code: "VALIDATION",
      message: "Cross-board move not allowed",
      field: "groupId",
    };
  }

  await requireBoardRole(boardId, "member");

  // Load the maximum current position in the destination group.
  const { data: maxPositionRows, error: maxPosError } = await supabase
    .from("task")
    .select("position")
    .eq("group_id", input.groupId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1);

  if (maxPosError) throw { code: "DB", message: maxPosError.message };

  const maxPosition = maxPositionRows?.[0]?.position ?? 0;

  const fromGroupIds = loadedTasks.map((t) => t.group_id);

  // UPDATE each task's group_id and position — trigger handles board_id.
  for (let i = 0; i < loadedTasks.length; i++) {
    const task = loadedTasks[i];
    if (!task) continue;

    const { error: updateError } = await supabase
      .from("task")
      .update({
        group_id: input.groupId,
        position: maxPosition + i + 1,
        updated_by: userId,
      })
      .eq("id", task.id);

    if (updateError) throw { code: "DB", message: updateError.message };
  }

  await logActivity({
    boardId,
    actorId: userId,
    type: "task.bulk_moved",
    payload: {
      taskIds: input.taskIds,
      fromGroupIds,
      toGroupId: input.groupId,
      count: input.taskIds.length,
    },
  });

  return { taskIds: input.taskIds, toGroupId: input.groupId };
});
