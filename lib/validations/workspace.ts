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

const SlugRegex = /^[a-z0-9-]+$/;

export const RenameWorkspaceSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1, "Name is required.").max(80),
});
export type RenameWorkspaceInput = z.infer<typeof RenameWorkspaceSchema>;

export const UpdateWorkspaceSlugSchema = z.object({
  workspaceId: z.string().uuid(),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(SlugRegex, "Use lowercase letters, numbers, and hyphens only."),
});
export type UpdateWorkspaceSlugInput = z.infer<typeof UpdateWorkspaceSlugSchema>;

export const DeleteWorkspaceSchema = z.object({
  workspaceId: z.string().uuid(),
  confirmName: z.string().min(1),
});
export type DeleteWorkspaceInput = z.infer<typeof DeleteWorkspaceSchema>;

export const SetWorkspaceMemberRoleSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["owner", "admin", "member", "viewer"]),
});
export type SetWorkspaceMemberRoleInput = z.infer<typeof SetWorkspaceMemberRoleSchema>;

export const RemoveWorkspaceMemberSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
});
export type RemoveWorkspaceMemberInput = z.infer<typeof RemoveWorkspaceMemberSchema>;
