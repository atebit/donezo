/**
 * Cell type definition: vote
 *
 * TValue  : { userIds: string[] } | null  (array of user ids who voted)
 * TConfig : {}  (no per-column config)
 * Storage : cell.json_value
 *
 * Aggregation note:
 *   `sum` returns total votes across all cells (sum of array lengths).
 *   This is implemented inline since aggregateSum expects number[].
 *
 * Vote toggle:
 *   The Editor component handles toggling — it receives the optional
 *   `currentUserId` prop from the orchestrator (S15). When absent, the
 *   editor is a no-op (closes immediately without changing the value).
 */

import { ThumbsUp } from "lucide-react";

import { aggregateCount } from "@/lib/cells/aggregations";
import type { AggregationKind, CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";

export type VoteCellValue = { userIds: string[] };

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
function isVoteValue(v: unknown): v is VoteCellValue {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    "userIds" in v &&
    Array.isArray((v as Record<string, unknown>).userIds) &&
    ((v as Record<string, unknown>).userIds as unknown[]).every((id) => typeof id === "string")
  );
}

export const voteType: CellTypeDef<VoteCellValue, Record<string, never>> = {
  id: "vote",
  label: "Vote",
  icon: ThumbsUp,
  defaultConfig: {},
  defaultValue: null,
  editorMode: "inline",

  Cell,
  Editor,

  fromRow: (row) => {
    const raw = row?.json_value;
    if (isVoteValue(raw)) return raw;
    return null;
  },

  toRow: (value) => ({
    ...NULL_VALUE_PATCH,
    json_value: value && value.userIds.length > 0 ? { userIds: value.userIds } : null,
  }),

  filterOperators: ["gt", "lt", "is_empty", "is_not_empty"],

  matchesFilter: (value, op, operand) => {
    if (op === "is_empty") return value == null || value.userIds.length === 0;
    if (op === "is_not_empty") return value != null && value.userIds.length > 0;
    const count = value?.userIds.length ?? 0;
    const o = Number(operand);
    if (op === "gt") return count > o;
    if (op === "lt") return count < o;
    return false;
  },

  aggregations: ["sum"],

  aggregate: (values, kind: AggregationKind) => {
    if (kind === "sum") {
      // sum of array lengths — total votes across all cells
      return values.reduce((s, v) => s + (v?.userIds.length ?? 0), 0).toString();
    }
    if (kind === "count") return aggregateCount(values);
    return "—";
  },

  // v1: vote values are user-id arrays; no useful text representation without resolveUser.
  toSearchString: () => "",

  compare: (a, b) => {
    const aLen = a?.userIds.length ?? 0;
    const bLen = b?.userIds.length ?? 0;
    return aLen - bLen;
  },

  convertTo: {
    number: { fn: (v) => v?.userIds.length ?? 0 },
  },
};
