"use server";
import { InviteEmail } from "@/emails/invite/Invite";
import { withUser } from "@/lib/actions";
import { requireWorkspaceRole } from "@/lib/authorization";
import { sendEmail } from "@/lib/email/send";
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
  // Send invitation email (best-effort; skipped silently when RESEND_API_KEY is unset).
  void (async () => {
    try {
      // Fetch workspace name and inviter display name for the email.
      const [wsResult, inviterResult] = await Promise.all([
        supabase.from("workspace").select("name").eq("id", input.workspaceId).maybeSingle(),
        supabase.from("profile").select("display_name, email").eq("id", userId).maybeSingle(),
      ]);
      const workspaceName = wsResult.data?.name ?? "a workspace";
      const inviterName =
        inviterResult.data?.display_name ?? inviterResult.data?.email ?? "A teammate";
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.donezo.app";
      await sendEmail({
        to: input.email,
        subject: `You've been invited to join ${workspaceName} on Donezo`,
        react: InviteEmail({
          inviterName,
          workspaceName,
          acceptHref: `${siteUrl}/join/${token}`,
          isExistingUser: false, // conservatively assume new user
        }),
        tag: "workspace_invite",
      });
    } catch (err) {
      logger.warn(
        { err, email: input.email, workspaceId: input.workspaceId },
        "invitation email send failed (best-effort — invitation row already created)",
      );
    }
  })();
  return data;
});
