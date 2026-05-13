"use server";
import { revalidateTag } from "next/cache";
import { withUser } from "@/lib/actions";
import { requireBoardRole } from "@/lib/authorization";
import { logger } from "@/lib/logger";
import {
  emitBoardInviteNotification,
  emitRoleChangedNotification,
} from "@/lib/notifications/emitters";
import { generateInvitationToken } from "@/lib/utils/invitation-token";
import { RemoveBoardMemberSchema, SetBoardMemberRoleSchema } from "@/lib/validations/board";
import { InviteToBoardSchema } from "@/lib/validations/invitation";

export const setBoardMemberRole = withUser(async ({ supabase, userId }, raw) => {
  const input = SetBoardMemberRoleSchema.parse(raw);
  await requireBoardRole(input.boardId, "admin");

  // Fetch old role for the notification payload.
  const { data: existing } = await supabase
    .from("board_member")
    .select("role")
    .eq("board_id", input.boardId)
    .eq("user_id", input.userId)
    .maybeSingle();

  const { error } = await supabase
    .from("board_member")
    .update({ role: input.role })
    .eq("board_id", input.boardId)
    .eq("user_id", input.userId);
  if (error) throw { code: "DB", message: error.message };

  // Emit role_changed notification (best-effort).
  void emitRoleChangedNotification({
    targetUserId: input.userId,
    actorId: userId,
    boardId: input.boardId,
    fromRole: existing?.role ?? null,
    toRole: input.role,
  });

  revalidateTag(`board-members:${input.boardId}`);
});

export const removeBoardMember = withUser(async ({ supabase }, raw) => {
  const input = RemoveBoardMemberSchema.parse(raw);
  await requireBoardRole(input.boardId, "admin");

  const { error } = await supabase
    .from("board_member")
    .delete()
    .eq("board_id", input.boardId)
    .eq("user_id", input.userId);
  if (error) throw { code: "DB", message: error.message };

  revalidateTag(`board-members:${input.boardId}`);
});

// ---------------------------------------------------------------------------
// inviteToBoard
// ---------------------------------------------------------------------------

/**
 * Invite a user to a specific board by email.
 *
 * Mirrors `inviteToWorkspace` (workspace-level action):
 *   - Requires admin+ on the board.
 *   - Inserts an `invitation` row with board_id set.
 *   - Emits a board_invite in-app notification when the invitee already has a profile.
 *   - The email send itself lives in slice 2C; this action only handles the in-app path.
 *
 * The `invitation` table requires `workspace_id` (NOT NULL). We load the board
 * to get workspace_id before inserting.
 */
export const inviteToBoard = withUser(async ({ supabase, userId }, raw) => {
  const input = InviteToBoardSchema.parse(raw);

  // 1. Verify actor has admin+ on the board.
  await requireBoardRole(input.boardId, "admin");

  // 2. Load board to get workspace_id (required by invitation table).
  const { data: board, error: boardError } = await supabase
    .from("board")
    .select("id, workspace_id")
    .eq("id", input.boardId)
    .maybeSingle();

  if (boardError) throw { code: "DB", message: boardError.message };
  if (!board) throw { code: "NOT_FOUND", message: "Board not found." };

  // 3. Insert the invitation row.
  const token = generateInvitationToken();
  const { data, error } = await supabase
    .from("invitation")
    .insert({
      board_id: input.boardId,
      workspace_id: board.workspace_id,
      email: input.email.toLowerCase(),
      role: input.role,
      invited_by: userId,
      token,
    })
    .select()
    .single();

  if (error) throw { code: "DB", message: error.message };

  // 4. In-app notification (best-effort — only fires if invitee already has a profile).
  void emitBoardInviteNotification({
    boardId: input.boardId,
    workspaceId: board.workspace_id,
    invitationId: data.id,
    inviteeEmail: input.email,
    actorId: userId,
  });

  // TODO epic 13 (slice 2C): send board invitation email via Resend.
  logger.info(
    { token, email: input.email, boardId: input.boardId },
    "board invitation created (email send not yet wired — epic 13 slice 2C)",
  );

  return data;
});
