/**
 * Cell type definition: person
 *
 * TValue  : { userIds: string[] } | null  (multi-select)
 * TConfig : {}  (no per-column config)
 * Storage : cell.json_value
 */

import { Users } from "lucide-react";

import { aggregateCount, aggregateCountEmpty } from "@/lib/cells/aggregations";
import type { AggregationKind, CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";

export type PersonCellValue = { userIds: string[] };

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

/** Runtime guard: validates that an unknown JSON value has the `{ userIds: string[] }` shape. */
function isPersonValue(v: unknown): v is PersonCellValue {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    "userIds" in v &&
    Array.isArray((v as Record<string, unknown>).userIds) &&
    ((v as Record<string, unknown>).userIds as unknown[]).every((id) => typeof id === "string")
  );
}

export const personType: CellTypeDef<PersonCellValue, Record<string, never>> = {
  id: "person",
  label: "Person",
  icon: Users,
  defaultConfig: {},
  defaultValue: null,
  editorMode: "popover",

  Cell,
  Editor,

  fromRow: (row) => {
    const raw = row?.json_value;
    if (isPersonValue(raw)) return raw;
    return null;
  },

  toRow: (value) => ({
    ...NULL_VALUE_PATCH,
    json_value: value ? { userIds: value.userIds } : null,
  }),

  filterOperators: ["equals", "in", "is_empty", "is_not_empty"],

  matchesFilter: (value, op, operand) => {
    if (op === "is_empty") return value == null || value.userIds.length === 0;
    if (op === "is_not_empty") return value != null && value.userIds.length > 0;
    if (op === "equals") {
      const id = String(operand ?? "");
      return value?.userIds.includes(id) ?? false;
    }
    if (op === "in") {
      const ids = Array.isArray(operand) ? operand.map(String) : [];
      return value?.userIds.some((uid) => ids.includes(uid)) ?? false;
    }
    return false;
  },

  aggregations: ["count", "count_empty", "count_unique"],

  aggregate: (values, kind: AggregationKind) => {
    if (kind === "count") return aggregateCount(values);
    if (kind === "count_empty")
      return aggregateCountEmpty(
        values.map((v) => (v == null || v.userIds.length === 0 ? null : v)),
      );
    if (kind === "count_unique") {
      const unique = new Set<string>();
      for (const v of values) {
        if (v != null) {
          for (const id of v.userIds) {
            unique.add(id);
          }
        }
      }
      return unique.size.toString();
    }
    return "—";
  },

  // v1 fallback: person values are arrays of user_ids. Resolving to display
  // names requires the member roster which isn't accessible from a pure function.
  // v1.5 will pass a resolveUser ctx into toSearchString.
  toSearchString: () => "",

  compare: (a, b) => {
    const aLen = a?.userIds.length ?? 0;
    const bLen = b?.userIds.length ?? 0;
    return aLen - bLen;
  },

  convertTo: {
    text: { fn: (v) => v?.userIds?.join(", ") ?? "" },
  },
};
