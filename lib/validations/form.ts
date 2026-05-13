import { z } from "zod";

/**
 * SubmitFormSchema — validates the input to the `submitForm` server action.
 *
 * The same schema validates both client-side (before optimistic state) and
 * server-side (inside the action). A single Zod schema per Epic 12 stack
 * conventions (React Hook Form + Zod, same schema client + server).
 *
 * `values` is an array of per-field objects. Each object carries a `columnId`
 * identifying which column to write, plus the typed `value` (unknown at schema
 * level; typed narrowly at the cell-registry level when building the SQL
 * payload).
 */
export const SubmitFormSchema = z.object({
  boardId: z.string().uuid("boardId must be a valid UUID"),
  viewId: z.string().uuid("viewId must be a valid UUID"),
  values: z.array(
    z.object({
      columnId: z.string().uuid("columnId must be a valid UUID"),
      /** Typed value as understood by the cell registry. Unknown at schema level. */
      value: z.unknown(),
    }),
  ),
});

export type SubmitFormInput = z.infer<typeof SubmitFormSchema>;
