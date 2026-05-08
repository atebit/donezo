import { z } from "zod";

export const SetLastWorkspaceSchema = z.object({
  workspaceId: z.string().uuid(),
});
export type SetLastWorkspaceInput = z.infer<typeof SetLastWorkspaceSchema>;
