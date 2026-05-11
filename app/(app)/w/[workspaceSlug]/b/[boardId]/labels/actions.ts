"use server";

import { withUser } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { requireBoardRole } from "@/lib/authorization";
import {
  CreateLabelSchema,
  DeleteLabelSchema,
  RecolorLabelSchema,
  RenameLabelSchema,
  ReorderLabelSchema,
} from "@/lib/validations/label";

// ---------------------------------------------------------------------------
// createLabel
// ---------------------------------------------------------------------------
//
// Inserts a new label under the given column. Requires >= admin on the
// column's board (RLS: label_insert policy is admin-gated per Q26).

export const createLabel = withUser(async ({ supabase, userId }, raw) => {
  const input = CreateLabelSchema.parse(raw);

  // Load the column to resolve board_id for the role check.
  const { data: column, error: colErr } = await supabase
    .from("column")
    .select("id, board_id")
    .eq("id", input.columnId)
    .maybeSingle();

  if (colErr) throw { code: "DB", message: colErr.message };
  if (!column) throw { code: "NOT_FOUND", message: "Column not found." };

  await requireBoardRole(column.board_id, "admin");

  const { data: label, error: insertErr } = await supabase
    .from("label")
    .insert({
      column_id: input.columnId,
      name: input.name,
      color: input.color,
      position: input.position,
    })
    .select()
    .single();

  if (insertErr) throw { code: "DB", message: insertErr.message };
  if (!label) throw { code: "NOT_FOUND", message: "Label not found after insert." };

  await logActivity({
    boardId: column.board_id,
    actorId: userId,
    type: "label.created",
    payload: { labelId: label.id, name: label.name, color: label.color, columnId: input.columnId },
  });

  return label;
});

// ---------------------------------------------------------------------------
// renameLabel
// ---------------------------------------------------------------------------
//
// Updates label.name. Loads the label + column to resolve board_id for the
// role check and to capture the old name for the activity payload.

export const renameLabel = withUser(async ({ supabase, userId }, raw) => {
  const input = RenameLabelSchema.parse(raw);

  // Load label + its column's board_id and old name in one join.
  const { data: label, error: fetchErr } = await supabase
    .from("label")
    .select("id, name, color, column_id, column:column_id(board_id)")
    .eq("id", input.labelId)
    .maybeSingle();

  if (fetchErr) throw { code: "DB", message: fetchErr.message };
  if (!label) throw { code: "NOT_FOUND", message: "Label not found." };

  // The join returns column as an object (or null).
  const columnRef = Array.isArray(label.column) ? label.column[0] : label.column;
  if (!columnRef) throw { code: "NOT_FOUND", message: "Parent column not found." };

  await requireBoardRole(columnRef.board_id, "admin");

  const oldName = label.name;

  const { data: updated, error: updateErr } = await supabase
    .from("label")
    .update({ name: input.name })
    .eq("id", input.labelId)
    .select()
    .single();

  if (updateErr) throw { code: "DB", message: updateErr.message };
  if (!updated) throw { code: "NOT_FOUND", message: "Label not found after update." };

  await logActivity({
    boardId: columnRef.board_id,
    actorId: userId,
    type: "label.renamed",
    payload: { labelId: input.labelId, from: oldName, to: input.name },
  });

  return updated;
});

// ---------------------------------------------------------------------------
// recolorLabel
// ---------------------------------------------------------------------------
//
// Updates label.color. Same load + admin check pattern as renameLabel.

export const recolorLabel = withUser(async ({ supabase, userId }, raw) => {
  const input = RecolorLabelSchema.parse(raw);

  const { data: label, error: fetchErr } = await supabase
    .from("label")
    .select("id, name, color, column_id, column:column_id(board_id)")
    .eq("id", input.labelId)
    .maybeSingle();

  if (fetchErr) throw { code: "DB", message: fetchErr.message };
  if (!label) throw { code: "NOT_FOUND", message: "Label not found." };

  const columnRef = Array.isArray(label.column) ? label.column[0] : label.column;
  if (!columnRef) throw { code: "NOT_FOUND", message: "Parent column not found." };

  await requireBoardRole(columnRef.board_id, "admin");

  const oldColor = label.color;

  const { data: updated, error: updateErr } = await supabase
    .from("label")
    .update({ color: input.color })
    .eq("id", input.labelId)
    .select()
    .single();

  if (updateErr) throw { code: "DB", message: updateErr.message };
  if (!updated) throw { code: "NOT_FOUND", message: "Label not found after update." };

  await logActivity({
    boardId: columnRef.board_id,
    actorId: userId,
    type: "label.recolored",
    payload: { labelId: input.labelId, from: oldColor, to: input.color },
  });

  return updated;
});

