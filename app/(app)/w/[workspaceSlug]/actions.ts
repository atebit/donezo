"use server";
import { withUser } from "@/lib/actions";
import { requireWorkspaceRole } from "@/lib/authorization";
import { logger } from "@/lib/logger";
import { emitWorkspaceInviteNotification } from "@/lib/notifications/emitters";
import { generateInvitationToken } from "@/lib/utils/invitation-token";
import { CreateBoardSchema } from "@/lib/validations/board";
import { InviteToWorkspaceSchema } from "@/lib/validations/invitation";

export const createBoard = withUser(async ({ supabase }, raw) => {
  const input = CreateBoardSchema.parse(raw);
  await requireWorkspaceRole(input.workspaceId, "member");
  const { data, error } = await supabase
    .rpc("create_board", {
      p_workspace_id: input.workspaceId,
      p_name: input.name,
      p_is_private: input.isPrivate,
    })
    .single();
  if (error) throw { code: "DB", message: error.message };
  return data;
});

export const inviteToWorkspace = withUser(async ({ supabase, userId }, raw) => {
  const input = InviteToWorkspaceSchema.parse(raw);
  await requireWorkspaceRole(input.workspaceId, "admin");
  const token = generateInvitationToken();
  const { data, error } = await supabase
    .from("invitation")
    .insert({
      workspace_id: input.workspaceId,
      email: input.email.toLowerCase(),
      role: input.role,
      invited_by: userId,
      token,
    })
    .select()
    .single();
  if (error) throw { code: "DB", message: error.message };
  // In-app notification (best-effort — only fires if invitee already has a profile).
  void emitWorkspaceInviteNotification({
    workspaceId: input.workspaceId,
    invitationId: data.id,
    inviteeEmail: input.email,
    actorId: userId,
  });
  // TODO epic 13 (slice 2C): send invitation email via Resend.
  logger.info(
    { token, email: input.email, workspaceId: input.workspaceId },
    "invitation created (email send not yet wired — epic 13 slice 2C)",
  );
  return data;
});
