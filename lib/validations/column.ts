import { z } from "zod";

const cellTypeIds = [
  "text",
  "long_text",
  "status",
  "priority",
  "person",
  "date",
  "timeline",
  "number",
  "currency",
  "checkbox",
  "file",
  "link",
  "tags",
  "rating",
  "email",
  "phone",
  "country",
  "vote",
  "week",
  "location",
  "updated_by",
  "created_by",
  "created_at_col",
  "formula",
] as const;

export const CellTypeIdSchema = z.enum(cellTypeIds);
export type CellTypeId = z.infer<typeof CellTypeIdSchema>;

export const CreateColumnSchema = z.object({
  boardId: z.string().uuid(),
  name: z.string().min(1).max(120),
  type: CellTypeIdSchema,
  position: z.number(),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateColumnInput = z.infer<typeof CreateColumnSchema>;

export const RenameColumnSchema = z.object({
  columnId: z.string().uuid(),
  name: z.string().min(1).max(120),
});
export type RenameColumnInput = z.infer<typeof RenameColumnSchema>;

export const ReorderColumnSchema = z.object({
  columnId: z.string().uuid(),
  position: z.number(),
});
export type ReorderColumnInput = z.infer<typeof ReorderColumnSchema>;

export const DuplicateColumnSchema = z.object({
  columnId: z.string().uuid(),
});
export type DuplicateColumnInput = z.infer<typeof DuplicateColumnSchema>;

export const DeleteColumnSchema = z.object({
  columnId: z.string().uuid(),
});
export type DeleteColumnInput = z.infer<typeof DeleteColumnSchema>;

export const ChangeColumnTypeSchema = z.object({
  columnId: z.string().uuid(),
  newType: CellTypeIdSchema,
  /** When true, the action proceeds even if the conversion loses data. */
  confirmDataLoss: z.boolean().optional().default(false),
});
export type ChangeColumnTypeInput = z.infer<typeof ChangeColumnTypeSchema>;

export const UpdateColumnSettingsSchema = z.object({
  columnId: z.string().uuid(),
  settings: z.record(z.string(), z.unknown()),
});
export type UpdateColumnSettingsInput = z.infer<typeof UpdateColumnSettingsSchema>;