// ---------------------------------------------------------------------------
// reorderLabel
// ---------------------------------------------------------------------------
//
// Updates label.position. Requires admin on the column's board.

export const reorderLabel = withUser(async ({ supabase, userId }, raw) => {
  const input = ReorderLabelSchema.parse(raw);

  const { data: label, error: fetchErr } = await supabase
    .from("label")
    .select("id, name, color, column_id, column:column_id(board_id)")
    .eq("id", input.labelId)
    .maybeSingle();

  if (fetchErr) throw { code: "DB", message: fetchErr.message };
  if (!label) throw { code: "NOT_FOUND", message: "Label not found." };

  const columnRef = Array.isArray(label.column) ? label.column[0] : label.column;
  if (!columnRef) throw { code: "NOT_FOUND", message: "Parent column not found." };

  await requireBoardRole(columnRef.board_id, "admin");

  const { data: updated, error: updateErr } = await supabase
    .from("label")
    .update({ position: input.position })
    .eq("id", input.labelId)
    .select()
    .single();

  if (updateErr) throw { code: "DB", message: updateErr.message };
  if (!updated) throw { code: "NOT_FOUND", message: "Label not found after update." };

  await logActivity({
    boardId: columnRef.board_id,
    actorId: userId,
    type: "label.reordered",
    payload: { labelId: input.labelId, position: input.position },
  });

  return updated;
});

// ---------------------------------------------------------------------------
// deleteLabel
// ---------------------------------------------------------------------------
//
// Hard-deletes the label. Because `cell.label_id` references `label.id` with
// `ON DELETE SET NULL`, Postgres automatically nulls any cell that held this
// label — no explicit cell UPDATE needed. The `affectedCellCount` returned is
// informational; the actual NULLing happens at the DB level.

export const deleteLabel = withUser(async ({ supabase, userId }, raw) => {
  const input = DeleteLabelSchema.parse(raw);

  // Load the label (name + color for the activity payload) and its column's board_id.
  const { data: label, error: fetchErr } = await supabase
    .from("label")
    .select("id, name, color, column_id, column:column_id(board_id)")
    .eq("id", input.labelId)
    .maybeSingle();

  if (fetchErr) throw { code: "DB", message: fetchErr.message };
  if (!label) throw { code: "NOT_FOUND", message: "Label not found." };

  const columnRef = Array.isArray(label.column) ? label.column[0] : label.column;
  if (!columnRef) throw { code: "NOT_FOUND", message: "Parent column not found." };

  await requireBoardRole(columnRef.board_id, "admin");

  // Count cells that reference this label before deleting (informational).
  const { count: affectedCellCount, error: countErr } = await supabase
    .from("cell")
    .select("*", { count: "exact", head: true })
    .eq("label_id", input.labelId);

  if (countErr) throw { code: "DB", message: countErr.message };

  // Hard delete — FK `ON DELETE SET NULL` nulls the matching cell.label_id rows.
  const { error: deleteErr } = await supabase.from("label").delete().eq("id", input.labelId);

  if (deleteErr) throw { code: "DB", message: deleteErr.message };

  const cellCount = affectedCellCount ?? 0;

  await logActivity({
    boardId: columnRef.board_id,
    actorId: userId,
    type: "label.deleted",
    payload: {
      labelId: input.labelId,
      name: label.name,
      color: label.color,
      affectedCellCount: cellCount,
    },
  });

  return { deletedLabelId: input.labelId, affectedCellCount: cellCount };
});
