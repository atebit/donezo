// value is `unknown` here; the server action validates per-type via cellRegistry[col.type].toRow(value).

import { z } from "zod";

export const SetCellValueSchema = z.object({
  taskId: z.string().uuid(),
  columnId: z.string().uuid(),
  /** Polymorphic value — server validates against the column's type via the registry's `def.toRow`. */
  value: z.unknown().nullable(),
});
export type SetCellValueInput = z.infer<typeof SetCellValueSchema>;

export const BulkSetCellValueSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(500),
  columnId: z.string().uuid(),
  value: z.unknown().nullable(),
});
export type BulkSetCellValueInput = z.infer<typeof BulkSetCellValueSchema>;
