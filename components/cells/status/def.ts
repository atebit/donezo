/**
 * Cell type definition: status
 *
 * TValue  : { labelId: string } | null
 * TConfig : {}  (labels are stored in the `label` table, not in column.settings)
 * Storage : cell.label_id
 *
 * The "priority" type shares Cell + Editor + StatusLabelEditor from this folder.
 * Priority's def.ts imports those components directly; there is no PriorityCell file.
 */

import { Circle } from "lucide-react";

import {
  aggregateCount,
  aggregateCountEmpty,
  aggregatePercentByLabel,
} from "@/lib/cells/aggregations";
import type { AggregationKind, CellTypeDef } from "@/lib/cells/types";
import type { StatusCellValue } from "./Cell";
import { Cell } from "./Cell";
import { Editor } from "./Editor";

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

export const statusType: CellTypeDef<StatusCellValue, Record<string, never>> = {
  id: "status",
  label: "Status",
  icon: Circle,
  defaultConfig: {},
  defaultValue: null,
  editorMode: "popover",

  Cell,
  Editor,

  fromRow: (row) => (row?.label_id ? { labelId: row.label_id } : null),

  toRow: (value) => ({
    ...NULL_VALUE_PATCH,
    label_id: value?.labelId ?? null,
  }),

  filterOperators: ["equals", "not_equals", "is_empty", "in"],

  matchesFilter: (value, op, operand) => {
    if (op === "is_empty") return value == null;
    if (op === "equals") {
      return value?.labelId === String(operand ?? "");
    }
    if (op === "not_equals") {
      return value?.labelId !== String(operand ?? "");
    }
    if (op === "in") {
      const ids = Array.isArray(operand) ? operand.map(String) : [];
      return value != null && ids.includes(value.labelId);
    }
    return false;
  },

  aggregations: ["count", "count_empty", "percent_by_label"],

  aggregate: (values, kind, _config) => {
    if (kind === "count") return aggregateCount(values);
    if (kind === "count_empty") return aggregateCountEmpty(values);
    if (kind === "percent_by_label") {
      // aggregatePercentByLabel needs the label definitions to map ids → names.
      // The aggregate function receives typed values; label metadata is not
      // available here without the store. For v1, we compute percentages using
      // labelId as the bucket key and display the raw id.
      // POLISH ITEM (epic 14): inject label metadata so names display correctly.
      return aggregatePercentByLabel(values, []);
    }
    return "—";
  },

  // v1: config is Record<string, never> in the type but the board store may
  // pass a richer object with a `labels` array at runtime when the column is
  // fully hydrated. We cast through unknown to avoid strict-TS complaints.
  toSearchString: (value, config) => {
    if (!value?.labelId) return "";
    const cfg = config as unknown as { labels?: Array<{ id: string; title: string }> };
    const lbl = cfg?.labels?.find((l) => l.id === value.labelId);
    return lbl?.title ?? "";
  },

  compare: (a, b) => {
    // Null sorts last; equal label IDs are stable (0).
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return a.labelId.localeCompare(b.labelId);
  },

  convertTo: {
    // status → text: return the labelId as a string (v1 — label name mapping is epic 14)
    text: { fn: (v) => v?.labelId ?? "" },
    // status → priority: direct 1:1 (same labelId — user must remap if label sets differ)
    priority: { fn: (v) => v ?? null },
  },
};

// Re-export AggregationKind so priority/def.ts doesn't need to re-import it
export type { AggregationKind };
