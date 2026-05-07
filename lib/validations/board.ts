import { z } from "zod";

export const CreateBoardSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(120),
  isPrivate: z.boolean().default(false),
});
export type CreateBoardInput = z.infer<typeof CreateBoardSchema>;
