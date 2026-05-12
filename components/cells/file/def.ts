/**
 * Cell type definition: file
 *
 * TValue  : { attachmentIds: string[] } | null
 * TConfig : {}  (no per-column config)
 * Storage : cell.json_value
 *
 * Editor: popover — renders inside Base UI Popover shell provided by CellEditor orchestrator.
 *   - Top: FileDropzone for adding new attachments.
 *   - Below: list of existing attachments with download + delete.
 *   - onChange appends / removes attachment ids; CellEditor fires wrappedSetCellValue.
 *
 * Cell: renders up to 3 thumbnails + overflow "+N" chip. Empty state: Paperclip + "—".
 *
 * aggregations: "sum" = total attachment count across all cells in the column.
 * convertTo: {} — file values can't be converted to other types.
 */

import { Paperclip } from "lucide-react";

import { aggregateCount } from "@/lib/cells/aggregations";
import type { AggregationKind, CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";

export type FileCellValue = { attachmentIds: string[] };

/** All value columns in the `cell` table — every toRow must set all 7 explicitly. */
const NULL_VALUE_PATCH = {
  text_value: null,
  number_value: null,
  boolean_value: null,
  date_value: null,
  date_end_value: null,
  label_id: null,
  json_value: null,
} as const;

/** Runtime guard: validates that an unknown JSON value has the `{ attachmentIds: string[] }` shape. */
function isFileValue(v: unknown): v is FileCellValue {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    "attachmentIds" in v &&
    Array.isArray((v as Record<string, unknown>).attachmentIds) &&
    ((v as Record<string, unknown>).attachmentIds as unknown[]).every(
      (id) => typeof id === "string",
    )
  );
}

export const fileType: CellTypeDef<FileCellValue, Record<string, never>> = {
  id: "file",
  label: "File",
  icon: Paperclip,
  defaultConfig: {},
  defaultValue: null,
  editorMode: "popover",

  Cell,
  Editor,

  fromRow: (row) => {
    const raw = row?.json_value;
    if (isFileValue(raw)) return raw;
    return null;
  },

  toRow: (value) => ({
    ...NULL_VALUE_PATCH,
    json_value:
      value && value.attachmentIds.length > 0 ? { attachmentIds: value.attachmentIds } : null,
  }),

  filterOperators: ["is_empty", "is_not_empty"],

  matchesFilter: (value, op) => {
    if (op === "is_empty") return value == null || value.attachmentIds.length === 0;
    if (op === "is_not_empty") return value != null && value.attachmentIds.length > 0;
    return false;
  },

  aggregations: ["sum"],

  aggregate: (values, kind: AggregationKind) => {
    if (kind === "sum") {
      // sum of array lengths — total attachments across all cells
      return values.reduce((s, v) => s + (v?.attachmentIds.length ?? 0), 0).toString();
    }
    if (kind === "count") return aggregateCount(values);
    return "—";
  },

  compare: (a, b) => {
    const aLen = a?.attachmentIds.length ?? 0;
    const bLen = b?.attachmentIds.length ?? 0;
    return aLen - bLen;
  },

  convertTo: {},
};
