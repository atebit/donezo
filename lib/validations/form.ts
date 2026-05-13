import { z } from "zod";

/**
 * SubmitFormSchema — validates the payload sent to the `submitForm` server action.
 *
 * boardId  — the board the form view belongs to (used for role check).
 * viewId   — which view's form config to read (determines fields, targetGroupId, etc.).
 * values   — one entry per visible form field; value is typed at runtime against the
 *            column's cell def (z.unknown() here; toRow validates at call-time).
 */
export const SubmitFormSchema = z.object({
  boardId: z.string().uuid(),
  viewId: z.string().uuid(),
  values: z.array(
    z.object({
      columnId: z.string().uuid(),
      value: z.unknown(),
    }),
  ),
});

export type SubmitFormInput = z.infer<typeof SubmitFormSchema>;
