/**
 * Cell type registry — skeleton.
 *
 * Every key is currently the NOT_IMPLEMENTED Proxy. Stage 3 slices (S8–S14)
 * replace each key with the real per-type definition imported from
 * `components/cells/<type>/def.ts`.
 *
 * IMPORTANT for Stage 3 slice authors: edit ONLY the keys your slice owns.
 * Keep one key per line so parallel-slice diffs do not conflict.
 */

import type { CellTypeDef, CellTypeId } from "./types";

/**
 * Sentinel used for cell types that have not yet been implemented.
 * Accessing any property throws a descriptive error at runtime rather
 * than silently returning undefined.
 */
const NOT_IMPLEMENTED = new Proxy({} as CellTypeDef<unknown, unknown>, {
  get(_target, prop) {
    throw new Error(
      `cellRegistry: type not yet implemented (accessing property "${String(prop)}")`,
    );
  },
});

// biome-ignore lint/suspicious/noExplicitAny: registry holds heterogeneous per-type defs; each CellTypeDef uses its own TValue/TConfig — any is intentional here.
export const cellRegistry: Record<CellTypeId, CellTypeDef<any, any>> = {
  text: NOT_IMPLEMENTED,
  long_text: NOT_IMPLEMENTED,
  status: NOT_IMPLEMENTED,
  priority: NOT_IMPLEMENTED,
  person: NOT_IMPLEMENTED,
  date: NOT_IMPLEMENTED,
  timeline: NOT_IMPLEMENTED,
  number: NOT_IMPLEMENTED,
  currency: NOT_IMPLEMENTED,
  checkbox: NOT_IMPLEMENTED,
  file: NOT_IMPLEMENTED,
  link: NOT_IMPLEMENTED,
  tags: NOT_IMPLEMENTED,
  rating: NOT_IMPLEMENTED,
  email: NOT_IMPLEMENTED,
  phone: NOT_IMPLEMENTED,
  country: NOT_IMPLEMENTED,
  vote: NOT_IMPLEMENTED,
  week: NOT_IMPLEMENTED,
  location: NOT_IMPLEMENTED,
  updated_by: NOT_IMPLEMENTED,
  created_by: NOT_IMPLEMENTED,
  created_at_col: NOT_IMPLEMENTED,
  formula: NOT_IMPLEMENTED,
};

/** Look up a cell type definition by its string id. */
// biome-ignore lint/suspicious/noExplicitAny: same rationale as cellRegistry — callers narrow the type at usage site.
export function getCellDef(type: CellTypeId): CellTypeDef<any, any> {
  return cellRegistry[type];
}
