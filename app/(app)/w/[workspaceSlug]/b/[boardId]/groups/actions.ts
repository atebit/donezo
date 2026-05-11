"use server";

import { withUser } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { requireBoardRole } from "@/lib/authorization";
import { isValidGroupColor } from "@/lib/group-palette";
import {
  CreateGroupSchema,
  DeleteGroupSchema,
  DuplicateGroupSchema,
  RecolorGroupSchema,
  RenameGroupSchema,
  ReorderGroupSchema,
} from "@/lib/validations/group";

// ---------------------------------------------------------------------------
// createGroup
// ---------------------------------------------------------------------------

export const createGroup = withUser(async ({ supabase, userId }, raw) => {
  const input = CreateGroupSchema.parse(raw);
  await requireBoardRole(input.boardId, "member");

  if (!isValidGroupColor(input.color)) {
    throw { code: "VALIDATION", message: "Invalid color", field: "color" };
  }

  const { data, error } = await supabase
    .from("group")
    .insert({
      board_id: input.boardId,
      name: input.name,
      color: input.color,
      position: input.position,
    })
    .select()
    .single();

  if (error) throw { code: "DB", message: error.message };
  if (!data) throw { code: "NOT_FOUND", message: "Group not found after insert." };

  await logActivity({
    boardId: input.boardId,
    actorId: userId,
    type: "group.created",
    payload: { name: input.name, color: input.color, position: input.position },
  });

  return data;
});

// ---------------------------------------------------------------------------
// renameGroup
// ---------------------------------------------------------------------------

export const renameGroup = withUser(async ({ supabase, userId }, raw) => {
  const input = RenameGroupSchema.parse(raw);

  const { data: group, error: fetchError } = await supabase
    .from("group")
    .select("id, board_id, name")
    .eq("id", input.groupId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!group) throw { code: "NOT_FOUND", message: "Group not found." };

  await requireBoardRole(group.board_id, "member");

  const { data, error } = await supabase
    .from("group")
    .update({ name: input.name })
    .eq("id", input.groupId)
    .select()
    .single();

  if (error) throw { code: "DB", message: error.message };
  if (!data) throw { code: "NOT_FOUND", message: "Group not found after update." };

  await logActivity({
    boardId: group.board_id,
    actorId: userId,
    type: "group.renamed",
    payload: { from: group.name, to: input.name },
  });

  return data;
});

// ---------------------------------------------------------------------------
// recolorGroup
// ---------------------------------------------------------------------------

export const recolorGroup = withUser(async ({ supabase, userId }, raw) => {
  const input = RecolorGroupSchema.parse(raw);

  const { data: group, error: fetchError } = await supabase
    .from("group")
    .select("id, board_id, color")
    .eq("id", input.groupId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!group) throw { code: "NOT_FOUND", message: "Group not found." };

  await requireBoardRole(group.board_id, "member");

  if (!isValidGroupColor(input.color)) {
    throw { code: "VALIDATION", message: "Invalid color", field: "color" };
  }

  const { data, error } = await supabase
    .from("group")
    .update({ color: input.color })
    .eq("id", input.groupId)
    .select()
    .single();

  if (error) throw { code: "DB", message: error.message };
  if (!data) throw { code: "NOT_FOUND", message: "Group not found after update." };

  await logActivity({
    boardId: group.board_id,
    actorId: userId,
    type: "group.recolored",
    payload: { from: group.color, to: input.color },
  });

  return data;
});

// ---------------------------------------------------------------------------
// reorderGroup
// ---------------------------------------------------------------------------

export const reorderGroup = withUser(async ({ supabase, userId }, raw) => {
  const input = ReorderGroupSchema.parse(raw);

  const { data: group, error: fetchError } = await supabase
    .from("group")
    .select("id, board_id")
    .eq("id", input.groupId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!group) throw { code: "NOT_FOUND", message: "Group not found." };

  await requireBoardRole(group.board_id, "member");

  const { data, error } = await supabase
    .from("group")
    .update({ position: input.position })
    .eq("id", input.groupId)
    .select()
    .single();

  if (error) throw { code: "DB", message: error.message };
  if (!data) throw { code: "NOT_FOUND", message: "Group not found after update." };

  await logActivity({
    boardId: group.board_id,
    actorId: userId,
    type: "group.reordered",
    payload: { position: input.position },
  });

  return data;
});

// ---------------------------------------------------------------------------
// duplicateGroup
// ---------------------------------------------------------------------------
//
// Non-atomic multi-statement duplicate per spec decision (b). Partial-duplicate
// recovery is by re-running. Returns the new group row.

