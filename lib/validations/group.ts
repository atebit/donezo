import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, "Must be a 6-digit hex color (e.g. #a1b2c3)");

export const CreateGroupSchema = z.object({
  boardId: z.string().uuid(),
  name: z.string().min(1).max(120),
  color: hexColor,
  position: z.number(),
});
export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;

export const RenameGroupSchema = z.object({
  groupId: z.string().uuid(),
  name: z.string().min(1).max(120),
});
export type RenameGroupInput = z.infer<typeof RenameGroupSchema>;

export const RecolorGroupSchema = z.object({
  groupId: z.string().uuid(),
  color: hexColor,
});
export type RecolorGroupInput = z.infer<typeof RecolorGroupSchema>;

export const ReorderGroupSchema = z.object({
  groupId: z.string().uuid(),
  position: z.number(),
});
export type ReorderGroupInput = z.infer<typeof ReorderGroupSchema>;

export const DuplicateGroupSchema = z.object({
  groupId: z.string().uuid(),
});
export type DuplicateGroupInput = z.infer<typeof DuplicateGroupSchema>;

export const DeleteGroupSchema = z.object({
  groupId: z.string().uuid(),
});
export type DeleteGroupInput = z.infer<typeof DeleteGroupSchema>;
