/**
 * Cell type definition: country
 *
 * TValue  : string  (ISO 3166-1 alpha-2 code, e.g. "US")
 * TConfig : {}      (no per-column config)
 * Storage : cell.text_value
 */

import { Globe } from "lucide-react";

import { aggregateCountUnique } from "@/lib/cells/aggregations";
import type { CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";
import { findCountryByCode } from "./iso-list";

/** All value columns in the `cell` table — explicit null-out per Q35. */
const NULL_VALUE_PATCH = {
  text_value: null,
  number_value: null,
  boolean_value: null,
  date_value: null,
  date_end_value: null,
  label_id: null,
  json_value: null,
} as const;

export const countryType: CellTypeDef<string, Record<string, never>> = {
  id: "country",
  label: "Country",
  icon: Globe,
  defaultConfig: {},
  defaultValue: null,
  editorMode: "inline",

  Cell,
  Editor,

  fromRow: (row) => row?.text_value ?? null,

  toRow: (value) => ({
    ...NULL_VALUE_PATCH,
    text_value: value,
  }),

  filterOperators: ["equals", "in", "is_empty"],

  matchesFilter: (value, op, operand) => {
    if (op === "is_empty") return value == null || value === "";
    const v = (value ?? "").toUpperCase();
    if (op === "equals") return v === String(operand ?? "").toUpperCase();
    if (op === "in") {
      const list = Array.isArray(operand) ? operand : [];
      return list.map((x: unknown) => String(x).toUpperCase()).includes(v);
    }
    return false;
  },

  aggregations: ["count_unique"],

  aggregate: (values, kind) => {
    if (kind === "count_unique") return aggregateCountUnique(values);
    return "—";
  },

  compare: (a, b) => {
    // Compare by full country name for a natural sort experience.
    const nameA = a ? (findCountryByCode(a)?.name ?? a) : "";
    const nameB = b ? (findCountryByCode(b)?.name ?? b) : "";
    if (!a && !b) return 0;
    if (!a) return -1;
    if (!b) return 1;
    return nameA.localeCompare(nameB);
  },

  convertTo: {
    text: { fn: (v) => v ?? null },
  },
};
