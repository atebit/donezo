import { z } from "zod";

// owner is excluded — invitations cannot grant owner role (see invitation.role check constraint)
const Role = z.enum(["admin", "member", "viewer"]);

export const InviteToWorkspaceSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().email(),
  role: Role,
});
export type InviteToWorkspaceInput = z.infer<typeof InviteToWorkspaceSchema>;

export const InviteToBoardSchema = z.object({
  boardId: z.string().uuid(),
  email: z.string().email(),
  role: Role,
});
export type InviteToBoardInput = z.infer<typeof InviteToBoardSchema>;

export const AcceptInvitationSchema = z.object({
  token: z.string().min(32).max(128),
});
export type AcceptInvitationInput = z.infer<typeof AcceptInvitationSchema>;
