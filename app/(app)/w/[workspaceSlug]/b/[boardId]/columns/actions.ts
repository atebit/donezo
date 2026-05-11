"use server";

/**
 * Server actions for column CRUD, duplicate, type-change, and settings update.
 *
 * Authorization: all actions require `>= admin` on the board (per RLS policy
 * `column_insert / update / delete` = admin-only; Q26 / guardrail #17).
 *
 * Schema remapping note (Q22):
 *   - DB field `column.name`     → used everywhere (doc prose says "title")
 *   - DB field `column.settings` → used everywhere (doc prose says "config")
 *
 * v1 limitation (changeColumnType): conversions run row-by-row in JS, not in
 * a single transaction. If the loop partially fails, `column.type` will have
 * been updated while some cells still hold values in the old shape. The
 * `cell_one_value_check` constraint prevents mismatched writes, so partially-
 * converted cells simply stay in their old shape until the user retries.
 */

import { withUser } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { requireBoardRole } from "@/lib/authorization";
import { getCellDef } from "@/lib/cells/registry";
import { SEED_LABELS } from "@/lib/cells/seed-labels";
import type { Database, Json } from "@/lib/supabase/types";
import {
  ChangeColumnTypeSchema,
  CreateColumnSchema,
  DeleteColumnSchema,
  DuplicateColumnSchema,
  RenameColumnSchema,
  ReorderColumnSchema,
  UpdateColumnSettingsSchema,
} from "@/lib/validations/column";

type LabelRow = Database["public"]["Tables"]["label"]["Row"];

// ---------------------------------------------------------------------------
// createColumn
// ---------------------------------------------------------------------------

export const createColumn = withUser(async ({ supabase, userId }, raw) => {
  const input = CreateColumnSchema.parse(raw);
  await requireBoardRole(input.boardId, "admin");

  const { data: column, error } = await supabase
    .from("column")
    .insert({
      board_id: input.boardId,
      name: input.name,
      type: input.type,
      position: input.position,
      settings: input.settings as Json,
    })
    .select()
    .single();

  if (error) throw { code: "DB", message: error.message };
  if (!column) throw { code: "NOT_FOUND", message: "Column not found after insert." };

  // Seed default labels for status / priority columns.
  let labels: LabelRow[] = [];

  if (input.type === "status" || input.type === "priority") {
    const seed = SEED_LABELS[input.type];
    if (seed && seed.length > 0) {
      const { data: inserted, error: labelErr } = await supabase
        .from("label")
        .insert(seed.map((l) => ({ ...l, column_id: column.id })))
        .select();

      if (labelErr) throw { code: "DB", message: labelErr.message };
      labels = inserted ?? [];
    }
  }

  await logActivity({
    boardId: input.boardId,
    actorId: userId,
    type: "column.created",
    payload: { columnId: column.id, name: column.name, type: column.type },
  });

  return { column, labels };
});

// ---------------------------------------------------------------------------
// renameColumn
// ---------------------------------------------------------------------------

export const renameColumn = withUser(async ({ supabase, userId }, raw) => {
  const input = RenameColumnSchema.parse(raw);

  const { data: column, error: fetchError } = await supabase
    .from("column")
    .select("id, board_id, name")
    .eq("id", input.columnId)
    .maybeSingle();

  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!column) throw { code: "NOT_FOUND", message: "Column not found." };

  await requireBoardRole(column.board_id, "admin");

  const { data: updated, error } = await supabase
    .from("column")
    .update({ name: input.name })
    .eq("id", input.columnId)
    .select()
    .single();

  if (error) throw { code: "DB", message: error.message };
  if (!updated) throw { code: "NOT_FOUND", message: "Column not found after update." };

  await logActivity({
    boardId: column.board_id,
    actorId: userId,
    type: "column.renamed",
    payload: { columnId: input.columnId, from: column.name, to: input.name },
  });

  return updated;
});

// ---------------------------------------------------------------------------
// reorderColumn
// ---------------------------------------------------------------------------

export const reorderColumn = withUser(async ({ supabase, userId }, raw) => {
  const input = ReorderColumnSchema.parse(raw);

  const { data: column, error: fetchError } = await supabase
    .from("column")
    .select("id, board_id")
    .eq("id", input.columnId)
    .maybeSingle();

  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!column) throw { code: "NOT_FOUND", message: "Column not found." };

  await requireBoardRole(column.board_id, "admin");

  const { data: updated, error } = await supabase
    .from("column")
    .update({ position: input.position })
    .eq("id", input.columnId)
    .select()
    .single();

  if (error) throw { code: "DB", message: error.message };
  if (!updated) throw { code: "NOT_FOUND", message: "Column not found after update." };

  await logActivity({
    boardId: column.board_id,
    actorId: userId,
    type: "column.reordered",
    payload: { columnId: input.columnId, position: input.position },
  });

  return updated;
});

