"use server";
import { withUser } from "@/lib/actions";
import { requireBoardRole } from "@/lib/authorization";
import { logger } from "@/lib/logger";
import { generateInvitationToken } from "@/lib/utils/invitation-token";
import { InviteToBoardSchema } from "@/lib/validations/invitation";

export const inviteToBoard = withUser(async ({ supabase, userId }, raw) => {
  const input = InviteToBoardSchema.parse(raw);
  await requireBoardRole(input.boardId, "admin");

  // Look up the board to get workspace_id (schema requires workspace_id not null on invitation).
  // The user's authed client can read this board because RLS allows admin+ board members.
  // TODO(F1): tighten once db:types regenerates the RPC + invitation types.
  // biome-ignore lint/suspicious/noExplicitAny: board + invitation tables cast until F1 tightens types
  const { data: board, error: boardError } = await (supabase as any)
    .from("board")
    .select("workspace_id")
    .eq("id", input.boardId)
    .single();
  if (boardError) throw { code: "DB", message: boardError.message };
  if (!board) throw { code: "NOT_FOUND", message: "Board not found." };

  const token = generateInvitationToken();
  // biome-ignore lint/suspicious/noExplicitAny: invitation table not yet in generated types; F1 tightens
  const { data, error } = await (supabase as any)
    .from("invitation")
    .insert({
      workspace_id: board.workspace_id,
      board_id: input.boardId,
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
    { token, email: input.email, boardId: input.boardId, workspaceId: board.workspace_id },
    "board invitation created (email send not yet wired — epic 13)",
  );
  return data;
});