export const duplicateGroup = withUser(async ({ supabase, userId }, raw) => {
  const input = DuplicateGroupSchema.parse(raw);

  // 1. Load source group.
  const { data: sourceGroup, error: groupFetchError } = await supabase
    .from("group")
    .select("id, board_id, name, color, position")
    .eq("id", input.groupId)
    .is("deleted_at", null)
    .maybeSingle();

  if (groupFetchError) throw { code: "DB", message: groupFetchError.message };
  if (!sourceGroup) throw { code: "NOT_FOUND", message: "Group not found." };

  await requireBoardRole(sourceGroup.board_id, "member");

  // 2. Load live tasks for the source group.
  const { data: sourceTasks, error: tasksFetchError } = await supabase
    .from("task")
    .select("id, title, position, created_by, updated_by")
    .eq("group_id", input.groupId)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  if (tasksFetchError) throw { code: "DB", message: tasksFetchError.message };

  const tasks = sourceTasks ?? [];

  // 3. Load cells for those tasks (if any).
  const taskIds = tasks.map((t) => t.id);

  const cells =
    taskIds.length > 0
      ? await (async () => {
          const { data: cellRows, error: cellsFetchError } = await supabase
            .from("cell")
            .select(
              "task_id, column_id, text_value, number_value, boolean_value, date_value, date_end_value, json_value, label_id",
            )
            .in("task_id", taskIds);

          if (cellsFetchError) throw { code: "DB", message: cellsFetchError.message };
          return cellRows ?? [];
        })()
      : [];

  // 4. INSERT the new group.
  const { data: newGroup, error: groupInsertError } = await supabase
    .from("group")
    .insert({
      board_id: sourceGroup.board_id,
      name: `${sourceGroup.name} copy`,
      color: sourceGroup.color,
      position: sourceGroup.position + 0.5,
    })
    .select()
    .single();

  if (groupInsertError) throw { code: "DB", message: groupInsertError.message };
  if (!newGroup) throw { code: "NOT_FOUND", message: "New group not found after insert." };

  // 5. INSERT cloned tasks.
  // Build a map from old task id → new task id for cell cloning below.
  const oldToNewTaskId = new Map<string, string>();

  for (const sourceTask of tasks) {
    const taskPayload = {
      group_id: newGroup.id,
      title: sourceTask.title,
      position: sourceTask.position,
      created_by: userId,
      updated_by: userId,
    };
    const { data: newTask, error: taskInsertError } = await supabase
      .from("task")
      // @ts-expect-error: task_board_id_consistency trigger sets board_id from group_id
      .insert(taskPayload)
      .select("id")
      .single();

    if (taskInsertError) throw { code: "DB", message: taskInsertError.message };
    if (!newTask) throw { code: "NOT_FOUND", message: "New task not found after insert." };

    oldToNewTaskId.set(sourceTask.id, newTask.id);
  }

  // 6. INSERT cloned cells.
  for (const sourceCell of cells) {
    const newTaskId = oldToNewTaskId.get(sourceCell.task_id);
    if (!newTaskId) continue; // should not happen

    const { error: cellInsertError } = await supabase.from("cell").insert({
      task_id: newTaskId,
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
    boardId: sourceGroup.board_id,
    actorId: userId,
    type: "group.duplicated",
    payload: {
      sourceGroupId: input.groupId,
      newGroupId: newGroup.id,
      taskCount: tasks.length,
    },
  });

  return newGroup;
});

// ---------------------------------------------------------------------------
// deleteGroup
// ---------------------------------------------------------------------------
//
// Soft delete: sets `deleted_at` on the group. The DB trigger
// `cascade_soft_delete_to_tasks` propagates the soft delete to all live tasks.

export const deleteGroup = withUser(async ({ supabase, userId }, raw) => {
  const input = DeleteGroupSchema.parse(raw);

  const { data: group, error: fetchError } = await supabase
    .from("group")
    .select("id, board_id, name")
    .eq("id", input.groupId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!group) throw { code: "NOT_FOUND", message: "Group not found." };

  await requireBoardRole(group.board_id, "member");

  const { error } = await supabase
    .from("group")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", input.groupId);

  if (error) throw { code: "DB", message: error.message };

  await logActivity({
    boardId: group.board_id,
    actorId: userId,
    type: "group.deleted",
    payload: { groupId: input.groupId, name: group.name },
  });

  return { groupId: input.groupId };
});