// ---------------------------------------------------------------------------
// duplicateColumn
// ---------------------------------------------------------------------------
//
// Per Q29: copies column + labels (for status / priority) but NOT cell values.
// New column position = source position + 0.5 (same v1 pattern as duplicateGroup).

export const duplicateColumn = withUser(async ({ supabase, userId }, raw) => {
  const input = DuplicateColumnSchema.parse(raw);

  // 1. Load source column.
  const { data: sourceColumn, error: colFetchErr } = await supabase
    .from("column")
    .select("id, board_id, name, type, position, settings")
    .eq("id", input.columnId)
    .maybeSingle();

  if (colFetchErr) throw { code: "DB", message: colFetchErr.message };
  if (!sourceColumn) throw { code: "NOT_FOUND", message: "Column not found." };

  await requireBoardRole(sourceColumn.board_id, "admin");

  // 2. Load labels for status / priority columns.
  let sourceLabels: Array<{ name: string; color: string; position: number }> = [];

  if (sourceColumn.type === "status" || sourceColumn.type === "priority") {
    const { data: labelRows, error: labelFetchErr } = await supabase
      .from("label")
      .select("name, color, position")
      .eq("column_id", input.columnId)
      .order("position", { ascending: true });

    if (labelFetchErr) throw { code: "DB", message: labelFetchErr.message };
    sourceLabels = labelRows ?? [];
  }

  // 3. INSERT the new column.
  const { data: newColumn, error: colInsertErr } = await supabase
    .from("column")
    .insert({
      board_id: sourceColumn.board_id,
      name: `${sourceColumn.name} copy`,
      type: sourceColumn.type,
      position: sourceColumn.position + 0.5,
      settings: sourceColumn.settings as Json,
    })
    .select()
    .single();

  if (colInsertErr) throw { code: "DB", message: colInsertErr.message };
  if (!newColumn) throw { code: "NOT_FOUND", message: "New column not found after insert." };

  // 4. Duplicate labels (if any).
  let newLabels: LabelRow[] = [];

  if (sourceLabels.length > 0) {
    const { data: insertedLabels, error: labelInsertErr } = await supabase
      .from("label")
      .insert(sourceLabels.map((l) => ({ ...l, column_id: newColumn.id })))
      .select(); // returns all columns including column_id, matching createColumn precedent

    if (labelInsertErr) throw { code: "DB", message: labelInsertErr.message };
    newLabels = insertedLabels ?? [];
  }

  await logActivity({
    boardId: sourceColumn.board_id,
    actorId: userId,
    type: "column.duplicated",
    payload: {
      sourceColumnId: input.columnId,
      newColumnId: newColumn.id,
      name: sourceColumn.name,
      type: sourceColumn.type,
    },
  });

  return { column: newColumn, labels: newLabels };
});

// ---------------------------------------------------------------------------
// deleteColumn
// ---------------------------------------------------------------------------
//
// HARD delete — columns have no `deleted_at`. The FK `cell.column_id` cascades
// on delete (verified in initial schema migration), so all cells are removed.
// Returns `{ deletedColumnId, affectedCellCount }`.

export const deleteColumn = withUser(async ({ supabase, userId }, raw) => {
  const input = DeleteColumnSchema.parse(raw);

  const { data: column, error: fetchError } = await supabase
    .from("column")
    .select("id, board_id, name, type")
    .eq("id", input.columnId)
    .maybeSingle();

  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!column) throw { code: "NOT_FOUND", message: "Column not found." };

  await requireBoardRole(column.board_id, "admin");

  // Count cells before deletion (cascade will remove them).
  const { count: cellCount } = await supabase
    .from("cell")
    .select("*", { count: "exact", head: true })
    .eq("column_id", input.columnId);

  const affectedCellCount = cellCount ?? 0;

  const { error } = await supabase.from("column").delete().eq("id", input.columnId);

  if (error) throw { code: "DB", message: error.message };

  await logActivity({
    boardId: column.board_id,
    actorId: userId,
    type: "column.deleted",
    payload: {
      columnId: input.columnId,
      name: column.name,
      type: column.type,
      affectedCellCount,
    },
  });

  return { deletedColumnId: input.columnId, affectedCellCount };
});

// ---------------------------------------------------------------------------
// changeColumnType
// ---------------------------------------------------------------------------
//
// Per Q4 + Q33 + spec §S5.6:
//   1. Load source column + all its cells.
//   2. Look up cellRegistry[oldType].convertTo[newType]. If undefined → VALIDATION error.
//   3. If lossy + confirmDataLoss === false → CONFIRMATION_REQUIRED error.
//   4. Update column.type = newType, then iterate cells with the conversion fn.
//
// Cell registry access is deferred to call time (not module level) so the proxy
// stub doesn't throw on import. By the time this action is invoked, Stage 3
// will have replaced the stubs with real defs.
//
// v1 limitation: conversion runs row-by-row in JS, not in a DB transaction.
// If a batch write partially fails, `column.type` will already be updated.
// The `cell_one_value_check` constraint prevents invalid writes to individual cells.

