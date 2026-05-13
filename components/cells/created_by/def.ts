/**
 * Cell type definition: created_by
 *
 * TValue  : { userId: string; createdAt: string } | null  (derived from task row)
 * TConfig : {}  (no per-column config)
 * Storage : NOT STORED — toRow returns {} (empty patch). The value is derived
 *           from the task row's `created_by` + `created_at` columns.
 *
 * Per Q25: derived cells do not write to cell rows.
 */

import { UserPlus } from "lucide-react";

import { aggregateCountUnique } from "@/lib/cells/aggregations";
import type { CellRow, CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";

export type CreatedByValue = { userId: string; createdAt: string };

function fromRow(_row: CellRow | undefined): CreatedByValue | null {
  // Derived — value comes from the task row, not the cell row.
  return null;
}

export const createdByType: CellTypeDef<CreatedByValue, Record<string, never>> = {
  id: "created_by",
  label: "Created by",
  icon: UserPlus,
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
