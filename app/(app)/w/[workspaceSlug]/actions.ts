"use server";
import { withUser } from "@/lib/actions";
import { requireWorkspaceRole } from "@/lib/authorization";
import { logger } from "@/lib/logger";
import { generateInvitationToken } from "@/lib/utils/invitation-token";
import { CreateBoardSchema } from "@/lib/validations/board";
import { InviteToWorkspaceSchema } from "@/lib/validations/invitation";

export const createBoard = withUser(async ({ supabase }, raw) => {
  const input = CreateBoardSchema.parse(raw);
  await requireWorkspaceRole(input.workspaceId, "member");
  // TODO(F1): tighten once db:types regenerates the RPC + invitation types.
  // biome-ignore lint/suspicious/noExplicitAny: RPC not yet in generated types; F1 tightens
  const { data, error } = await (supabase as any)
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
  // TODO(F1): tighten once db:types regenerates the RPC + invitation types.
  // biome-ignore lint/suspicious/noExplicitAny: invitation table not yet in generated types; F1 tightens
  const { data, error } = await (supabase as any)
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
  // TODO epic 13: send invitation email via Resend.
  logger.info(
    { token, email: input.email, workspaceId: input.workspaceId },
    "invitation created (email send not yet wired — epic 13)",
  );
  return data;
});
