/**
 * Cell type definition: formula
 *
 * TValue  : null (always — formula values are computed, not stored as cell values)
 * TConfig : { expression?: string }  (future use; ignored in v1)
 * Storage : NOT STORED — toRow returns {} (empty patch). Formula values are derived.
 *
 * Per Q4: formula ships as a registered stub with a "—" renderer + tooltip "coming soon".
 * No filtering, no aggregations, no type conversions in v1.
 */

import { Sigma } from "lucide-react";

import type { CellRow, CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";

export type FormulaConfig = { expression?: string };

function fromRow(_row: CellRow | undefined): null {
  // Formula values are computed server-side (future); not stored in the cell row.
  return null;
}

export const formulaType: CellTypeDef<null, FormulaConfig> = {
  id: "formula",
  label: "Formula",
  icon: Sigma,
  defaultConfig: {},
  defaultValue: null,
  editorMode: "inline",

  Cell,
  Editor,

  fromRow,

  // Derived: formula does not write to cell rows.
  toRow: () => ({}),

  filterOperators: [],

  matchesFilter: () => false,

  aggregations: [],

  aggregate: () => "—",

  compare: () => 0,

  convertTo: {},
};
