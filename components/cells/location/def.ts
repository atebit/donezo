/**
 * Cell type definition: location
 *
 * TValue  : { lat: number; lng: number; label?: string } | null
 * TConfig : {}  (no per-column config)
 * Storage : cell.json_value
 */

import { MapPin } from "lucide-react";

import { aggregateCount } from "@/lib/cells/aggregations";
import type { CellRow, CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";

export type LocationValue = { lat: number; lng: number; label?: string };

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

function isLocationValue(v: unknown): v is LocationValue {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    "lat" in v &&
    "lng" in v &&
    typeof (v as Record<string, unknown>).lat === "number" &&
    typeof (v as Record<string, unknown>).lng === "number"
  );
}

function fromRow(row: CellRow | undefined): LocationValue | null {
  if (!row) return null;
  const raw = row.json_value;
  return isLocationValue(raw) ? raw : null;
}

export const locationType: CellTypeDef<LocationValue, Record<string, never>> = {
  id: "location",
  label: "Location",
  icon: MapPin,
  defaultConfig: {},
  defaultValue: null,
  editorMode: "popover",

  Cell,
  Editor,

  fromRow,

  toRow: (value) => ({
    ...NULL_VALUE_PATCH,
    json_value: value ? { lat: value.lat, lng: value.lng, label: value.label ?? null } : null,
  }),

  filterOperators: ["is_empty", "is_not_empty"],

  matchesFilter: (value, op) => {
    if (op === "is_empty") return value == null;
    if (op === "is_not_empty") return value != null;
    return false;
  },

  aggregations: ["count"],

  aggregate: (values, kind) => {
    if (kind === "count") return aggregateCount(values);
    return "—";
  },

  compare: (a, b) => {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    const labelA = a.label ?? `${a.lat},${a.lng}`;
    const labelB = b.label ?? `${b.lat},${b.lng}`;
    return labelA.localeCompare(labelB);
  },

  convertTo: {
    text: {
      fn: (v) => v?.label ?? (v ? `${v.lat}, ${v.lng}` : ""),
    },
  },
};
