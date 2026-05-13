import { z } from "zod";
import { ViewConfigSchema, ViewKindSchema } from "@/lib/views/config-schema";

// ---------------------------------------------------------------------------
// CreateViewSchema
// ---------------------------------------------------------------------------

export const CreateViewSchema = z.object({
  boardId: z.string().uuid(),
  name: z.string().min(1).max(120),
  kind: ViewKindSchema,
  isShared: z.boolean().default(false),
  config: ViewConfigSchema.default({}),
});

// ---------------------------------------------------------------------------
// SaveViewSchema
// ---------------------------------------------------------------------------

export const SaveViewSchema = z.object({
  viewId: z.string().uuid(),
  config: ViewConfigSchema,
});

// ---------------------------------------------------------------------------
// RenameViewSchema
// ---------------------------------------------------------------------------

export const RenameViewSchema = z.object({
  viewId: z.string().uuid(),
  name: z.string().min(1).max(120),
});

// ---------------------------------------------------------------------------
// DuplicateViewSchema
// ---------------------------------------------------------------------------

export const DuplicateViewSchema = z.object({
  viewId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// DeleteViewSchema
// ---------------------------------------------------------------------------

export const DeleteViewSchema = z.object({
  viewId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// SetLastViewSchema
// ---------------------------------------------------------------------------

export const SetLastViewSchema = z.object({
  boardId: z.string().uuid(),
  viewId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// GlobalSearchSchema
// ---------------------------------------------------------------------------

export const GlobalSearchSchema = z.object({
  workspaceId: z.string().uuid(),
  q: z.string().min(1).max(200),
});

// ---------------------------------------------------------------------------
// Inferred input types
// ---------------------------------------------------------------------------

export type CreateViewInput = z.infer<typeof CreateViewSchema>;
export type SaveViewInput = z.infer<typeof SaveViewSchema>;
export type RenameViewInput = z.infer<typeof RenameViewSchema>;
export type DuplicateViewInput = z.infer<typeof DuplicateViewSchema>;
export type DeleteViewInput = z.infer<typeof DeleteViewSchema>;
export type SetLastViewInput = z.infer<typeof SetLastViewSchema>;
export type GlobalSearchInput = z.infer<typeof GlobalSearchSchema>;
