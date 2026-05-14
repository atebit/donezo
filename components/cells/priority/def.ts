/**
 * Cell type definition: priority
 *
 * TValue  : { labelId: string } | null
 * TConfig : {}  (labels stored in `label` table, not column.settings)
 * Storage : cell.label_id
 *
 * Priority is identical to "status" in every aspect except:
 *   - id: "priority"
 *   - label: "Priority"
 *   - icon: AlertCircle
 *   - seed label set (Critical / High / Medium / Low vs Done / Stuck / Working on it / etc.)
 *
 * Cell, Editor, and StatusLabelEditor are imported from the status folder
 * per Q24: no duplication of component code.
 */

import { AlertCircle } from "lucide-react";
import type { StatusCellValue } from "@/components/cells/status/Cell";
// Shared components from the status folder — per Q24
import { Cell } from "@/components/cells/status/Cell";
import { Editor } from "@/components/cells/status/Editor";
import type { AggregateRenderDescriptor } from "@/lib/cells/aggregate-descriptors";
import { aggregateCount, aggregateCountEmpty } from "@/lib/cells/aggregations";
import type { CellTypeDef } from "@/lib/cells/types";
import { OperandEditor } from "./OperandEditor";

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

export const priorityType: CellTypeDef<StatusCellValue, Record<string, never>> = {
  id: "priority",
  label: "Priority",
  icon: AlertCircle,
  defaultConfig: {},
  defaultValue: null,
  editorMode: "popover",

  Cell,
  Editor,
  OperandEditor,

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
  defaultAggregation: "percent_by_label",

  aggregate: (values, kind, config): string | AggregateRenderDescriptor => {
    if (kind === "count") return aggregateCount(values);
    if (kind === "count_empty") return aggregateCountEmpty(values);
    if (kind === "percent_by_label") {
      // Build a label_distribution descriptor using labels from config._labels
      // (injected by FooterCell from the board store).
      const cfg = config as unknown as {
        _labels?: Array<{ id: string; name: string; color: string }>;
      };
      const labelDefs = cfg?._labels ?? [];

      const counts = new Map<string, number>();
      for (const v of values) {
        if (v == null) continue;
        counts.set(v.labelId, (counts.get(v.labelId) ?? 0) + 1);
      }

      const segments = Array.from(counts.entries()).map(([labelId, count]) => {
        const lbl = labelDefs.find((l) => l.id === labelId);
        return {
          labelId,
          count,
          color: lbl?.color ?? "var(--color-label-gray)",
          name: lbl?.name ?? labelId,
        };
      });

      return { kind: "label_distribution", segments };
    }
    return "—";
  },

  // v1: same label-resolution pattern as status. Config is Record<string, never>
  // in the type but the store may pass `{ labels: [...] }` at runtime.
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
    // priority → text: return the labelId as a string (v1 — name mapping is epic 14)
    text: { fn: (v) => v?.labelId ?? "" },
    // priority → status: direct 1:1 (same value shape; user remap may differ)
    status: { fn: (v) => v ?? null },
  },
};
