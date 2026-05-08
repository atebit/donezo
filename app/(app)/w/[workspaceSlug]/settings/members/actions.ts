"use server";

import { revalidateTag } from "next/cache";
import { withUser } from "@/lib/actions";
import { requireBoardRole, requireWorkspaceRole } from "@/lib/authorization";
import { logger } from "@/lib/logger";
import { ResendInvitationSchema, RevokeInvitationSchema } from "@/lib/validations/invitation";
import {
  RemoveWorkspaceMemberSchema,
  SetWorkspaceMemberRoleSchema,
} from "@/lib/validations/workspace";

export const setWorkspaceMemberRole = withUser(async ({ supabase }, raw) => {
  const input = SetWorkspaceMemberRoleSchema.parse(raw);
  await requireWorkspaceRole(input.workspaceId, "admin");
  if (input.role === "owner") {
    await requireWorkspaceRole(input.workspaceId, "owner");
  }
  const { error } = await supabase
    .from("workspace_member")
    .update({ role: input.role })
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.userId);
  if (error) throw { code: "DB", message: error.message };
  revalidateTag(`workspace-members:${input.workspaceId}`);
});

export const removeWorkspaceMember = withUser(async ({ supabase }, raw) => {
  const input = RemoveWorkspaceMemberSchema.parse(raw);
  await requireWorkspaceRole(input.workspaceId, "admin");
  const { error } = await supabase
    .from("workspace_member")
    .delete()
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.userId);
  if (error) throw { code: "DB", message: error.message };
  revalidateTag(`workspace-members:${input.workspaceId}`);
});

export const revokeInvitation = withUser(async ({ supabase }, raw) => {
  const input = RevokeInvitationSchema.parse(raw);
  const { data: inv, error: fetchError } = await supabase
    .from("invitation")
    .select("id, workspace_id, board_id")
    .eq("id", input.invitationId)
    .single();
  if (fetchError || !inv) throw { code: "NOT_FOUND", message: "Invitation not found." };
  if (inv.board_id) {
    await requireBoardRole(inv.board_id, "admin");
  } else {
    await requireWorkspaceRole(inv.workspace_id, "admin");
  }
  const { error } = await supabase
    .from("invitation")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", input.invitationId);
  if (error) throw { code: "DB", message: error.message };
  revalidateTag(`invitations:${inv.workspace_id}`);
});

export const resendInvitation = withUser(async ({ supabase }, raw) => {
  const input = ResendInvitationSchema.parse(raw);
  const { data: inv, error: fetchError } = await supabase
    .from("invitation")
    .select("id, workspace_id, board_id, token")
    .eq("id", input.invitationId)
    .single();
  if (fetchError || !inv) throw { code: "NOT_FOUND", message: "Invitation not found." };
  if (inv.board_id) {
    await requireBoardRole(inv.board_id, "admin");
  } else {
    await requireWorkspaceRole(inv.workspace_id, "admin");
  }
  const newExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("invitation")
    .update({ expires_at: newExpiresAt })
    .eq("id", input.invitationId);
  if (error) throw { code: "DB", message: error.message };
  // TODO epic 13: resend invitation email via Resend.
  logger.info(
    { token: inv.token, invitationId: input.invitationId, workspaceId: inv.workspace_id },
    "invitation resent (email send not yet wired — epic 13)",
  );
  revalidateTag(`invitations:${inv.workspace_id}`);
});