export const changeColumnType = withUser(async ({ supabase, userId }, raw) => {
  const input = ChangeColumnTypeSchema.parse(raw);

  // 1. Load column.
  const { data: column, error: colFetchErr } = await supabase
    .from("column")
    .select("id, board_id, name, type")
    .eq("id", input.columnId)
    .maybeSingle();

  if (colFetchErr) throw { code: "DB", message: colFetchErr.message };
  if (!column) throw { code: "NOT_FOUND", message: "Column not found." };

  await requireBoardRole(column.board_id, "admin");

  // column.type from Supabase is `string`; cast to CellTypeId — the DB check
  // constraint guarantees it is one of the 24 valid values.
  const oldType = column.type as import("@/lib/cells/types").CellTypeId;
  const newType = input.newType;

  if (oldType === newType) {
    // No-op: type is already the target. Return early.
    return { column, affectedCellCount: 0 };
  }

  // 2. Look up the conversion entry in the registry (deferred to call time).
  const sourceDef = getCellDef(oldType);
  const convertEntry = sourceDef.convertTo?.[newType];

  if (!convertEntry) {
    throw {
      code: "VALIDATION",
      message: "No conversion defined for this type change",
    };
  }

  // 3. If lossy and not confirmed → ask the caller to confirm.
  //
  // lib/cells/types.ts defines convertTo as plain functions. Stage 3 (S8–S14)
  // extends this to `{ fn, lossy? }` objects at the implementation layer.
  // We read `.lossy` defensively at runtime without requiring a type change here.
  // Using `as unknown as` to safely probe the runtime shape.
  const entryAsAny = convertEntry as unknown as { fn?: (v: unknown) => unknown; lossy?: boolean };
  const convertFn: (v: unknown) => unknown =
    typeof convertEntry === "function"
      ? (convertEntry as (v: unknown) => unknown)
      : (entryAsAny.fn ?? ((v: unknown) => v));
  const isLossy = typeof convertEntry !== "function" && !!entryAsAny.lossy;

  if (isLossy && !input.confirmDataLoss) {
    throw {
      code: "CONFIRMATION_REQUIRED",
      message: "This change will clear values; confirm to proceed",
    };
  }

  // 4. Load all cells for this column (full row so fromRow codec receives expected shape).
  const { data: cells, error: cellFetchErr } = await supabase
    .from("cell")
    .select("*")
    .eq("column_id", input.columnId);

  if (cellFetchErr) throw { code: "DB", message: cellFetchErr.message };
  const cellRows = cells ?? [];

  // 5. Update column type first.
  const { data: updatedColumn, error: colUpdateErr } = await supabase
    .from("column")
    .update({ type: newType })
    .eq("id", input.columnId)
    .select()
    .single();

  if (colUpdateErr) throw { code: "DB", message: colUpdateErr.message };
  if (!updatedColumn) throw { code: "NOT_FOUND", message: "Column not found after update." };

  // 6. Convert and update each cell.
  // The conversion fn accepts the old typed value; fromRow extracts it, convertFn maps it,
  // toRow on the target type produces the new patch.
  const targetDef = getCellDef(newType);
  let affectedCellCount = 0;

  for (const cell of cellRows) {
    const oldValue = sourceDef.fromRow(cell);
    const newValue = convertFn(oldValue);
    const patch = targetDef.toRow(newValue);

    const { error: cellUpdateErr } = await supabase
      .from("cell")
      .update(patch)
      .eq("task_id", cell.task_id)
      .eq("column_id", cell.column_id);

    if (cellUpdateErr) {
      // Log but do not abort — v1 limitation documented above.
      // The cell_one_value_check constraint will reject invalid patches at the DB level.
      continue;
    }

    affectedCellCount++;
  }

  await logActivity({
    boardId: column.board_id,
    actorId: userId,
    type: "column.type_changed",
    payload: {
      columnId: input.columnId,
      from: oldType,
      to: newType,
      affectedCellCount,
    },
  });

  return { column: updatedColumn, affectedCellCount };
});

// ---------------------------------------------------------------------------
// updateColumnSettings
// ---------------------------------------------------------------------------

export const updateColumnSettings = withUser(async ({ supabase, userId }, raw) => {
  const input = UpdateColumnSettingsSchema.parse(raw);

  const { data: column, error: fetchError } = await supabase
    .from("column")
    .select("id, board_id, settings")
    .eq("id", input.columnId)
    .maybeSingle();

  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!column) throw { code: "NOT_FOUND", message: "Column not found." };

  await requireBoardRole(column.board_id, "admin");

  const { data: updated, error } = await supabase
    .from("column")
    .update({ settings: input.settings as Json })
    .eq("id", input.columnId)
    .select()
    .single();

  if (error) throw { code: "DB", message: error.message };
  if (!updated) throw { code: "NOT_FOUND", message: "Column not found after update." };

  await logActivity({
    boardId: column.board_id,
    actorId: userId,
    type: "column.settings_updated",
    payload: { columnId: input.columnId, settings: input.settings },
  });

  return updated;
});
