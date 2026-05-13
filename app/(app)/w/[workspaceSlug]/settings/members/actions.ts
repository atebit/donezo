"use server";

import { revalidateTag } from "next/cache";
import { InviteEmail } from "@/emails/invite/Invite";
import { withUser } from "@/lib/actions";
import { requireBoardRole, requireWorkspaceRole } from "@/lib/authorization";
import { sendEmail } from "@/lib/email/send";
import { logger } from "@/lib/logger";
import { emitRoleChangedNotification } from "@/lib/notifications/emitters";
import { ResendInvitationSchema, RevokeInvitationSchema } from "@/lib/validations/invitation";
import {
  RemoveWorkspaceMemberSchema,
  SetWorkspaceMemberRoleSchema,
} from "@/lib/validations/workspace";

export const setWorkspaceMemberRole = withUser(async ({ supabase, userId }, raw) => {
  const input = SetWorkspaceMemberRoleSchema.parse(raw);
  await requireWorkspaceRole(input.workspaceId, "admin");
  if (input.role === "owner") {
    await requireWorkspaceRole(input.workspaceId, "owner");
  }

  // Fetch old role for the notification payload.
  const { data: existing } = await supabase
    .from("workspace_member")
    .select("role")
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.userId)
    .maybeSingle();

  const { error } = await supabase
    .from("workspace_member")
    .update({ role: input.role })
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.userId);
  if (error) throw { code: "DB", message: error.message };

  // Emit role_changed notification (best-effort).
  void emitRoleChangedNotification({
    targetUserId: input.userId,
    actorId: userId,
    workspaceId: input.workspaceId,
    fromRole: existing?.role ?? null,
    toRole: input.role,
  });

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

export const resendInvitation = withUser(async ({ supabase, userId }, raw) => {
  const input = ResendInvitationSchema.parse(raw);
  const { data: inv, error: fetchError } = await supabase
    .from("invitation")
    .select("id, workspace_id, board_id, token, email, role")
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

  // Resend the invitation email (best-effort).
  void (async () => {
    try {
      const isBoardInvite = Boolean(inv.board_id);
      const [wsResult, inviterResult, boardResult] = await Promise.all([
        supabase.from("workspace").select("name").eq("id", inv.workspace_id).maybeSingle(),
        supabase.from("profile").select("display_name, email").eq("id", userId).maybeSingle(),
        isBoardInvite && inv.board_id
          ? supabase.from("board").select("name").eq("id", inv.board_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const workspaceName = wsResult.data?.name ?? "a workspace";
      const inviterName =
        inviterResult.data?.display_name ?? inviterResult.data?.email ?? "A teammate";
      const boardName = boardResult.data?.name ?? undefined;
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.donezo.app";
      await sendEmail({
        to: inv.email,
        subject: boardName
          ? `Reminder: You've been invited to the "${boardName}" board on Donezo`
          : `Reminder: You've been invited to join ${workspaceName} on Donezo`,
        react: InviteEmail({
          inviterName,
          workspaceName,
          acceptHref: `${siteUrl}/join/${inv.token}`,
          isExistingUser: false,
          ...(boardName ? { boardName } : {}),
        }),
        tag: isBoardInvite ? "board_invite_resend" : "workspace_invite_resend",
      });
    } catch (err) {
      logger.warn(
        { err, invitationId: input.invitationId },
        "resend invitation email failed (best-effort)",
      );
    }
  })();

  logger.info(
    { token: inv.token, invitationId: input.invitationId, workspaceId: inv.workspace_id },
    "invitation resent",
  );
  revalidateTag(`invitations:${inv.workspace_id}`);
});
