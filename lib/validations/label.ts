import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, "Must be a 6-digit hex color");

export const CreateLabelSchema = z.object({
  columnId: z.string().uuid(),
  name: z.string().min(1).max(60),
  color: hexColor,
  position: z.number(),
});
export type CreateLabelInput = z.infer<typeof CreateLabelSchema>;

export const RenameLabelSchema = z.object({
  labelId: z.string().uuid(),
  name: z.string().min(1).max(60),
});
export type RenameLabelInput = z.infer<typeof RenameLabelSchema>;

export const RecolorLabelSchema = z.object({
  labelId: z.string().uuid(),
  color: hexColor,
});
export type RecolorLabelInput = z.infer<typeof RecolorLabelSchema>;

export const ReorderLabelSchema = z.object({
  labelId: z.string().uuid(),
  position: z.number(),
});
export type ReorderLabelInput = z.infer<typeof ReorderLabelSchema>;

export const DeleteLabelSchema = z.object({
  labelId: z.string().uuid(),
});
export type DeleteLabelInput = z.infer<typeof DeleteLabelSchema>;
