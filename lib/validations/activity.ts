import { z } from "zod";

export const ActivityFilterSchema = z.object({
  actorIds: z.array(z.string().uuid()).optional(),
  actionGroups: z.array(z.enum(["task", "group", "column", "cell", "comment", "label"])).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export const ListBoardActivitySchema = z.object({
  boardId: z.string().uuid(),
  filters: ActivityFilterSchema.optional(),
  cursor: z.string().nullable().optional(),
});

export type ActivityFilters = z.infer<typeof ActivityFilterSchema>;
