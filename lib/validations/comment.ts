import { z } from "zod";

const TiptapNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    type: z.string(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(TiptapNodeSchema).optional(),
    marks: z
      .array(z.object({ type: z.string(), attrs: z.record(z.string(), z.unknown()).optional() }))
      .optional(),
    text: z.string().optional(),
  }),
);

export const TiptapDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(TiptapNodeSchema).optional(),
});

export const CreateCommentSchema = z.object({
  taskId: z.string().uuid(),
  body: TiptapDocSchema,
  bodyText: z.string().max(20_000),
});

export const EditCommentSchema = z.object({
  commentId: z.string().uuid(),
  body: TiptapDocSchema,
  bodyText: z.string().max(20_000),
});

export const DeleteCommentSchema = z.object({
  commentId: z.string().uuid(),
});

export const ReactCommentSchema = z.object({
  commentId: z.string().uuid(),
  emoji: z.string().min(1).max(32),
});

export const UnreactCommentSchema = ReactCommentSchema;

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
export type EditCommentInput = z.infer<typeof EditCommentSchema>;
export type DeleteCommentInput = z.infer<typeof DeleteCommentSchema>;
export type ReactCommentInput = z.infer<typeof ReactCommentSchema>;
export type UnreactCommentInput = z.infer<typeof UnreactCommentSchema>;
