/**
 * Default seed labels inserted by `createColumn` when the new column's type
 * is `status` or `priority`. Admins can rename / recolor / delete these after
 * the column is created.
 *
 * Color values match the visual fidelity table in docs/conversion-plan/07-column-system.md.
 * They are intentionally raw hex here (same precedent as lib/group-palette.ts) because
 * CSS tokens are only defined in app/globals.css and cannot be referenced from TS.
 */

import type { CellTypeId } from "@/lib/cells/types";

export const SEED_LABELS: Partial<
  Record<CellTypeId, Array<{ name: string; color: string; position: number }>>
> = {
  status: [
    { name: "Working on it", color: "#fdab3d", position: 1 },
    { name: "Done", color: "#00c875", position: 2 },
    { name: "Stuck", color: "#e2445c", position: 3 },
    { name: "Waiting for review", color: "#a25ddc", position: 4 },
    { name: "Pending", color: "#579bfc", position: 5 },
  ],
  priority: [
    { name: "Critical", color: "#333333", position: 1 },
    { name: "High", color: "#e2445c", position: 2 },
    { name: "Medium", color: "#fdab3d", position: 3 },
    { name: "Low", color: "#579bfc", position: 4 },
  ],
};
