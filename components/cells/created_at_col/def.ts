/**
 * Cell type definition: created_at_col
 *
 * TValue  : { createdAt: string } | null  (derived from task row)
 * TConfig : {}  (no per-column config)
 * Storage : NOT STORED — toRow returns {} (empty patch). The value is derived
 *           from the task row's `created_at` column.
 *
 * Per Q25: derived cells do not write to cell rows.
 */

import { Calendar } from "lucide-react";

import { aggregateCount } from "@/lib/cells/aggregations";
import type { CellRow, CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";

export type CreatedAtColValue = { createdAt: string };

function fromRow(_row: CellRow | undefined): CreatedAtColValue | null {
  // Derived — value comes from the task row, not the cell row.
  return null;
}

export const createdAtColType: CellTypeDef<CreatedAtColValue, Record<string, never>> = {
  id: "created_at_col",
  label: "Created at",
  icon: Calendar,
  defaultConfig: {},
  defaultValue: null,
  editorMode: "inline",

  Cell,
  Editor,

  fromRow,

  // Derived: no cell row patch required.
  toRow: () => ({}),

  filterOperators: [],

  matchesFilter: () => false,

  aggregations: ["count"],

  aggregate: (values, kind) => {
    if (kind === "count") return aggregateCount(values);
    return "—";
  },

  // v1: derived display-only; no useful searchable text.
  toSearchString: () => "",

  compare: (a, b) => {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  },

  convertTo: {},
};
