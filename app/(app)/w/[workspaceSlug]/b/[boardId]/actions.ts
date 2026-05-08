"use server";
import { revalidateTag } from "next/cache";
import { withUser } from "@/lib/actions";
import { requireBoardRole, requireWorkspaceRole } from "@/lib/authorization";
import { logger } from "@/lib/logger";
import { generateInvitationToken } from "@/lib/utils/invitation-token";
import {
  ArchiveBoardSchema,
  DeleteBoardSchema,
  DuplicateBoardSchema,
  RenameBoardSchema,
  RestoreBoardSchema,
  StarBoardSchema,
} from "@/lib/validations/board";
import { InviteToBoardSchema } from "@/lib/validations/invitation";

export const inviteToBoard = withUser(async ({ supabase, userId }, raw) => {
  const input = InviteToBoardSchema.parse(raw);
  await requireBoardRole(input.boardId, "admin");

  // Look up the board to get workspace_id (schema requires workspace_id not null on invitation).
  // The user's authed client can read this board because RLS allows admin+ board members.
  const { data: board, error: boardError } = await supabase
    .from("board")
    .select("workspace_id")
    .eq("id", input.boardId)
    .single();
  if (boardError) throw { code: "DB", message: boardError.message };
  if (!board) throw { code: "NOT_FOUND", message: "Board not found." };

  const token = generateInvitationToken();
  const { data, error } = await supabase
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

export const renameBoard = withUser(async ({ supabase }, raw) => {
  const input = RenameBoardSchema.parse(raw);
  await requireBoardRole(input.boardId, "member");

  const { error } = await supabase
    .from("board")
    .update({ name: input.name, updated_at: new Date().toISOString() })
    .eq("id", input.boardId);
  if (error) throw { code: "DB", message: error.message };

  revalidateTag(`board:${input.boardId}`);
});

export const starBoard = withUser(async ({ supabase, userId }, raw) => {
  const input = StarBoardSchema.parse(raw);
  await requireBoardRole(input.boardId, "viewer");

  // user_starred_board is not in generated types yet — types updated in F1
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  if (input.starred) {
    const { error } = await sb
      .from("user_starred_board")
      .upsert(
        { user_id: userId, board_id: input.boardId },
        { onConflict: "user_id,board_id", ignoreDuplicates: true },
      );
    if (error) throw { code: "DB", message: (error as { message: string }).message };
  } else {
    const { error } = await sb
      .from("user_starred_board")
      .delete()
      .eq("user_id", userId)
      .eq("board_id", input.boardId);
    if (error) throw { code: "DB", message: (error as { message: string }).message };
  }

  revalidateTag(`starred:${userId}`);
  revalidateTag(`board:${input.boardId}`);
});

export const archiveBoard = withUser(async ({ supabase }, raw) => {
  const input = ArchiveBoardSchema.parse(raw);
  await requireBoardRole(input.boardId, "admin");

  // Fetch workspace_id first so we can revalidate the boards list.
  const { data: board, error: fetchError } = await supabase
    .from("board")
    .select("workspace_id")
    .eq("id", input.boardId)
    .single();
  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!board) throw { code: "NOT_FOUND", message: "Board not found." };

  const { error } = await supabase
    .from("board")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", input.boardId);
  if (error) throw { code: "DB", message: error.message };

  revalidateTag(`board:${input.boardId}`);
  revalidateTag(`boards:${board.workspace_id}`);
});

export const restoreBoard = withUser(async ({ supabase }, raw) => {
  const input = RestoreBoardSchema.parse(raw);

  // restore_board is a security-definer RPC that bypasses role_for_board's
  // null-for-deleted-board logic and checks workspace admin+ directly.
  // types updated in F1 (supabase gen types)
  type SupabaseWithRpc = {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
  };
  const { data, error } = await (supabase as unknown as SupabaseWithRpc).rpc("restore_board", {
    p_board_id: input.boardId,
  });

  if (error) {
    if (error.code === "P0002") throw { code: "NOT_FOUND", message: "Board not found." };
    if (error.code === "42501") throw { code: "FORBIDDEN", message: "Insufficient permissions." };
    if (error.code === "P0001") throw { code: "VALIDATION", message: "Board is not archived." };
    throw { code: "DB", message: error.message };
  }

  revalidateTag(`board:${input.boardId}`);
  return data;
});

export const deleteBoard = withUser(async ({ supabase }, raw) => {
  const input = DeleteBoardSchema.parse(raw);

  const { data: board, error: fetchError } = await supabase
    .from("board")
    .select("name, workspace_id")
    .eq("id", input.boardId)
    .single();
  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!board) throw { code: "NOT_FOUND", message: "Board not found." };

  // deleteBoard is workspace-owner only, matching the board_delete RLS policy.
  await requireWorkspaceRole(board.workspace_id, "owner");

  if (input.confirmName !== board.name) {
    throw { code: "VALIDATION", message: "Name does not match.", field: "confirmName" };
  }

  const { error } = await supabase.from("board").delete().eq("id", input.boardId);
  if (error) throw { code: "DB", message: error.message };

  revalidateTag(`boards:${board.workspace_id}`);
});

export const duplicateBoard = withUser(async ({ supabase }, raw) => {
  const input = DuplicateBoardSchema.parse(raw);
  await requireBoardRole(input.boardId, "member");

  // clone_board RPC — types updated in F1 (supabase gen types)
  type SupabaseWithRpc = {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await (supabase as unknown as SupabaseWithRpc).rpc("clone_board", {
    p_board_id: input.boardId,
  });
  if (error) throw { code: "DB", message: error.message };

  // data is the new board row returned by the RPC.
  const newBoard = data as { id: string; workspace_id: string };
  revalidateTag(`boards:${newBoard.workspace_id}`);

  return { boardId: newBoard.id };
});
