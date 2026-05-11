/**
 * Cell type definition: updated_by
 *
 * TValue  : { userId: string; updatedAt: string } | null  (derived from task row)
 * TConfig : {}  (no per-column config)
 * Storage : NOT STORED — toRow returns {} (empty patch). The value is derived
 *           from the task row's `updated_by` + `updated_at` columns.
 *
 * Per Q25: derived cells do not write to cell rows.
 */

import { UserCheck } from "lucide-react";

import { aggregateCountUnique } from "@/lib/cells/aggregations";
import type { CellRow, CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";

export type UpdatedByValue = { userId: string; updatedAt: string };

function fromRow(_row: CellRow | undefined): UpdatedByValue | null {
  // Derived — value comes from the task row, not the cell row.
  return null;
}

export const updatedByType: CellTypeDef<UpdatedByValue, Record<string, never>> = {
  id: "updated_by",
  label: "Updated by",
  icon: UserCheck,
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

  aggregations: ["count_unique"],

  aggregate: (values, kind) => {
    if (kind === "count_unique") return aggregateCountUnique(values.map((v) => v?.userId ?? null));
    return "—";
  },

  compare: (a, b) => {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    return a.updatedAt.localeCompare(b.updatedAt);
  },

  convertTo: {},
};
