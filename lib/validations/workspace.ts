import { z } from "zod";

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1, "Name is required.").max(80, "Name must be 80 characters or fewer."),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only."),
});
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;
